import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 300_000, // 5 min — user needs time to login manually
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: false, // MUST be visible for manual login
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'meta-assisted',
      use: { browserName: 'chromium' },
    },
  ],
});
