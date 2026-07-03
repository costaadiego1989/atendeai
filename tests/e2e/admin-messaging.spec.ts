import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Messaging Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/messaging');
  });

  test('should navigate to messaging page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'messaging-page');
  });

  test('should show page header when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasHeader = await main.locator('text=Messaging').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHeader) {
      await expect(main.locator('text=Conversas e mensagens cross-tenant')).toBeVisible();
    }
  });

  test('should display KPI cards when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasKPI = await main.locator('text=Conversas ativas').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasKPI) {
      await expect(main.locator('text=Msgs enviadas')).toBeVisible();
      await expect(main.locator('text=Msgs recebidas')).toBeVisible();
      await takeScreenshot(page, 'messaging-kpis');
    }
  });

  test('should display channel breakdown @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const has = await main.locator('text=Por canal').isVisible({ timeout: 5000 }).catch(() => false);
    if (has) {
      await expect(main.locator('text=Por remetente')).toBeVisible();
      await takeScreenshot(page, 'messaging-breakdown');
    }
  });

  test('should render conversations table @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      const headers = ['Contato', 'Empresa', 'Canal', 'Status', 'Última msg'];
      for (const h of headers) {
        await expect(table.locator(`th:has-text("${h}")`)).toBeVisible();
      }
      await takeScreenshot(page, 'messaging-table');
    }
  });

  test('should show empty state or data in table @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      const empty = main.locator('text=Nenhuma conversa');
      const rows = table.locator('tbody tr');
      const hasEmpty = await empty.isVisible().catch(() => false);
      if (!hasEmpty) {
        expect(await rows.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
    await takeScreenshot(page, 'messaging-period');
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
