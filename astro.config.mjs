import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { readFileSync, writeFileSync } from 'node:fs';

// Same arrangement as the re-vive.com repo: wrangler.json sends every request
// through src/worker.js first (assets.run_worker_first) so canonical-host and
// trailing-slash redirects apply to static pages in production. `astro dev`
// gets a generated copy of the config with that switched off.
const isDev = process.argv.includes('dev');
let devWranglerConfig;
if (isDev) {
  const config = JSON.parse(readFileSync(new URL('./wrangler.json', import.meta.url), 'utf8'));
  config.assets = { ...config.assets, run_worker_first: false };
  writeFileSync(new URL('./wrangler.dev.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
  devWranglerConfig = './wrangler.dev.json';
}

export default defineConfig({
  // Production host. Drives the sitemap and absolute URLs.
  site: 'https://revivetoday.com',

  // Every page is prerendered at build time and served as a static asset.
  output: 'static',

  // One URL per page: /platform, never /platform/ or /platform.html.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  // The old banking.html overview now lives on the workflows page.
  redirects: {
    '/banking': '/workflows',
  },

  adapter: cloudflare({
    configPath: devWranglerConfig,
  }),

  integrations: [sitemap()],
});
