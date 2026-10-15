// On-demand route. Besides a cheap uptime check it makes the Cloudflare
// adapter emit the Worker bundle so src/worker.js (redirects, security
// headers) runs in front of the prerendered pages. The contact-form API
// will live next to this file, as on re-vive.com.
export const prerender = false;

export function GET() {
  return new Response(JSON.stringify({ ok: true, site: "revivetoday.com" }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
