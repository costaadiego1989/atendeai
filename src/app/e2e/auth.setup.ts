import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = './e2e/.auth/user.json';

/**
 * Authentication setup — runs once before all tests.
 * Logs in via the UI and persists storage state (cookies) for reuse.
 *
 * Requires env vars: E2E_USER_EMAIL, E2E_USER_PASSWORD
 * Defaults to test credentials for local dev.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL ?? 'test@atendeai.com';
  const password = process.env.E2E_USER_PASSWORD ?? 'Test@123';

  await page.goto('/login');

  // Real heading: "Acesse sua Máquina de Vendas"
  await expect(
    page.getByRole('heading', { name: /acesse sua máquina de vendas/i })
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Wait for redirect to the app (dashboard or first-access)
  await page.waitForURL(/\/app\//, { timeout: 15_000 });

  // Persist authenticated state (cookies)
  await page.context().storageState({ path: AUTH_FILE });
});
