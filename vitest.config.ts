import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src/', import.meta.url));

// The examples import the package by name; point that at the sources so tests don't need a build.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^cleared$/, replacement: `${src}index.ts` },
      { find: /^cleared\/(.+)$/, replacement: `${src}$1.ts` },
    ],
  },
});
