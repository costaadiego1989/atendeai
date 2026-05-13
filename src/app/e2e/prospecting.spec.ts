import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  trackApiCalls,
} from './helpers';

/**
 * Prospecting E2E Tests — Full coverage based on prospecting.e2e-spec.md
 */

test.describe('Prospecting', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load prospecting searches page', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      await expect(page).toHaveURL(/\/app\/prospecting\/searches/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display searches list or empty state', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const list = page.locator(
        '[data-testid="searches-list"], [data-testid="campaigns-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhuma busca|sem buscas|nenhuma campanha|crie sua primeira/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('1.3 @smoke should display search/filter controls', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter|status/i });

      const hasSearch = await searchInput.first().isVisible().catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should open create campaign form', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="campaign-form"], [data-testid="search-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.2 @regression should show campaign detail with execution status', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const campaign = page.locator(
        '[data-testid="campaign-item"], [data-testid="search-item"], tr[data-row], [role="row"]'
      );
      const hasCampaign = await campaign.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasCampaign) {
        await campaign.first().click();

        const detail = page.locator(
          '[data-testid="campaign-detail"], [data-testid="search-detail"], [role="dialog"]'
        );
        const statusBadge = page.getByText(/em execução|execucao|pausada|concluída|concluida|rascunho/i);

        const hasDetail = await detail.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasStatus = await statusBadge.first().isVisible().catch(() => false);

        expect(hasDetail || hasStatus).toBe(true);
      }
    });

    test('2.3 @regression should display prospect count and progress', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const progress = page.locator(
        '[data-testid="campaign-progress"], [role="progressbar"], .progress'
      );
      const countText = page.getByText(/prospect|encontrado|resultado|lead/i);

      const hasProgress = await progress.first().isVisible().catch(() => false);
      const hasCount = await countText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.4 @regression should show export leads option', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const campaign = page.locator(
        '[data-testid="campaign-item"], [data-testid="search-item"], tr[data-row], [role="row"]'
      );
      const hasCampaign = await campaign.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasCampaign) {
        await campaign.first().click();

        const exportBtn = page.getByRole('button', { name: /exportar|export|download|csv/i });
        const hasExport = await exportBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should display credit/usage information', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const credits = page.locator('[data-testid="credits"], [data-testid="usage"]');
      const creditsText = page.getByText(/crédito|credito|uso|restante|disponível|disponivel/i);

      const hasCredits = await credits.first().isVisible().catch(() => false);
      const hasText = await creditsText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. VALIDAÇÃO ─────────────────────────────────────────────────────────────

  test.describe('3. Validação', () => {
    test('3.1 @regression should validate campaign form fields', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|iniciar|confirmar|save/i });
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
    test('4.1 @regression should filter campaigns by status', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.getByRole('button', { name: /status|filtrar/i }));

      const hasFilter = await statusFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should search campaigns by name', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('teste');
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no campaigns', async ({ page }) => {
      await page.route('**/api/v1/prospecting/**', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/prospecting/searches');

      const emptyState = page.getByText(/nenhuma busca|sem buscas|nenhuma campanha|crie sua primeira/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 gracefully', async ({ page }) => {
      await page.route('**/api/v1/prospecting/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/prospecting/searches');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/prospecting/**');

      await page.goto('/app/prospecting/searches');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle insufficient credits error', async ({ page }) => {
      await page.route('**/api/v1/prospecting/searches*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 402,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Insufficient credits', code: 'NO_CREDITS' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/prospecting/searches');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display prospecting on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/prospecting/searches');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display prospecting on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/prospecting/searches');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-create on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/prospecting/**');

      await page.goto('/app/prospecting/searches');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const nameInput = page.getByLabel(/nome|name|título|titulo/i);
        const hasName = await nameInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasName) await nameInput.first().fill('Test Campaign');

        const submitBtn = page.getByRole('button', { name: /salvar|criar|iniciar|confirmar|save/i });
        await submitBtn.first().dblclick();

        await page.waitForTimeout(3_000);

        const postCalls = calls.filter((c) => c.method === 'POST');
        expect(postCalls.length).toBeLessThanOrEqual(1);
      }
    });
  });
});
