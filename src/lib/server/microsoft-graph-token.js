import { getRuntimeEnv } from "./runtime-env.js";

/* ==========================================================================
   MICROSOFT GRAPH ACCESS TOKEN

   Single client-credentials implementation shared by the mail, calendar
   and use-case download code. The token is cached for the lifetime of the
   Worker isolate and refreshed a minute before it expires, so a request
   that sends two emails (or checks the calendar and then books a meeting)
   only hits the token endpoint once.
   ========================================================================== */

const TOKEN_URL_BASE = "https://login.microsoftonline.com/";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const REFRESH_MARGIN_MS = 60 * 1000;

let cached = null; // { token, expiresAt }
let inflight = null; // Promise<string> while a request is running

function clean(value) {
    return String(value ?? "").trim();
}

async function requestToken() {
    const env = await getRuntimeEnv();

    const tenantId = clean(env.MS_TENANT_ID);
    const clientId = clean(env.MS_CLIENT_ID);
    const clientSecret = clean(env.MS_CLIENT_SECRET);

    if (!tenantId) throw new Error("MS_TENANT_ID is missing.");
    if (!clientId) throw new Error("MS_CLIENT_ID is missing.");
    if (!clientSecret) throw new Error("MS_CLIENT_SECRET is missing.");

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("scope", GRAPH_SCOPE);
    params.set("grant_type", "client_credentials");

    const response = await fetch(
        TOKEN_URL_BASE + encodeURIComponent(tenantId) + "/oauth2/v2.0/token",
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        }
    );

    const responseText = await response.text();
    let result = {};

    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error(
            `Microsoft OAuth returned invalid JSON. HTTP ${response.status}`
        );
    }

    if (!response.ok || !result.access_token) {
        console.error("Microsoft OAuth failure:", {
            status: response.status,
            error: result?.error,
            description: result?.error_description,
        });

        throw new Error(
            `Microsoft OAuth failed (${response.status}): ${
                result?.error_description ||
                result?.error ||
                "Unknown OAuth error"
            }`
        );
    }

    const ttlSeconds = Number(result.expires_in) || 0;

    return {
        token: result.access_token,
        expiresAt: Date.now() + ttlSeconds * 1000,
    };
}

/**
 * Returns a valid Microsoft Graph bearer token, reusing a cached one when
 * it has at least a minute of life left.
 */
export async function getMicrosoftGraphToken() {
    if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
        return cached.token;
    }

    if (!inflight) {
        inflight = requestToken()
            .then((fresh) => {
                cached = fresh;
                return fresh.token;
            })
            .finally(() => {
                inflight = null;
            });
    }

    return inflight;
}
