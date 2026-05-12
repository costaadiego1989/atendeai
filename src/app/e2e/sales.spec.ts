import { test, expect } from '../playwright-fixture';

test.describe('Sales', () => {
  test.describe('Pipeline View', () => {
    test('@smoke should load sales metrics page', async ({ page }) => {
      await page.goto('/app/sales/metrics');

      await expect(page).toHaveURL(/\/app\/sales\/metrics/);

      const content = page.locator(
        'main, [role="main"], [data-testid="sales-page"], [data-testid="sales-metrics"]'
      );
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display sales KPIs or charts', async ({ page }) => {
      await page.goto('/app/sales/metrics');

      // Look for KPI cards, charts, or metrics display
      const metrics = page.locator(
        '[data-testid="kpi-card"], [data-testid="sales-chart"], .recharts-wrapper, canvas, svg.chart'
      );
      const metricsText = page.getByText(/vendas|receita|conversão|conversao|faturamento/i);
      const emptyState = page.getByText(/nenhum dado|sem dados|sem vendas/i);

      const hasMetrics = await metrics.first().isVisible().catch(() => false);
      const hasText = await metricsText.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasMetrics || hasText || hasEmpty).toBe(true);
    });

    test('@regression should navigate to payment links page', async ({ page }) => {
      await page.goto('/app/sales/payment-links');

      await expect(page).toHaveURL(/\/app\/sales\/payment-links/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Payment Links', () => {
    test('@regression should display payment links list or empty state', async ({ page }) => {
      await page.goto('/app/sales/payment-links');

      const list = page.locator(
        '[data-testid="payment-links-list"], table, [role="list"], .payment-link-item'
      );
      const emptyState = page.getByText(/nenhum link|sem links|crie seu primeiro/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should open create payment link form', async ({ page }) => {
      await page.goto('/app/sales/payment-links');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|gerar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="create-link-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('Promotions & Coupons (APP-SAL-003)', () => {
    test('@regression should load promotions page', async ({ page }) => {
      await page.goto('/app/sales/promotions');

      await expect(page).toHaveURL(/\/app\/sales\/promotions/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display promotions list or empty state', async ({ page }) => {
      await page.goto('/app/sales/promotions');

      const list = page.locator(
        '[data-testid="promotions-list"], table, [role="list"], .promotion-item'
      );
      const emptyState = page.getByText(/nenhuma promoção|nenhuma promocao|sem promoções|sem cupons/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should open create promotion/coupon form', async ({ page }) => {
      await page.goto('/app/sales/promotions');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="create-promotion-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle API errors gracefully on metrics', async ({ page }) => {
      await page.route('**/api/v1/sales/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/sales/metrics');

      // Should not crash - show error state or empty state
      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
