import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /entrar|login/i })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha|password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|login/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /entrar|login/i }).click();

    // Expect at least one validation message
    const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
    await expect(errors.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/e-?mail/i).fill('invalid@example.com');
    await page.getByLabel(/senha|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar|login/i }).click();

    // Expect an error toast or inline message
    const errorIndicator = page.locator(
      '[role="alert"], [data-sonner-toast][data-type="error"], .text-destructive'
    );
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should redirect unauthenticated user from /app to /login', async ({ page }) => {
    await page.goto('/app/dashboard');

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /esquec|forgot/i }).click();

    await page.waitForURL(/\/forgot-password/);
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
