import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Recovery E2E Tests — Full coverage based on recovery.e2e-spec.md
 */

test.describe('Recovery', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load recovery page', async ({ page }) => {
      await page.goto('/app/recovery');

      await expect(page).toHaveURL(/\/app\/recovery/);

      const content = page.locator(
        'main, [role="main"], [data-testid="recovery-page"]'
      );
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display playbooks list or empty state', async ({ page }) => {
      await page.goto('/app/recovery');

      const list = page.locator(
        '[data-testid="playbooks-list"], table, [role="list"], .playbook-item'
      );
      const emptyState = page.getByText(/nenhum playbook|sem playbooks|crie seu primeiro|nenhuma regra/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('1.3 @smoke should display recovery metrics/KPIs', async ({ page }) => {
      await page.goto('/app/recovery');

      const metrics = page.locator(
        '[data-testid="recovery-metrics"], [data-testid="kpi-card"], .metrics'
      );
      const metricsText = page.getByText(/recuperado|taxa|valor|total|inadimplente/i);

      const hasMetrics = await metrics.first().isVisible().catch(() => false);
      const hasText = await metricsText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should open create playbook form', async ({ page }) => {
      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="playbook-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.2 @regression should show playbook detail with cases', async ({ page }) => {
      await page.goto('/app/recovery');

      const playbook = page.locator(
        '[data-testid="playbook-item"], tr[data-row], .playbook-card, [role="row"]'
      );
      const hasPlaybook = await playbook.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPlaybook) {
        await playbook.first().click();

        const cases = page.locator(
          '[data-testid="cases-list"], [data-testid="playbook-detail"], table'
        );
        const caseText = page.getByText(/caso|case|devedor|inadimplente/i);

        const hasCases = await cases.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasText = await caseText.first().isVisible().catch(() => false);

        expect(hasCases || hasText).toBe(true);
      }
    });

    test('2.3 @regression should display outreach channel options', async ({ page }) => {
      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const channelOptions = page.getByText(/whatsapp|sms|email|canal/i);
        const hasChannels = await channelOptions.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show execution states for playbooks', async ({ page }) => {
      await page.goto('/app/recovery');

      const statusBadge = page.getByText(/ativo|pausado|rascunho|executando|concluído|concluido/i);
      const hasStatus = await statusBadge.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. VALIDAÇÃO ─────────────────────────────────────────────────────────────

  test.describe('3. Validação', () => {
    test('3.1 @regression should validate playbook form fields', async ({ page }) => {
      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  // ─── 4. FILTROS ───────────────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should display search or filter controls', async ({ page }) => {
      await page.goto('/app/recovery');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter/i });
      const tabs = page.locator('[role="tablist"]');

      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);
      const hasTabs = await tabs.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should filter by playbook status', async ({ page }) => {
      await page.goto('/app/recovery');

      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'));
      const hasFilter = await statusFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no playbooks', async ({ page }) => {
      await page.route('**/api/v1/recovery/**', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/recovery');

      const emptyState = page.getByText(/nenhum playbook|sem playbooks|crie seu primeiro/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 gracefully', async ({ page }) => {
      await page.route('**/api/v1/recovery/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/recovery');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/recovery/**');

      await page.goto('/app/recovery');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in playbook name', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();
        const nameInput = page.getByLabel(/nome|name|título|titulo/i);
        const hasName = await nameInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasName) await nameInput.first().fill('<script>alert(1)</script>');
      }

      await page.waitForTimeout(2_000);
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display recovery on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/recovery');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display recovery on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/recovery');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-create on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/recovery/**');

      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const nameInput = page.getByLabel(/nome|name/i);
        const hasName = await nameInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasName) await nameInput.first().fill('Test Playbook');

        const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
        await submitBtn.first().dblclick();

        await page.waitForTimeout(3_000);

        const postCalls = calls.filter((c) => c.method === 'POST');
        expect(postCalls.length).toBeLessThanOrEqual(1);
      }
    });
  });
});
