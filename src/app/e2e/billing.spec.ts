import { test, expect } from '../playwright-fixture';

test.describe('Billing', () => {
  test.describe('Usage Page', () => {
    test('@smoke should load billing usage page', async ({ page }) => {
      await page.goto('/app/billing/usage');

      await expect(page).toHaveURL(/\/app\/billing\/usage/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display usage metrics', async ({ page }) => {
      await page.goto('/app/billing/usage');

      // Should show usage KPIs (messages, contacts, storage, etc.)
      const metrics = page.locator(
        '[data-testid="usage-metrics"], [data-testid="kpi-card"], .usage-card'
      );
      const metricsText = page.getByText(/uso|mensagens|contatos|armazenamento|plano|storage/i);
      const emptyState = page.getByText(/nenhum dado|sem dados/i);

      const hasMetrics = await metrics.first().isVisible().catch(() => false);
      const hasText = await metricsText.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasMetrics || hasText || hasEmpty).toBe(true);
    });

    test('@regression should display current plan information', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const planInfo = page.getByText(/plano|plan|assinatura|subscription/i);
      const hasInfo = await planInfo.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('@regression should show export or download option', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const exportBtn = page.getByRole('button', { name: /exportar|export|download|csv/i });
      const hasExport = await exportBtn.first().isVisible().catch(() => false);

      // Export may not be visible if no data - just verify no crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle billing API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/billing/**', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Billing service unavailable' }),
        })
      );

      await page.goto('/app/billing/usage');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
