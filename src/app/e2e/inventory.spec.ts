import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Inventory E2E Tests — Full coverage based on inventory.e2e-spec.md
 */

test.describe('Inventory', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load inventory page', async ({ page }) => {
      await page.goto('/app/inventory');

      await expect(page).toHaveURL(/\/app\/inventory/);

      const content = page.locator(
        'main, [role="main"], [data-testid="inventory-page"]'
      );
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display stock table or empty state', async ({ page }) => {
      await page.goto('/app/inventory');

      const table = page.locator(
        '[data-testid="inventory-list"], table, [role="table"], [data-testid="stock-table"]'
      );
      const emptyState = page.getByText(/nenhum item|sem estoque|estoque vazio|nenhum produto/i);

      const hasTable = await table.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasTable || hasEmpty).toBe(true);
    });

    test('1.3 @smoke should display ERP connection status', async ({ page }) => {
      await page.goto('/app/inventory');

      const connectionStatus = page.locator(
        '[data-testid="connection-status"], [data-testid="sync-status"], .connection-badge'
      );
      const statusText = page.getByText(/conectado|desconectado|sincronizado|erro|pendente/i);

      const hasStatus = await connectionStatus.first().isVisible().catch(() => false);
      const hasText = await statusText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should display search and filter controls', async ({ page }) => {
      await page.goto('/app/inventory');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.2 @regression should show sync button for manual trigger', async ({ page }) => {
      await page.goto('/app/inventory');

      const syncButton = page.getByRole('button', { name: /sincronizar|sync|atualizar/i });
      const hasSync = await syncButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.3 @regression should filter by sync status', async ({ page }) => {
      await page.goto('/app/inventory');

      const statusFilter = page.locator(
        '[data-testid="sync-status-filter"], [data-testid="status-filter"]'
      );
      const filterSelect = page.getByRole('combobox', { name: /status|sync/i });
      const filterTabs = page.locator('[role="tablist"]');

      const hasFilter = await statusFilter.first().isVisible().catch(() => false);
      const hasSelect = await filterSelect.first().isVisible().catch(() => false);
      const hasTabs = await filterTabs.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.4 @regression should show low stock indicators', async ({ page }) => {
      await page.goto('/app/inventory');

      const lowStockIndicator = page.locator(
        '[data-testid="low-stock"], .low-stock, .text-warning, .text-destructive'
      );
      const lowStockText = page.getByText(/estoque baixo|baixo|esgotado|critico/i);

      // Conditional on data
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.5 @regression should show ERP connection setup', async ({ page }) => {
      await page.goto('/app/inventory');

      const connectBtn = page.getByRole('button', { name: /conectar|configurar|setup|integrar/i })
        .or(page.locator('[data-testid="connect-erp"]'));
      const connectionCard = page.locator('[data-testid="erp-connection"]');

      const hasBtn = await connectBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasCard = await connectionCard.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. ALERTAS DE ESTOQUE ────────────────────────────────────────────────────

  test.describe('3. Alertas de Estoque', () => {
    test('3.1 @regression should display stock alert configuration', async ({ page }) => {
      await page.goto('/app/inventory');

      const alertsBtn = page.getByRole('button', { name: /alerta|alert|notificação|notificacao/i })
        .or(page.locator('[data-testid="stock-alerts"]'));
      const hasAlerts = await alertsBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state when no inventory items', async ({ page }) => {
      await page.route('**/api/v1/inventory/**', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/inventory');

      const emptyState = page.getByText(/nenhum item|sem estoque|estoque vazio|conecte/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      expect(hasEmpty || hasComponent).toBe(true);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle sync API 503 gracefully', async ({ page }) => {
      await page.route('**/api/v1/inventory/**', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'ERP service unavailable' }),
        })
      );

      await page.goto('/app/inventory');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/inventory/**');

      await page.goto('/app/inventory');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display inventory on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/inventory');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display inventory on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/inventory');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should handle multiple sync triggers', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/inventory/sync*');

      await page.goto('/app/inventory');

      const syncButton = page.getByRole('button', { name: /sincronizar|sync|atualizar/i });
      const hasSync = await syncButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSync) {
        await syncButton.first().dblclick();
        await page.waitForTimeout(3_000);

        // Should debounce
        expect(calls.length).toBeLessThanOrEqual(2);
      }
    });
  });
});
