# revivetoday.com

Marketing site for RE-ViVE Execution Intelligence for banking, built with
[Astro](https://astro.build) and deployed to Cloudflare as a Worker with
static assets. Same arrangement as the re-vive.com repository.

## Layout

```
src/pages/*.astro        one file per page (59 pages)
src/layouts/Layout.astro <head>, shared header and footer
src/components/          Header.astro (nav + active-page markers), Footer.astro
src/worker.js            Cloudflare Worker: https, www -> apex, trailing-slash
                         and .html redirects, retired paths, security headers
public/assets/css        stylesheets (loaded per page from each page's head slot)
public/images, public/docs
notes/                   revision notes that shipped with the V2–V7 packages
```

Pages are prerendered at build time (`output: 'static'`, `build.format: 'file'`),
so `/platform` is served from `dist/client/platform.html`. Internal links use
clean paths (`/platform`); the Worker 301s `/platform.html` and `/platform/`
to the clean form.

## Commands

| Command           | Action                                              |
| ----------------- | --------------------------------------------------- |
| `npm install`     | Install dependencies (Node 22.12 or newer)          |
| `npm run dev`     | Dev server at http://localhost:4321                 |
| `npm run build`   | Build to `dist/` (static pages in `dist/client/`)   |
| `npm run preview` | Serve the built site locally through Wrangler       |
| `npm run deploy`  | Build and deploy to Cloudflare (`wrangler deploy`)  |

## Deploying

`wrangler.json` names the Worker `revivetoday` and attaches it to the zone
routes `revivetoday.com/*` and `www.revivetoday.com/*`. The zone's existing
DNS records (proxied A/AAAA for the apex and www, plus mail records) stay as
they are; a route runs the Worker before any origin is contacted.
`npm run deploy` builds and publishes. Keep "Always Use HTTPS" on in the
zone's SSL/TLS settings; the Worker does not upgrade http itself.

## Adding a page

Create `src/pages/<slug>.astro`:

```astro
---
import Layout from "../layouts/Layout.astro";
---
<Layout title="Page title | RE-ViVE" description="…" current="/<slug>">
  <Fragment slot="head">
    <link href="/images/favicon.svg" rel="icon" type="image/svg+xml"/>
    <link href="/assets/css/site.css" rel="stylesheet"/>
    <link href="/assets/css/chrome.css" rel="stylesheet"/>
  </Fragment>
  <main id="main">…</main>
</Layout>
```

To add it to the menu, edit the `NAV` array in `src/components/Header.astro`.
