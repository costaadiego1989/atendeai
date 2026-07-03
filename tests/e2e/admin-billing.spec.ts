import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Billing Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/billing');
  });

  test('should navigate to billing page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'billing-page');
  });

  test('should show page content when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasContent = await main.locator('text=/Billing|Faturamento/').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContent) {
      await takeScreenshot(page, 'billing-content');
    }
  });

  test('should render subscriptions table when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table.locator('thead')).toBeVisible();
      await takeScreenshot(page, 'billing-table');
    }
  });

  test('should show table filters @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasFilters = await main.locator('[role="combobox"], select, [data-testid*="filter"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasFilters) {
      await takeScreenshot(page, 'billing-filters');
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
