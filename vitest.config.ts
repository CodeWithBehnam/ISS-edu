import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      // Must match the tsconfig path mapping ('@/*' -> src/*).
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});

