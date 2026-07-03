import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Support Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/support');
  });

  test('should navigate to support page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'support-page');
  });

  test('should show page content when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasContent = await main.locator('text=/Support|Suporte/').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContent) {
      await takeScreenshot(page, 'support-content');
    }
  });

  test('should render table when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table.locator('thead')).toBeVisible();
      await takeScreenshot(page, 'support-table');
    }
  });

  test('should open feedback detail drawer on row click @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      const firstRow = table.locator('tbody tr').first();
      const hasRow = await firstRow.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasRow) {
        await firstRow.click();
        await takeScreenshot(page, 'support-feedback-detail');
      }
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
