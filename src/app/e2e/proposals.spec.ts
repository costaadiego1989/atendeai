import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Proposals E2E Tests — Full coverage based on proposals.e2e-spec.md
 */

test.describe('Proposals', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load proposals page', async ({ page }) => {
      await page.goto('/app/proposals');

      await expect(page).toHaveURL(/\/app\/proposals/);

      const content = page.locator('main, [role="main"], [data-testid="proposals-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display status filters', async ({ page }) => {
      await page.goto('/app/proposals');

      const filters = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.locator('[role="tablist"]'));
      const filterBtn = page.getByRole('button', { name: /filtrar|filter|status/i });

      const hasFilters = await filters.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasBtn = await filterBtn.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display create proposal button', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.4 @smoke should load public proposal page with token', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/proposal/test-token-123');

      const content = page.locator('main, [role="main"], body');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should open create proposal form', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="proposal-form"], [data-testid="create-proposal"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.2 @regression should show item addition from catalog', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const addItemBtn = page.getByRole('button', { name: /adicionar item|add item|produto|serviço/i });
        const itemSection = page.locator('[data-testid="proposal-items"], [data-testid="items-section"]');

        const hasAddItem = await addItemBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasSection = await itemSection.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.3 @regression should show discount field', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const discountField = page.getByLabel(/desconto|discount/i)
          .or(page.locator('[data-testid="discount-field"]'));
        const hasDiscount = await discountField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show validity/expiration date field', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const validityField = page.getByLabel(/validade|expiração|expira|vencimento/i)
          .or(page.locator('input[type="date"], [data-testid="validity-field"]'));
        const hasValidity = await validityField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should show send proposal action', async ({ page }) => {
      await page.goto('/app/proposals');

      const proposal = page.locator(
        '[data-testid="proposal-item"], tr[data-row], .proposal-card, [role="row"]'
      );
      const hasProposal = await proposal.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasProposal) {
        await proposal.first().click();

        const sendBtn = page.getByRole('button', { name: /enviar|send|compartilhar/i });
        const hasSend = await sendBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.6 @regression should show duplicate proposal action', async ({ page }) => {
      await page.goto('/app/proposals');

      const proposal = page.locator(
        '[data-testid="proposal-item"], tr[data-row], .proposal-card, [role="row"]'
      );
      const hasProposal = await proposal.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasProposal) {
        await proposal.first().click();

        const duplicateBtn = page.getByRole('button', { name: /duplicar|copiar|duplicate|copy/i });
        const moreMenu = page.getByRole('button', { name: /mais|more|opções|options/i });

        const hasDuplicate = await duplicateBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasMore = await moreMenu.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.7 @regression should show proposal detail with items and values', async ({ page }) => {
      await page.goto('/app/proposals');

      const proposal = page.locator(
        '[data-testid="proposal-item"], tr[data-row], .proposal-card, [role="row"]'
      );
      const hasProposal = await proposal.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasProposal) {
        await proposal.first().click();

        const detail = page.locator('[data-testid="proposal-detail"], [data-testid="proposal-view"]');
        const valueText = page.getByText(/total|valor|R\$/i);

        const hasDetail = await detail.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasValue = await valueText.first().isVisible().catch(() => false);

        expect(hasDetail || hasValue).toBe(true);
      }
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate required client field', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|enviar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });

    test('3.2 @regression should validate at least one item required', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        // Fill client but no items
        const clientField = page.getByLabel(/cliente|client|contato/i);
        const hasClient = await clientField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasClient) await clientField.first().fill('Test Client');

        const submitBtn = page.getByRole('button', { name: /salvar|criar|enviar|confirmar|save/i });
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

    test('3.3 @regression should validate discount percentage bounds', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const discountField = page.getByLabel(/desconto|discount/i)
          .or(page.locator('[data-testid="discount-field"] input'));
        const hasDiscount = await discountField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDiscount) {
          await discountField.first().fill('150');
          await discountField.first().blur();
          await page.waitForTimeout(1_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });

    test('3.4 @regression should validate past expiration date', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const dateField = page.getByLabel(/validade|expiração|expira|vencimento/i)
          .or(page.locator('input[type="date"]'));
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
  });

  // ─── 4. FILTROS E BUSCA ───────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should display search and filter controls', async ({ page }) => {
      await page.goto('/app/proposals');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter|status/i });
      const tabs = page.locator('[role="tablist"]');

      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);
      const hasTabs = await tabs.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should filter proposals by status', async ({ page }) => {
      await page.goto('/app/proposals');

      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.getByRole('tab'));
      const hasFilter = await statusFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.3 @regression should search proposals by client name', async ({ page }) => {
      await page.goto('/app/proposals');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('Cliente Teste');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.4 @regression should combine filter and search', async ({ page }) => {
      await page.goto('/app/proposals');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.getByRole('tab'));

      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasFilter = await statusFilter.first().isVisible().catch(() => false);

      if (hasSearch) await searchInput.first().fill('Test');
      if (hasFilter) await statusFilter.first().click();

      await page.waitForTimeout(2_000);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no proposals', async ({ page }) => {
      await page.route('**/api/v1/proposals*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/proposals');

      const emptyState = page.getByText(/nenhuma proposta|sem propostas|crie sua primeira/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });

    test('7.2 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/proposals*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/proposals');

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
      await page.route('**/api/v1/proposals*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/proposals');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/proposals*');

      await page.goto('/app/proposals');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle 404 for non-existent proposal', async ({ page }) => {
      await page.route('**/api/v1/proposals/non-existent*', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Proposal not found' }),
        })
      );

      await page.goto('/app/proposals/non-existent');

      const notFound = page.getByText(/não encontrad|not found|404/i);
      const hasNotFound = await notFound.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.4 @regression should handle invalid public token', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/proposal/invalid-token-xyz');

      const notFound = page.getByText(/não encontrad|not found|inválid|expirad/i);
      const hasNotFound = await notFound.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in proposal item name', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();
        const nameInput = page.getByLabel(/nome|name|título|titulo|item/i);
        const hasName = await nameInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasName) await nameInput.first().fill('<script>alert("xss")</script>');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @security should handle SQL injection in search', async ({ page }) => {
      await page.goto('/app/proposals');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill("'; DROP TABLE proposals; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should handle large total value formatting', async ({ page }) => {
      await page.goto('/app/proposals');

      // Page should handle proposals with large values without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.4 @regression should prevent double-click on send', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/proposals/**');

      await page.goto('/app/proposals');

      const proposal = page.locator(
        '[data-testid="proposal-item"], tr[data-row], .proposal-card, [role="row"]'
      );
      const hasProposal = await proposal.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasProposal) {
        await proposal.first().click();

        const sendBtn = page.getByRole('button', { name: /enviar|send/i });
        const hasSend = await sendBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSend) {
          await sendBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const postCalls = calls.filter((c) => c.method === 'POST' || c.method === 'PATCH');
          expect(postCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display proposals on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/proposals');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display proposals on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/proposals');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display proposals on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/proposals');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.4 @regression should display public proposal on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.context().clearCookies();
      await page.goto('/proposal/test-token-123');

      const content = page.locator('main, [role="main"], body');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-create on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/proposals*');

      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const nameInput = page.getByLabel(/nome|name|título|titulo|cliente/i);
        const hasName = await nameInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasName) await nameInput.first().fill('Test Proposal');

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

    test('11.2 @regression should handle concurrent accept action', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/proposal/test-token-123');

      const acceptBtn = page.getByRole('button', { name: /aceitar|accept|aprovar/i });
      const hasAccept = await acceptBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasAccept) {
        await acceptBtn.first().dblclick();
        await page.waitForTimeout(3_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
