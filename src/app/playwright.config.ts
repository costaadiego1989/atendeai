import { defineConfig, devices } from '@playwright/test';

const authFile = './e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /bug-hunting\//,
    },
    {
      name: 'bug-hunting',
      testMatch: /bug-hunting\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No storageState — bug-hunting tests mock everything via page.route()
      },
    },
    {
      name: 'widget-integration',
      testMatch: /widget-integration\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No storageState — widget API is public (no auth required)
        // NO page.route() mocks for widget API — real backend + real AI
        actionTimeout: 35_000,
      },
    },
    {
      name: 'production',
      testMatch: /production\/.*\.spec\.ts/,
      use: {
        // No browser — uses Playwright's request fixture only (REST API tests)
        // Runs against real production: api.atende-ai.tech
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
