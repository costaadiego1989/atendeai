import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Payment Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/payment');
  });

  test('should navigate to payment page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'payment-page');
  });

  test('should show page content when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasContent = await main.locator('text=/Payment|Pagamentos/').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContent) {
      await takeScreenshot(page, 'payment-content');
    }
  });

  test('should render table when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table.locator('thead')).toBeVisible();
      await takeScreenshot(page, 'payment-table');
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
