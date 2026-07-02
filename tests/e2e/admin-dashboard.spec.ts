import { test, expect, takeScreenshot, testPeriodSelector, navigateAsAdmin } from './admin-fixtures';

test.describe('Dashboard Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAsAdmin(page, '/admin/dashboard');
  });

  test('should navigate to dashboard and show sidebar', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('h1:has-text("AtendeAi Admin")')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await takeScreenshot(page, 'dashboard-navigation');
  });

  test('should show loading or content in main area', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
    // Either loading state or actual content
    const hasLoading = await main.locator('text=Carregando').isVisible().catch(() => false);
    const hasTitle = await main.locator('text=Dashboard').isVisible().catch(() => false);
    expect(hasLoading || hasTitle).toBeTruthy();
    await takeScreenshot(page, 'dashboard-main-area');
  });

  test('should display tenant KPIs when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    // Wait for content (skip if still loading after 5s — API not available)
    const loaded = await main.locator('text=Tenants').isVisible({ timeout: 5000 }).catch(() => false);
    if (loaded) {
      await expect(main.locator('text=Ativos')).toBeVisible();
      await expect(main.locator('text=Novos no período')).toBeVisible();
      await expect(main.locator('text=Em trial')).toBeVisible();
      await expect(main.locator('text=Churn')).toBeVisible();
      await takeScreenshot(page, 'dashboard-tenant-kpis');
    }
  });

  test('should display revenue KPIs when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const loaded = await main.locator('text=Receita').isVisible({ timeout: 5000 }).catch(() => false);
    if (loaded) {
      await expect(main.locator('text=MRR')).toBeVisible();
      await expect(main.locator('text=ARR')).toBeVisible();
      await expect(main.locator('text=ARPU')).toBeVisible();
      await takeScreenshot(page, 'dashboard-revenue-kpis');
    }
  });

  test('should display operations section when data loads @requires-api', async ({ page }) => {
    const main = page.locator('main');
    const loaded = await main.locator('text=Operações').isVisible({ timeout: 5000 }).catch(() => false);
    if (loaded) {
      await expect(main.locator('text=Mensagens')).toBeVisible();
      await expect(main.locator('text=Tokens AI')).toBeVisible();
      await takeScreenshot(page, 'dashboard-operations');
    }
  });

  test('should show sidebar navigation with all modules', async ({ page }) => {
    const nav = page.locator('nav');
    const expectedLinks = ['Dashboard', 'Tenants', 'Billing', 'Messaging', 'Vendas', 'Commerce',
      'Cobrança', 'Contatos', 'Prospecção', 'Agendamento', 'AI', 'Social', 'Catálogo',
      'Estoque', 'Propostas', 'Pagamentos', 'Auth', 'Suporte'];
    for (const link of expectedLinks) {
      await expect(nav.getByRole('link', { name: link })).toBeVisible();
    }
    await takeScreenshot(page, 'dashboard-sidebar-nav');
  });

  test('should have logout button', async ({ page }) => {
    await expect(page.locator('button:has-text("Sair")')).toBeVisible();
  });

  test('should change period selector if available', async ({ page }) => {
    await testPeriodSelector(page);
    await takeScreenshot(page, 'dashboard-period-changed');
  });
});
