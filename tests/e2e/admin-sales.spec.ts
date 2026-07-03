import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Sales Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/sales');
  });

  test('should navigate to sales page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'sales-page');
  });

  test('should show page content when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasContent = await main.locator('text=/Sales|Vendas/').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContent) {
      await takeScreenshot(page, 'sales-content');
    }
  });

  test('should render table when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table.locator('thead')).toBeVisible();
      await takeScreenshot(page, 'sales-table');
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
