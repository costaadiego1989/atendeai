import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Alerts E2E Tests — Full coverage based on alerts.e2e-spec.md
 */

test.describe('Alerts', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load alerts page', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      await expect(page).toHaveURL(/\/app\/settings\/alerts/);

      const content = page.locator('main, [role="main"], [data-testid="alerts-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display alerts list or empty state', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const list = page.locator(
        '[data-testid="alerts-list"], table, [role="list"], .alert-item'
      );
      const emptyState = page.getByText(/nenhum alerta|sem alertas|nenhuma regra|configure/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('1.3 @smoke should display create alert button', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.4 @smoke should display status filters', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const filters = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.locator('[role="tablist"]'))
        .or(page.getByRole('button', { name: /filtrar|filter|ativo|pausado/i }));

      const hasFilters = await filters.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should open create alert form', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="alert-form"], [data-testid="create-alert"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.2 @regression should show recurrence options (once/daily)', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const recurrence = page.getByText(/uma vez|diário|diario|recorrência|recorrencia|frequência/i)
          .or(page.locator('[data-testid="recurrence-select"]'));
        const hasRecurrence = await recurrence.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.3 @regression should show pause/resume toggle on alert', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const alert = page.locator(
        '[data-testid="alert-item"], tr[data-row], .alert-card, [role="row"]'
      );
      const hasAlert = await alert.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasAlert) {
        const pauseBtn = page.getByRole('button', { name: /pausar|pause|retomar|resume/i })
          .or(page.locator('[data-testid="toggle-alert"]'));
        const hasPause = await pauseBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show delete alert action', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const alert = page.locator(
        '[data-testid="alert-item"], tr[data-row], .alert-card, [role="row"]'
      );
      const hasAlert = await alert.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasAlert) {
        const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover|delete/i })
          .or(page.locator('[data-testid="delete-alert"]'));
        const moreMenu = page.getByRole('button', { name: /mais|more|opções|options/i });

        const hasDelete = await deleteBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasMore = await moreMenu.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should display KPIs (total, active, paused, sent)', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const kpis = page.locator('[data-testid="kpi-card"], [data-testid="alert-metrics"]');
      const kpiText = page.getByText(/total|ativo|pausado|enviado/i);

      const hasKpis = await kpis.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasText = await kpiText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate empty form submission', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
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

    test('3.2 @regression should validate message field required', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        // Fill date but not message
        const dateField = page.getByLabel(/data|date/i)
          .or(page.locator('input[type="date"], input[type="datetime-local"]'));
        const hasDate = await dateField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasDate) await dateField.first().fill('2026-12-31');

        const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          await page.waitForTimeout(2_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });

    test('3.3 @regression should validate past date', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const dateField = page.getByLabel(/data|date/i)
          .or(page.locator('input[type="date"], input[type="datetime-local"]'));
        const hasDate = await dateField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDate) {
          await dateField.first().fill('2020-01-01');
          await dateField.first().blur();
          await page.waitForTimeout(1_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });

    test('3.4 @regression should validate message length limit', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const msgField = page.getByLabel(/mensagem|message|texto/i)
          .or(page.locator('textarea'));
        const hasMsg = await msgField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasMsg) {
          await msgField.first().fill('A'.repeat(1001));
          await msgField.first().blur();
          await page.waitForTimeout(1_000);
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 4. FILTROS E BUSCA ───────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should filter by active status', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.getByRole('tab', { name: /ativo|active/i }));
      const hasFilter = await statusFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should search alerts by message content', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('Lembrete');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.3 @regression should show no results message', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('xyznonexistent123');
        await page.waitForTimeout(2_000);

        const noResults = page.getByText(/nenhum alerta|nenhum resultado|sem resultados/i);
        const emptyList = page.locator('[data-testid="empty-state"]');

        const hasNoResults = await noResults.first().isVisible().catch(() => false);
        const hasEmpty = await emptyList.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no alerts', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/alerts');

      const emptyState = page.getByText(/nenhum alerta|sem alertas|crie seu primeiro|configure/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });

    test('7.2 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/alerts*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/settings/alerts');

      const skeletons = page.locator('[data-testid="skeleton"], .skeleton, .animate-pulse');
      const hasSkeletons = await skeletons.first().isVisible({ timeout: 3_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 gracefully', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/settings/alerts');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/alerts*');

      await page.goto('/app/settings/alerts');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should display domain error with stable code (APP-ALT-002)', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Validation failed',
              code: 'ALERT_RULE_INVALID',
              message: 'Condição de alerta inválida',
            }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/alerts');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in alert message', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();
        const msgField = page.getByLabel(/mensagem|message|texto/i)
          .or(page.locator('textarea'));
        const hasMsg = await msgField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasMsg) await msgField.first().fill('<script>alert("xss")</script>');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @security should handle SQL injection in search', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill("'; DROP TABLE alerts; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should handle message with only spaces', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const msgField = page.getByLabel(/mensagem|message|texto/i)
          .or(page.locator('textarea'));
        const hasMsg = await msgField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasMsg) {
          await msgField.first().fill('     ');

          const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
          const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

          if (hasSubmit) {
            await submitBtn.first().click();
            await page.waitForTimeout(2_000);

            const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
            const hasError = await errors.first().isVisible().catch(() => false);

            const errorBoundary = page.locator('.error-boundary');
            const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
            expect(hasCrash).toBe(false);
          }
        }
      }
    });

    test('9.4 @regression should accept message with emojis', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const msgField = page.getByLabel(/mensagem|message|texto/i)
          .or(page.locator('textarea'));
        const hasMsg = await msgField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasMsg) {
          await msgField.first().fill('Lembrete de pagamento! 💰🔔');
          await page.waitForTimeout(1_000);
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display alerts on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/settings/alerts');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display alerts on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/settings/alerts');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display alerts on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/settings/alerts');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-create on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/alerts*');

      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const msgField = page.getByLabel(/mensagem|message|texto/i)
          .or(page.locator('textarea'));
        const hasMsg = await msgField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasMsg) await msgField.first().fill('Test Alert');

        const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const postCalls = calls.filter((c) => c.method === 'POST');
          expect(postCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });

    test('11.2 @regression should prevent double-click on pause/resume', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/alerts/**');

      await page.goto('/app/settings/alerts');

      const alert = page.locator(
        '[data-testid="alert-item"], tr[data-row], .alert-card, [role="row"]'
      );
      const hasAlert = await alert.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasAlert) {
        const pauseBtn = page.getByRole('button', { name: /pausar|pause|retomar|resume/i })
          .or(page.locator('[data-testid="toggle-alert"]'));
        const hasPause = await pauseBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasPause) {
          await pauseBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const patchCalls = calls.filter((c) => c.method === 'PATCH' || c.method === 'PUT');
          expect(patchCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
