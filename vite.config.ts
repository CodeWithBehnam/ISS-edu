import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { normaliseBasePath } from './build/base-path';
import { cspMetaPlugin } from './build/csp';

const REACT_VENDOR =
  /node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler|zustand|use-sync-external-store)\//;
const THREE_VENDOR = /node_modules\/(three|three-stdlib|@react-three|react-reconciler)\//;

/**
 * Keeps the 3D libraries out of the entry's static imports. Shared helpers (the JSX runtime,
 * zustand) must live in react-vendor, otherwise Rollup parks them in the three chunk and the
 * lazy TrackerCanvas import no longer defers the heavy download.
 */
function manualChunk(id: string): string | undefined {
  // The dynamic-import preload helper is used by the entry and by three-vendor; without this it lands in three-vendor.
  if (id.includes('vite/preload-helper')) return 'react-vendor';
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('/satellite.js/')) return 'satellite';
  if (REACT_VENDOR.test(id)) return 'react-vendor';
  if (THREE_VENDOR.test(id)) return 'three-vendor';
  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/, so deployments set BASE_PATH (default "/").
  base: normaliseBasePath(process.env.BASE_PATH),
  plugins: [react(), cspMetaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: manualChunk,
      },
    },
  },
});
