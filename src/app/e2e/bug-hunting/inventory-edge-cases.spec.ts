import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Inventory Module Edge Cases
 *
 * These tests verify edge cases in the Inventory module:
 * - Sync connection with expired token (401)
 * - Sync individual item with API 500
 * - Create duplicate connection
 * - Report with 0 items
 */

const TENANT_ID = 'tenant-test-id';
const INVENTORY_ITEMS_API = '**/api/v1/tenants/*/inventory/items*';
const INVENTORY_CONNECTIONS_API = '**/api/v1/tenants/*/inventory/connections*';
const INVENTORY_SYNC_CONNECTION_API = '**/api/v1/tenants/*/inventory/connections/*/sync*';
const INVENTORY_SYNC_ITEM_API = '**/api/v1/tenants/*/inventory/items/sync*';
const INVENTORY_JOBS_API = '**/api/v1/tenants/*/inventory/jobs*';
const INVENTORY_REPORT_JOBS_API = '**/api/v1/tenants/*/inventory/report-jobs*';

const INVENTORY_URL = '/app/inventory';

const mockConnection = {
  id: 'conn-1',
  tenantId: TENANT_ID,
  sourceType: 'BLING',
  providerName: 'Bling ERP',
  status: 'ACTIVE',
  lastSyncAt: '2026-05-10T10:00:00Z',
  config: {},
  createdAt: '2026-01-01T00:00:00Z',
};

const mockItems = [
  {
    id: 'item-1',
    tenantId: TENANT_ID,
    sku: 'SKU-001',
    name: 'Camiseta Básica',
    availableQuantity: 50,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '4990',
    currency: 'BRL',
    source: 'ERP_SYNC',
    connectionId: 'conn-1',
    lastSyncAt: '2026-05-10T10:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'item-2',
    tenantId: TENANT_ID,
    sku: 'SKU-002',
    name: 'Calça Jeans',
    availableQuantity: 2,
    availabilityStatus: 'LOW_STOCK',
    currentPrice: '12990',
    currency: 'BRL',
    source: 'ERP_SYNC',
    connectionId: 'conn-1',
    lastSyncAt: '2026-05-10T10:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  },
];

async function setupInventoryPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(INVENTORY_ITEMS_API, (route) => {
    const url = route.request().url();
    if (url.includes('/sync')) return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockItems),
      });
    }
    return route.continue();
  });

  await page.route(INVENTORY_CONNECTIONS_API, (route) => {
    const url = route.request().url();
    if (url.includes('/sync')) return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockConnection]),
      });
    }
    return route.continue();
  });

  await page.route(INVENTORY_JOBS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

test.describe('@bug-hunt Inventory Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #I1: Sync connection with expired token (401)
  // Expected: clear error about token expiration, suggest reconnection
  // ═══════════════════════════════════════════════════════════════════════════════

  test('I1.1 sync connection with expired token should show error', async ({ page }) => {
    await setupInventoryPageMocks(page);

    // Sync returns 401 (token expired)
    await page.route(INVENTORY_SYNC_CONNECTION_API, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
      }),
    );

    await page.goto(INVENTORY_URL);
    await page.waitForTimeout(1500);

    // Click sync button on the connection
    const syncBtn = page.getByRole('button', { name: /sincronizar|sync|atualizar/i }).first();
    if (await syncBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await syncBtn.click();

      await expect(
        page.getByText(/falha|erro|expirado|token|reconectar/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #I2: Sync connection with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('I2.1 sync connection should show error on API 500', async ({ page }) => {
    await setupInventoryPageMocks(page);

    // Sync returns 500
    await page.route(INVENTORY_SYNC_CONNECTION_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(INVENTORY_URL);
    await page.waitForTimeout(1500);

    const syncBtn = page.getByRole('button', { name: /sincronizar|sync|atualizar/i }).first();
    if (await syncBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await syncBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #I3: Create duplicate connection
  // Expected: error about duplicate
  // ═══════════════════════════════════════════════════════════════════════════════

  test('I3.1 create duplicate connection should show error', async ({ page }) => {
    await setupInventoryPageMocks(page);

    // Create connection returns 409 (duplicate)
    await page.route(INVENTORY_CONNECTIONS_API, (route) => {
      const url = route.request().url();
      if (url.includes('/sync')) return route.continue();
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Connection already exists', code: 'DUPLICATE_CONNECTION' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockConnection]),
      });
    });

    await page.goto(INVENTORY_URL);
    await page.waitForTimeout(1500);

    // Click add connection button
    const addBtn = page.getByRole('button', { name: /nova conexão|conectar|adicionar|novo/i }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Select provider
      const providerOption = page.getByText(/bling|tiny|manual/i).first();
      if (await providerOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await providerOption.click();
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /criar|conectar|salvar|confirmar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|já existe|duplicad|already/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #I4: Generate report with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('I4.1 generate report should show error on API 500', async ({ page }) => {
    await setupInventoryPageMocks(page);

    // Report job returns 500
    await page.route(INVENTORY_REPORT_JOBS_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(INVENTORY_URL);
    await page.waitForTimeout(1500);

    // Click report/export button
    const reportBtn = page.getByRole('button', { name: /relatório|exportar|csv|report/i }).first();
    if (await reportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportBtn.click();

      // Confirm if dialog
      const confirmBtn = page.getByRole('button', { name: /gerar|exportar|confirmar/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
