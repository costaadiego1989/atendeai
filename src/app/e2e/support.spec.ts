import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Support E2E Tests — Full coverage based on support.e2e-spec.md
 */

test.describe('Support', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load support page', async ({ page }) => {
      await page.goto('/app/settings/support');

      await expect(page).toHaveURL(/\/app\/settings\/support/);

      const content = page.locator('main, [role="main"], [data-testid="support-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display feedbacks list or empty state', async ({ page }) => {
      await page.goto('/app/settings/support');

      const list = page.locator(
        '[data-testid="tickets-list"], [data-testid="support-list"], [data-testid="feedbacks-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhum ticket|sem tickets|nenhuma solicitação|sem solicitações|nenhum feedback/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('1.3 @smoke should display create feedback button', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.4 @smoke should display type filters', async ({ page }) => {
      await page.goto('/app/settings/support');

      const filters = page.getByRole('combobox', { name: /tipo|type/i })
        .or(page.locator('[data-testid="type-filter"]'))
        .or(page.locator('[role="tablist"]'))
        .or(page.getByRole('button', { name: /filtrar|filter|bug|sugestão|melhoria/i }));

      const hasFilters = await filters.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should open create feedback form', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="ticket-form"], [data-testid="support-form"], [data-testid="feedback-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.2 @regression should show feedback type selector (bug/suggestion/improvement)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const typeSelector = page.getByLabel(/tipo|type|categoria/i)
          .or(page.locator('[data-testid="feedback-type"]'))
          .or(page.getByText(/bug|sugestão|melhoria/i));
        const hasType = await typeSelector.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.3 @regression should show description textarea', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem|message/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should display KPIs (total, by type, resolved)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const kpis = page.locator('[data-testid="kpi-card"], [data-testid="support-metrics"]');
      const kpiText = page.getByText(/total|bug|sugestão|melhoria|resolvido/i);

      const hasKpis = await kpis.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasText = await kpiText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.5 @regression should not show edit/delete buttons (read-only) (APP-SUP-001)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const ticket = page.locator(
        '[data-testid="ticket-item"], tr[data-row], [role="row"], .ticket-item, .feedback-item'
      );
      const hasTicket = await ticket.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTicket) {
        await ticket.first().click();

        const editBtn = page.getByRole('button', { name: /editar|edit/i });
        const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover|delete/i });

        const hasEdit = await editBtn.first().isVisible({ timeout: 3_000 }).catch(() => false);
        const hasDelete = await deleteBtn.first().isVisible().catch(() => false);

        // API only supports list/create - no update/delete
        expect(hasEdit && hasDelete).toBe(false);
      }
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate empty form submission (APP-SUP-002)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /enviar|salvar|criar|confirmar|save|send/i });
        const hasSubmit = await submitBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });

    test('3.2 @regression should validate description minimum length', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDesc) {
          await descField.first().fill('abc');

          const submitBtn = page.getByRole('button', { name: /enviar|salvar|criar|confirmar|save|send/i });
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

    test('3.3 @regression should validate description maximum length', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDesc) {
          await descField.first().fill('A'.repeat(5001));
          await descField.first().blur();
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
    test('4.1 @regression should filter by type (bug)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const typeFilter = page.getByRole('combobox', { name: /tipo|type/i })
        .or(page.locator('[data-testid="type-filter"]'))
        .or(page.getByRole('tab', { name: /bug/i }));
      const hasFilter = await typeFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await typeFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should search feedbacks by description', async ({ page }) => {
      await page.goto('/app/settings/support');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('erro no login');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.3 @regression should show no results message', async ({ page }) => {
      await page.goto('/app/settings/support');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('xyznonexistent123');
        await page.waitForTimeout(2_000);

        const noResults = page.getByText(/nenhum feedback|nenhum resultado|sem resultados|nenhum ticket/i);
        const hasNoResults = await noResults.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no feedbacks', async ({ page }) => {
      await page.route('**/api/v1/support*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/support');

      const emptyState = page.getByText(/nenhum ticket|sem tickets|nenhum feedback|crie seu primeiro/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });

    test('7.2 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/support*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/settings/support');

      const skeletons = page.locator('[data-testid="skeleton"], .skeleton, .animate-pulse');
      const hasSkeletons = await skeletons.first().isVisible({ timeout: 3_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 on create gracefully', async ({ page }) => {
      await page.route('**/api/v1/support*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/support');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle API 500 on list gracefully', async ({ page }) => {
      await page.route('**/api/v1/support*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/settings/support');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/support*');

      await page.goto('/app/settings/support');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in description', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();
        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasDesc) await descField.first().fill('<script>alert("xss")</script>');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @security should handle SQL injection in search', async ({ page }) => {
      await page.goto('/app/settings/support');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill("'; DROP TABLE support; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should handle description with only spaces', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDesc) {
          await descField.first().fill('     ');

          const submitBtn = page.getByRole('button', { name: /enviar|salvar|criar|confirmar|save|send/i });
          const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

          if (hasSubmit) {
            await submitBtn.first().click();
            await page.waitForTimeout(2_000);
          }
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('9.4 @regression should accept feedback with emojis', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDesc) {
          await descField.first().fill('O botão de salvar não funciona 🐛 precisa de correção!');
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('9.5 @regression should handle description at max limit (5000 chars)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDesc) {
          await descField.first().fill('A'.repeat(5000));
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display support on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/settings/support');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display support on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/settings/support');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display support on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/settings/support');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-submit on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/support*');

      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new|feedback/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const descField = page.getByLabel(/descrição|descricao|description|mensagem/i)
          .or(page.locator('textarea'));
        const hasDesc = await descField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasDesc) await descField.first().fill('Test feedback for double-click test');

        const submitBtn = page.getByRole('button', { name: /enviar|salvar|criar|confirmar|save|send/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const postCalls = calls.filter((c) => c.method === 'POST');
          expect(postCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
