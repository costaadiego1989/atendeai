import { test as base, expect } from '@playwright/test';

export { expect };

/**
 * Extended test fixture with common helpers for AtendeAi E2E tests.
 * Add page objects or shared utilities here as needed.
 */
export const test = base.extend<{
  /** Navigate to a protected app route (assumes authenticated state) */
  appPage: void;
}>({
  appPage: [
    async ({ page }, use) => {
      await page.goto('/app/dashboard');
      await page.waitForURL(/\/app\//);
      await use();
    },
    { auto: false },
  ],
});
