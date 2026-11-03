/**
 * Shared abuse protection for the public form endpoints
 * (/api/contact, /api/mail, /api/demo-request, /api/notify-content).
 *
 * Layers, in order:
 *   1. Origin must be present and belong to this site (browsers always send
 *      it on cross-page POSTs; curl and most bots do not).
 *   2. Body must be JSON and under `maxBytes`.
 *   3. Per-IP rate limit via the FORM_RATE_LIMIT Workers binding (wrangler.json).
 *   4. Cloudflare Turnstile token verification, enforced whenever
 *      TURNSTILE_SECRET_KEY is configured on the Worker.
 *
 * Endpoints keep their own honeypot, timing and field validation on top.
 */

const ALLOWED_HOSTS = new Set([
    "revivetoday.com",
    "www.revivetoday.com",
    "localhost",
    "127.0.0.1",
]);

const TURNSTILE_VERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function reject(message, status) {
    return {
        ok: false,
        response: new Response(
            JSON.stringify({ success: false, message }),
            {
                status,
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "no-store",
                },
            },
        ),
    };
}

async function loadEnv() {
    try {
        const { env } = await import("cloudflare:workers");
        return env ?? {};
    } catch {
        return {};
    }
}

/** Verify a Turnstile token with Cloudflare. Returns true on success. */
export async function verifyTurnstile(secret, token, remoteip) {
    if (!secret || !token) return false;
    try {
        const form = new URLSearchParams({ secret, response: token });
        if (remoteip) form.set("remoteip", remoteip);
        const res = await fetch(TURNSTILE_VERIFY_URL, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: form.toString(),
        });
        const data = await res.json();
        return data?.success === true;
    } catch (err) {
        console.error("Turnstile verification error:", err?.message);
        return false;
    }
}

/**
 * Run all checks. Resolves to `{ ok: true, body, ip }` or
 * `{ ok: false, response }` where `response` is ready to return.
 */
export async function guardFormRequest(request, options = {}) {
    const maxBytes = options.maxBytes ?? 16 * 1024;

    /* 1. Origin */
    const requestHost = new URL(request.url).hostname;
    let originHost = null;
    try {
        const origin = request.headers.get("origin");
        originHost = origin ? new URL(origin).hostname : null;
    } catch {
        originHost = null;
    }
    if (
        !originHost ||
        (originHost !== requestHost && !ALLOWED_HOSTS.has(originHost))
    ) {
        return reject("Invalid request origin.", 403);
    }

    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
        return reject("Invalid request origin.", 403);
    }

    /* 2. Content type and size */
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
        return reject("Unsupported request format.", 415);
    }

    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
        return reject("Request too large.", 413);
    }

    const raw = await request.text();
    if (raw.length > maxBytes) {
        return reject("Request too large.", 413);
    }

    /* 3. Rate limit (per client IP) */
    const env = await loadEnv();
    const ip = request.headers.get("cf-connecting-ip") || "unknown";

    if (env.FORM_RATE_LIMIT && typeof env.FORM_RATE_LIMIT.limit === "function") {
        try {
            const { success } = await env.FORM_RATE_LIMIT.limit({ key: ip });
            if (!success) {
                return reject(
                    "Too many requests. Please wait a minute and try again.",
                    429,
                );
            }
        } catch (err) {
            console.error("Rate limit binding error:", err?.message);
        }
    }

    /* 4. Parse */
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        return reject("Invalid request data.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return reject("Invalid request data.", 400);
    }

    /* 5. Turnstile (only when configured) */
    if (env.TURNSTILE_SECRET_KEY) {
        const token =
            typeof body.turnstileToken === "string" ? body.turnstileToken : "";
        const verified = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip);
        if (!verified) {
            return reject(
                "We could not verify that you are human. Please refresh the page and try again.",
                403,
            );
        }
    }
    delete body.turnstileToken;

    return { ok: true, body, ip };
}
