import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy NASA images to avoid CORS issues in development
      '/api/nasa-images': {
        target: 'https://eoimages.gsfc.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nasa-images/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'satellite': ['satellite.js'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
