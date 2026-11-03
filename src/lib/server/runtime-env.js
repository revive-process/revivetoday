/**
 * Server-side configuration and secrets.
 *
 * Everything is read at request time from the Cloudflare Worker env
 * (`cloudflare:workers`). The @astrojs/cloudflare adapter provides the same
 * binding in `astro dev`, populated from wrangler.json `vars` plus the
 * git-ignored `.dev.vars` file.
 *
 * Never read secrets through `import.meta.env`: Astro replaces private
 * `import.meta.env.X` with the literal value at build time, which bakes the
 * secret into the deployed bundle.
 *
 * Non-secret config lives in wrangler.json `vars`.
 * Secrets (MS_CLIENT_SECRET, ...) are set with `wrangler secret put`.
 */
const KEYS = [
    "MS_TENANT_ID",
    "MS_CLIENT_ID",
    "MS_CLIENT_SECRET",
    "MS_SENDER_EMAIL",
    "CONTACT_TO_EMAIL",
    "USE_CASE_LEAD_TO_EMAIL",
    "DEMO_ORGANIZER_EMAIL",
];

export async function getRuntimeEnv() {
    const { env } = await import("cloudflare:workers");

    const out = { ENV_SOURCE: "CLOUDFLARE" };
    for (const key of KEYS) {
        out[key] = env?.[key];
    }
    return out;
}
