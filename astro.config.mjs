import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://ceprija.edu.mx',
  integrations: [tailwind(), sitemap()],
  output: 'static',

  adapter: node({
    mode: 'standalone',
  }),
});