import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = './e2e/.auth/user.json';

/**
 * Authentication setup — runs once before all tests.
 * Logs in via the UI and persists storage state for reuse.
 *
 * Requires env vars: E2E_USER_EMAIL, E2E_USER_PASSWORD
 * Defaults to test credentials for local dev.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL ?? 'test@atendeai.com';
  const password = process.env.E2E_USER_PASSWORD ?? 'Test@123';

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /entrar|login/i })).toBeVisible();

  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole('button', { name: /entrar|login/i }).click();

  // Wait for redirect to the app
  await page.waitForURL(/\/app\//, { timeout: 15_000 });

  // Persist authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
