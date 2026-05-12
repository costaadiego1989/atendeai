import { test, expect } from '../playwright-fixture';

test.describe('Dashboard', () => {
  test('should load dashboard after login', async ({ page }) => {
    await page.goto('/app/dashboard');

    // Should stay on dashboard (not redirect to login)
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // Dashboard should render main content area
    const main = page.locator('main, [role="main"], [data-testid="dashboard"]');
    await expect(main.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display navigation sidebar', async ({ page }) => {
    await page.goto('/app/dashboard');

    // Sidebar or nav should be present
    const nav = page.locator('nav, [role="navigation"], aside');
    await expect(nav.first()).toBeVisible();
  });

  test('should navigate to conversations from sidebar', async ({ page }) => {
    await page.goto('/app/dashboard');

    const conversationsLink = page.getByRole('link', { name: /conversa|mensag/i });
    await conversationsLink.first().click();

    await page.waitForURL(/\/app\/conversations/);
    await expect(page).toHaveURL(/\/app\/conversations/);
  });
});
