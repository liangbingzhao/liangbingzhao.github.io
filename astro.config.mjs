import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://liangbingzhao.github.io',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
  // The three.js hero chunk (~170 KB gzipped) is loaded lazily after first paint.
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
