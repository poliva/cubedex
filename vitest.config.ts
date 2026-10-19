import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['cubing'],
  },
  test: {
    server: {
      deps: {
        // Transform the Bluetooth package so its CommonJS crypto imports interoperate.
        inline: ['smartcube-web-bluetooth'],
      },
    },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: true,
    restoreMocks: true,
  },
});
