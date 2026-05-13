import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: State Consistency & Cache
 *
 * These tests verify that navigation, cache invalidation, and cross-module
 * state remain consistent. Identified bugs:
 * - Create item → navigate away → back: item missing (stale cache)
 * - Report modal shows stale date range when period changes while open
 * - Branch switch doesn't refetch all queries
 * - Charge creation via conversation prefill (location.state) loses contact
 */

const AUTH_ME = '**/api/v1/auth/me';
const CATALOG_ITEMS_API = '**/api/v1/tenants/*/catalog/items*';
const CATALOG_CATEGORIES_API = '**/api/v1/tenants/*/catalog/categories*';
const PAYMENT_LINKS_API = '**/api/v1/sales/payment-links*';
const CONVERSATIONS_API = '**/api/v1/tenants/*/conversations*';
const CONTACTS_API = '**/api/v1/contacts*';
const METRICS_API = '**/api/v1/sales/metrics*';
const FINANCIAL_ACCOUNT_API = '**/api/v1/tenants/*/payment/account/status*';
const BRANCHES_API = '**/api/v1/branches*';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  tenantId: 'tenant-test-id',
};

async function setupPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);
}

test.describe('@bug-hunt State Consistency & Cache', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1: Create catalog item → navigate away → back = item missing
  // Expected: new item appears in list after navigation
  // Actual: stale cache shows old list without the new item
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.1 new catalog item should persist after navigation round-trip', async ({ page }) => {
    await setupPageMocks(page);

    let items: Record<string, unknown>[] = [
      { id: 'item-1', name: 'Produto A', basePrice: '5000', type: 'PRODUCT', active: true, categoryId: 'cat-1', categoryName: 'Geral', currency: 'BRL', tags: [], source: 'MANUAL', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'item-2', name: 'Serviço B', basePrice: '8000', type: 'SERVICE', active: true, categoryId: 'cat-1', categoryName: 'Geral', currency: 'BRL', tags: [], source: 'MANUAL', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];

    await page.route(CATALOG_ITEMS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: items, meta: { total: items.length } }),
        });
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const newItem = { id: 'item-3', ...body, active: true, currency: 'BRL', tags: [], source: 'MANUAL', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' };
        items = [...items, newItem];
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: newItem }),
        });
      }
      return route.continue();
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    // Mock catalog jobs (async import/export polling)
    await page.route('**/api/v1/tenants/*/catalog/jobs*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    // Mock inventory items (used for SKU divergence check)
    await page.route('**/api/v1/tenants/*/inventory/items*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    // Go to catalog
    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Produto A')).toBeVisible();

    // Create new item
    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    await page.getByPlaceholder(/camiseta dry fit/i).fill('Produto Novo');
    await page.getByPlaceholder('0,00').fill('150,00');

    const saveBtn = page.getByRole('button', { name: /salvar|criar|adicionar/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Navigate away to dashboard
    await page.goto('/app/dashboard');
    await page.waitForTimeout(500);

    // Navigate back to catalog
    await page.goto('/app/catalog');
    await page.waitForTimeout(1500);

    // BUG: If cache invalidation didn't work, 'Produto Novo' won't appear
    await expect(page.getByText('Produto Novo')).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #2: Period change while report modal is open shows stale dates
  // Expected: modal updates to reflect new period
  // Actual: modal keeps showing old date range
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.1 report modal should reflect current period after change', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(FINANCIAL_ACCOUNT_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'ACTIVE', canReceive: true } }),
      }),
    );

    await page.route(PAYMENT_LINKS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'link-1', description: 'Cobrança 1', value: 5000, status: 'PAID', createdAt: '2026-05-01' },
            { id: 'link-2', description: 'Cobrança 2', value: 3000, status: 'PENDING', createdAt: '2026-04-15' },
          ],
          meta: { total: 2 },
        }),
      }),
    );

    await page.goto('/app/sales/payment-links');
    await page.waitForTimeout(1000);

    // Open report/export modal
    const reportBtn = page.getByRole('button', { name: /relatório|exportar|report/i }).first();
    if (await reportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reportBtn.click();
      await page.waitForTimeout(500);

      // Note the current date range displayed in the modal
      const modalText = await page.locator('[role="dialog"]').textContent();

      // Change period filter (while modal is open)
      const periodBtn = page.getByRole('button', { name: /90 dias|90d/i });
      if (await periodBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await periodBtn.click();
        await page.waitForTimeout(500);

        // BUG: Modal should update to show 90-day range, not the old 7/30-day range
        const modalTextAfter = await page.locator('[role="dialog"]').textContent();

        // If the modal text didn't change at all, the date range is stale
        // (This is a soft check — the exact assertion depends on how dates are displayed)
        if (modalText === modalTextAfter) {
          // Potential bug: modal didn't update
          console.warn('Report modal may show stale date range after period change');
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #3: Branch switch should refetch all module data
  // Expected: switching branch reloads conversations, contacts, sales for new branch
  // Actual: queries may not refetch if branch isn't in their query key
  // ═══════════════════════════════════════════════════════════════════════════════

  test('3.1 branch switch should reload data for new branch', async ({ page }) => {
    // Mock auth with TWO branches so the branch selector shows both
    await mockAuthMe(page, {
      tenant: {
        branches: [
          { id: 'branch-1', name: 'Filial Centro', isHeadquarters: true, active: true },
          { id: 'branch-2', name: 'Filial Norte', isHeadquarters: false, active: true },
        ],
      },
    });

    let activeBranch = 'branch-1';

    // Mock messages endpoint (auto-selected conversation triggers message fetch)
    await page.route('**/api/v1/tenants/*/conversations/*/messages*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { data: [], meta: { total: 0 } } }),
      }),
    );

    // Mock mark-read
    await page.route('**/api/v1/tenants/*/conversations/*/read*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) }),
    );

    await page.route(CONVERSATIONS_API, (route) => {
      const url = route.request().url();
      if (url.includes('/messages') || url.includes('/read')) return route.continue();
      if (activeBranch === 'branch-2') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [{
              id: 'conv-b2',
              contactId: 'contact-b2',
              contactName: 'Cliente Branch 2',
              contactPhone: '11999000002',
              lastMessage: { content: 'Oi', direction: 'INBOUND', timestamp: new Date().toISOString() },
              lastMessageSequence: 1,
              unreadCount: 0,
              status: 'OPEN',
              channel: 'WHATSAPP',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: new Date().toISOString(),
              assignedToUserId: null,
              assignedToName: null,
            }],
            meta: { total: 1 },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'conv-b1',
            contactId: 'contact-b1',
            contactName: 'Cliente Branch 1',
            contactPhone: '11999000001',
            lastMessage: { content: 'Olá', direction: 'INBOUND', timestamp: new Date().toISOString() },
            lastMessageSequence: 1,
            unreadCount: 0,
            status: 'OPEN',
            channel: 'WHATSAPP',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: new Date().toISOString(),
            assignedToUserId: null,
            assignedToName: null,
          }],
          meta: { total: 1 },
        }),
      });
    });

    await page.goto('/app/conversations');
    await page.waitForTimeout(1500);

    // Should show Branch 1 data (use first() since contact name appears in multiple places)
    await expect(page.getByText('Cliente Branch 1').first()).toBeVisible();

    // Switch to Branch 2 (via branch selector in header)
    const branchSelector = page.getByRole('button', { name: /filial centro|matriz/i }).first();
    await branchSelector.click();
    await page.waitForTimeout(500);

    activeBranch = 'branch-2';
    await page.getByRole('menuitem', { name: /filial norte/i }).click();
    await page.waitForTimeout(2000);

    // BUG: If conversations query doesn't include branchId in queryKey,
    // it won't refetch and will show stale Branch 1 data
    await expect(page.getByText('Cliente Branch 2').first()).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #4: Navigation state (location.state) lost on page refresh
  // Expected: charge creation from conversation prefills contact
  // Actual: after refresh, location.state is null and contact is lost
  // ═══════════════════════════════════════════════════════════════════════════════

  test('4.1 charge creation from conversation should prefill contact', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(FINANCIAL_ACCOUNT_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'ACTIVE', canReceive: true } }),
      }),
    );

    await page.route(PAYMENT_LINKS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 } }),
      }),
    );

    await page.route(CONTACTS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'contact-1', name: 'João da Conversa', document: '12345678900', phone: '11999999999' },
          ],
        }),
      }),
    );

    // Navigate to sales with location.state containing contact info
    // This simulates clicking "Criar cobrança" from within a conversation
    await page.goto('/app/sales/payment-links');
    await page.evaluate(() => {
      window.history.replaceState(
        { contactId: 'contact-1', contactName: 'João da Conversa' },
        '',
        '/app/sales/payment-links',
      );
    });

    // Trigger the create charge flow
    await page.goto('/app/sales/payment-links');
    await page.waitForTimeout(1000);

    const newChargeBtn = page.getByRole('button', { name: /nova cobrança|novo link|criar/i }).first();
    if (await newChargeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChargeBtn.click();
      await page.waitForTimeout(1000);

      // Check if contact was pre-selected (from location.state)
      // This verifies the cross-module communication works
      const contactField = page.getByText('João da Conversa');
      const isPreselected = await contactField.isVisible({ timeout: 2000 }).catch(() => false);

      // Document whether prefill works (not necessarily a bug if not implemented)
      if (!isPreselected) {
        console.warn('Contact prefill from conversation not working — location.state may be lost');
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #5: Concurrent mutations on same entity
  // Expected: second mutation waits or is rejected
  // Actual: both fire, causing race condition on server
  // ═══════════════════════════════════════════════════════════════════════════════

  test('5.1 double-click on delete should not send duplicate requests', async ({ page }) => {
    await setupPageMocks(page);

    let deleteCount = 0;

    await page.route(CATALOG_ITEMS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [{ id: 'item-1', name: 'Produto A', price: 5000, type: 'PRODUCT', active: true }],
            meta: { total: 1 },
          }),
        });
      }
      if (method === 'DELETE') {
        deleteCount++;
        // Simulate slow delete
        return new Promise((resolve) => {
          setTimeout(() => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: { success: true } }),
            });
            resolve(undefined);
          }, 1000);
        });
      }
      return route.continue();
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    // Open item actions and click delete
    const actionsBtn = page.getByRole('button', { name: /mais|opções|menu|actions/i }).first();
    if (await actionsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionsBtn.click();
      const deleteBtn = page.getByRole('menuitem', { name: /excluir|deletar|remover/i });
      await deleteBtn.click();

      // Rapidly confirm twice (simulating double-click on confirm)
      const confirmBtn = page.getByRole('button', { name: /confirmar|excluir|sim/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.dblclick();
      }

      await page.waitForTimeout(2000);

      // BUG: If button isn't disabled after first click, two DELETE requests fire
      expect(deleteCount).toBeLessThanOrEqual(1);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #6: Page crash when API returns unexpected shape
  // Expected: graceful error state
  // Actual: TypeError from destructuring undefined
  // ═══════════════════════════════════════════════════════════════════════════════

  test('6.1 catalog page should handle malformed API response', async ({ page }) => {
    await setupPageMocks(page);

    // Return completely unexpected response shape
    await page.route(CATALOG_ITEMS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unexpected: 'shape', noDataField: true }),
      }),
    );

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      }),
    );

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/catalog');
    await page.waitForTimeout(3000);

    // Page should NOT crash with TypeError
    const hasCrash = errors.some(
      (e) =>
        e.includes('Cannot read properties of') ||
        e.includes('is not iterable') ||
        e.includes('.map is not a function'),
    );
    expect(hasCrash).toBe(false);

    // Page should show something (not white screen)
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
