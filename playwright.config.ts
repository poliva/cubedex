import { defineConfig } from '@playwright/test';
import * as os from 'os';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: Math.max(1, Math.floor(os.cpus().length * 0.25)),
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
