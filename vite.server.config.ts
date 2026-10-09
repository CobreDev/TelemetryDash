import { defineConfig } from 'vite';

// Bundles the API server and its deps into one file so the runtime image needs no node_modules.
export default defineConfig({
  build: {
    ssr: 'server/index.ts',
    outDir: 'dist/server',
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'index.mjs' } },
  },
  ssr: { noExternal: true },
});
