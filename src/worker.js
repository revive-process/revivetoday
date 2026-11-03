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
 *   4. /videos/* and ranged requests are served straight from the asset store
 *      so byte-range requests get 206 responses (needed for video seeking
 *      and iOS playback).
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

// Fetch an asset from the store and, when the client asked for a byte range
// and the store answered with the whole file, cut the requested slice out of
// the stream and return it as 206 Partial Content. Handles "bytes=a-b",
// "bytes=a-" and "bytes=-n"; anything unsatisfiable gets 416.
async function serveWithRange(request, env) {
  const rangeHeader = request.headers.get("range");
  const assetRequest = new Request(request.url, { method: "GET", headers: request.headers });
  let response = await env.ASSETS.fetch(assetRequest);
  if (!rangeHeader || response.status !== 200 || !response.body) {
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  // The store does not always report Content-Length. When it is missing,
  // buffer the file (web renditions are kept under 25 MiB) so the total is
  // known; otherwise slice the stream as it passes through.
  let total = Number(response.headers.get("content-length"));
  let buffered = null;
  if (!Number.isFinite(total) || total <= 0) {
    buffered = new Uint8Array(await response.arrayBuffer());
    total = buffered.byteLength;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  let start, end;
  if (match && match[1] !== "") {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  } else if (match && match[2] !== "") {
    start = Math.max(total - Number(match[2]), 0);
    end = total - 1;
  }
  if (start === undefined || start > end || start >= total) {
    if (!buffered) await response.body.cancel();
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");

  if (request.method === "HEAD") {
    if (!buffered) await response.body.cancel();
    return new Response(null, { status: 206, headers });
  }

  if (buffered) {
    return new Response(buffered.subarray(start, end + 1), { status: 206, headers });
  }

  // Skip `start` bytes, pass through until `end`, then stop reading.
  let position = 0;
  const slicer = new TransformStream({
    transform(chunk, controller) {
      const chunkStart = position;
      const chunkEnd = position + chunk.byteLength - 1;
      position += chunk.byteLength;
      if (chunkEnd < start || chunkStart > end) return;
      const from = Math.max(start - chunkStart, 0);
      const to = Math.min(end - chunkStart, chunk.byteLength - 1);
      controller.enqueue(chunk.subarray(from, to + 1));
      if (chunkEnd >= end) controller.terminate();
    },
  });
  return new Response(response.body.pipeThrough(slicer), { status: 206, headers });
}

export default {
  async fetch(request, env, ctx) {
    const method = request.method.toUpperCase();

    if (method === "GET" || method === "HEAD") {
      const target = canonicalUrl(request);
      if (target) {
        return withSecurityHeaders(Response.redirect(target.toString(), 301));
      }

      // Media, and any request that asks for a byte range, go straight to the
      // asset store with the original request. The Astro handler fetches
      // assets by URL only, which drops the Range header and returns the whole
      // file as 200; video seeking and iOS playback need 206 partial responses.
      const url = new URL(request.url);
      if (url.pathname.startsWith("/videos/") || request.headers.has("range")) {
        return withSecurityHeaders(await serveWithRange(request, env));
      }
    }

    return withSecurityHeaders(await handle(request, env, ctx));
  },
};
