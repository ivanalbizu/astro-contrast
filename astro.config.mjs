// @ts-check
import { defineConfig } from 'astro/config';
import astroContrast from '@ivanalbizu/astro-contrast';

// https://astro.build/config
export default defineConfig({
  integrations: [
    astroContrast({
      level: 'aa',
      verbose: true,
      dashboard: true,
      tokens: ['tokens/colors.json', 'tokens/colors.yaml']
    }),
  ],
});
