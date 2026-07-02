import { test as base, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';
const ADMIN_KEY = process.env.ADMIN_KEY || 'UeUf900@admin-atende-ai-2026';

base.describe('Admin Login', () => {
  base.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
  });

  base('should render login page correctly', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Admin AtendeAi');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Entrar');
    await page.screenshot({ path: 'tests/e2e/screenshots/login-page.png', fullPage: true });
  });

  base('should show error on empty key', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Informe a chave de acesso')).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/login-empty-error.png', fullPage: true });
  });

  base('should show error on invalid key or API down', async ({ page }) => {
    await page.fill('input[type="password"]', 'invalid-key-12345');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const errorVisible = await page.locator('text=Chave inválida').isVisible();
    const apiError = await page.locator('text=Erro ao conectar').isVisible();
    expect(errorVisible || apiError).toBeTruthy();
    await page.screenshot({ path: 'tests/e2e/screenshots/login-invalid-key.png', fullPage: true });
  });

  base('should login successfully with valid key @requires-api', async ({ page }) => {
    // This test requires the API backend running at localhost:3000
    await page.fill('input[type="password"]', ADMIN_KEY);
    await page.click('button[type="submit"]');
    // After successful login, navigates to /admin/support
    await page.waitForURL('**/admin/support', { timeout: 10000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/login-success-redirect.png', fullPage: true });
  });
});
