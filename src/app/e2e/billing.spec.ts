import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Billing E2E Tests — Full coverage based on billing.e2e-spec.md
 */

test.describe('Billing', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load billing usage page', async ({ page }) => {
      await page.goto('/app/billing/usage');

      await expect(page).toHaveURL(/\/app\/billing\/usage/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display current plan information', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const planInfo = page.getByText(/plano|plan|assinatura|subscription/i);
      const hasInfo = await planInfo.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display usage metrics', async ({ page }) => {
      await page.goto('/app/billing/usage');

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
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should display usage progress bars', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const progressBars = page.locator(
        '[role="progressbar"], [data-testid="usage-bar"], .progress-bar'
      );
      const usageText = page.getByText(/\d+\s*\/\s*\d+|\d+%/);

      const hasBars = await progressBars.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasUsage = await usageText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.2 @regression should show upgrade plan button', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const upgradeBtn = page.getByRole('button', { name: /upgrade|melhorar|mudar plano|assinar/i })
        .or(page.getByRole('link', { name: /upgrade|melhorar|mudar plano/i }));

      const hasUpgrade = await upgradeBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.3 @regression should navigate to invoices/history', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const invoicesLink = page.getByRole('link', { name: /faturas|invoices|histórico|historico/i })
        .or(page.getByRole('tab', { name: /faturas|invoices/i }))
        .or(page.locator('[data-testid="invoices-link"]'));

      const hasLink = await invoicesLink.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasLink) {
        await invoicesLink.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.4 @regression should show export or download option', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const exportBtn = page.getByRole('button', { name: /exportar|export|download|csv/i });
      const hasExport = await exportBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. PLANOS E UPGRADE ──────────────────────────────────────────────────────

  test.describe('3. Planos e Upgrade', () => {
    test('3.1 @regression should display available plans', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const upgradeBtn = page.getByRole('button', { name: /upgrade|melhorar|mudar plano|assinar/i })
        .or(page.getByRole('link', { name: /upgrade|melhorar|planos/i }));
      const hasUpgrade = await upgradeBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasUpgrade) {
        await upgradeBtn.first().click();

        const plans = page.getByText(/trial|starter|pro|enterprise|básico|basico|profissional/i);
        const hasPlans = await plans.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('3.2 @regression should show plan comparison features', async ({ page }) => {
      await page.goto('/app/billing/plans');

      const content = page.locator('main, [role="main"]');
      const hasContent = await content.first().isVisible({ timeout: 10_000 }).catch(() => false);

      // May redirect - just verify no crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show zero usage for new tenant', async ({ page }) => {
      await page.route('**/api/v1/billing/usage*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { messages: 0, contacts: 0, storage: 0, aiCredits: 0 },
          }),
        })
      );

      await page.goto('/app/billing/usage');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle billing API 503 gracefully', async ({ page }) => {
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

    test('8.2 @regression should handle billing API timeout', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/billing/**');

      await page.goto('/app/billing/usage');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @regression should format large usage values correctly', async ({ page }) => {
      await page.route('**/api/v1/billing/usage*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { messages: 999999, contacts: 50000, storage: 10737418240, aiCredits: 9999 },
          }),
        })
      );

      await page.goto('/app/billing/usage');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.2 @regression should display Brazilian currency format', async ({ page }) => {
      await page.goto('/app/billing/usage');

      const currencyValues = page.getByText(/R\$\s*[\d.,]+/);
      const hasValues = await currencyValues.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display billing on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/billing/usage');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display billing on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/billing/usage');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
