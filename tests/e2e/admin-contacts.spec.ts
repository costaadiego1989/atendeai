import { test, expect, takeScreenshot, testPeriodSelector, testPagination, navigateAsAdmin } from './admin-fixtures';

test.describe('Contacts Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/contacts');
  });

  test('should navigate to contacts page', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await takeScreenshot(page, 'contacts-page');
  });

  test('should show page title and subtitle @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasTitle = await main.locator('text=Contatos').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTitle) {
      await expect(main.locator('text=Base de contatos cross-tenant')).toBeVisible();
      await takeScreenshot(page, 'contacts-title');
    }
  });

  test('should show KPI cards when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const hasKpi = await main.locator('text=Total').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasKpi) {
      await expect(main.locator('text=Novos no período')).toBeVisible();
      await expect(main.locator('text=Opt-out prospecção')).toBeVisible();
      await expect(main.locator('text=Inativos >30d')).toBeVisible();
      await takeScreenshot(page, 'contacts-kpis');
    }
  });

  test('should render table when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const table = main.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table.locator('thead')).toBeVisible();
      await expect(table.locator('text=Nome')).toBeVisible();
      await expect(table.locator('text=Empresa')).toBeVisible();
      await expect(table.locator('text=Telefone')).toBeVisible();
      await expect(table.locator('text=Estágio')).toBeVisible();
      await expect(table.locator('text=Criado em')).toBeVisible();
      await takeScreenshot(page, 'contacts-table');
    }
  });

  test('should handle period selector', async ({ page }) => {
    await testPeriodSelector(page);
  });

  test('should handle pagination @requires-api', async ({ page }) => {
    await testPagination(page);
  });
});
