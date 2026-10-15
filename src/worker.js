/**
 * Cloudflare Worker entry for revivetoday.com (same pattern as re-vive.com).
 *
 * All pages are prerendered and served from the static asset store.
 * `run_worker_first` in wrangler.json routes every request through here so
 * that these URL rules apply to static pages too:
 *
 *   1. Canonical host: www.revivetoday.com redirects to revivetoday.com.
 *   2. Canonical path: a trailing slash is dropped (/platform/ -> /platform)
 *      and a .html suffix is dropped (/platform.html -> /platform), matching
 *      `trailingSlash: "never"` and `build.format: "file"` in astro.config.mjs.
 *   3. Retired pages 301 to their replacements (RETIRED_PATHS).
 *
 * http -> https is left to Cloudflare's zone setting "Always Use HTTPS"
 * (TLS terminates at the edge before the Worker runs); the HSTS header below
 * pins repeat visitors to https. Doing it here would loop under `wrangler
 * dev`, which presents requests under the route host over plain http.
 *
 * Security headers are added to every response on the way out
 * (public/_headers carries the same set for assets served without the Worker).
 */
import { handle } from "@astrojs/cloudflare/handler";

const PRIMARY_HOST = "revivetoday.com";
const SECONDARY_HOSTS = new Set(["www.revivetoday.com"]);

// Retired pages and where their visitors now go (permanent redirects).
const RETIRED_PATHS = {
  "/banking": "/workflows",
  "/proof": "/success-stories",
};

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function canonicalUrl(request) {
  const url = new URL(request.url);
  let changed = false;

  if (SECONDARY_HOSTS.has(url.hostname)) {
    url.hostname = PRIMARY_HOST;
    changed = true;
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    changed = true;
  }

  if (url.pathname.endsWith(".html")) {
    url.pathname = url.pathname.replace(/\.html$/, "");
    if (url.pathname === "/index") url.pathname = "/";
    changed = true;
  }

  if (RETIRED_PATHS[url.pathname]) {
    url.pathname = RETIRED_PATHS[url.pathname];
    changed = true;
  }

  return changed ? url : null;
}

export default {
  async fetch(request, env, ctx) {
    const method = request.method.toUpperCase();

    if (method === "GET" || method === "HEAD") {
      const target = canonicalUrl(request);
      if (target) {
        return withSecurityHeaders(Response.redirect(target.toString(), 301));
      }
    }

    return withSecurityHeaders(await handle(request, env, ctx));
  },
};
