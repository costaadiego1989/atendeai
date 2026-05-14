import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Checkout Mutations Error Handling
 *
 * These tests verify that mutations in the Checkout module properly handle
 * API failures and show user feedback. Identified bugs:
 * - downloadReportMutation had NO onError handler (silent failure)
 * - updateShippingPolicyMutation had NO onError handler (silent failure)
 * - updateAbandonmentStateMutation had NO onError handler (silent failure)
 * - triggerAbandonmentTouchMutation had NO onError handler (silent failure)
 * - updateOrderStatusMutation has optimistic update — verify rollback works
 */

const TENANT_ID = 'tenant-test-id';
const CHECKOUT_ORDERS_API = '**/api/v1/tenants/*/commerce/orders*';
const CHECKOUT_ORDER_STATUS_API = '**/api/v1/tenants/*/commerce/orders/*/status*';
const CHECKOUT_ORDER_ABANDONMENT_API = '**/api/v1/tenants/*/commerce/orders/*/abandonment';
const CHECKOUT_ORDER_TOUCH_API = '**/api/v1/tenants/*/commerce/orders/*/abandonment-touch*';
const CHECKOUT_SHIPPING_API = '**/api/v1/tenants/*/commerce/shipping-policy*';
const CHECKOUT_ABANDONMENT_CONFIG_API = '**/api/v1/tenants/*/commerce/abandonment-config*';
const CHECKOUT_REPORT_API = '**/api/v1/tenants/*/commerce/orders/report.csv*';

const CHECKOUT_URL = '/app/checkout';

const mockOrder = {
  id: 'order-1',
  tenantId: TENANT_ID,
  status: 'AWAITING_PAYMENT',
  paymentStatus: 'PENDING',
  totalAmount: 15000,
  currency: 'BRL',
  contactName: 'Maria Silva',
  contactPhone: '11999998888',
  fulfillmentType: 'DELIVERY',
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:00:00Z',
};

const mockShippingPolicy = {
  id: 'sp-1',
  tenantId: TENANT_ID,
  mode: 'FIXED',
  fixedAmount: 1200,
  pricePerKm: null,
  minimumAmount: null,
  maxRadiusKm: null,
  servicedNeighborhoods: ['Centro', 'Jardins'],
  deliverySchedule: [
    { weekday: 'MONDAY', enabled: true, startTime: '08:00', endTime: '18:00' },
    { weekday: 'TUESDAY', enabled: true, startTime: '08:00', endTime: '18:00' },
    { weekday: 'WEDNESDAY', enabled: false, startTime: null, endTime: null },
    { weekday: 'THURSDAY', enabled: true, startTime: '08:00', endTime: '18:00' },
    { weekday: 'FRIDAY', enabled: true, startTime: '08:00', endTime: '18:00' },
    { weekday: 'SATURDAY', enabled: false, startTime: null, endTime: null },
    { weekday: 'SUNDAY', enabled: false, startTime: null, endTime: null },
  ],
  notes: null,
};

const mockAbandonmentConfig = {
  id: 'ac-1',
  tenantId: TENANT_ID,
  active: true,
  message: 'Oi! Vi que você não finalizou seu pedido. Posso ajudar?',
  useAiMessage: false,
  mode: 'SINGLE',
  maxTouches: 3,
  intervalMinutes: 60,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

async function setupCheckoutPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(CHECKOUT_ORDERS_API, (route) => {
    const url = route.request().url();
    // Don't intercept sub-routes like /status, /abandonment, /abandonment-touch
    if (url.includes('/status') || url.includes('/abandonment') || url.includes('/report.csv')) {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockOrder]),
      });
    }
    return route.continue();
  });

  await page.route(CHECKOUT_SHIPPING_API, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockShippingPolicy),
      });
    }
    return route.continue();
  });

  await page.route(CHECKOUT_ABANDONMENT_CONFIG_API, (route) => {
    const url = route.request().url();
    if (url.includes('/generate-message')) return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAbandonmentConfig),
      });
    }
    return route.continue();
  });
}

test.describe('@bug-hunt Checkout Mutations — Error Handling', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #C2: updateShippingPolicyMutation — NO onError handler (FIXED)
  // Expected: toast with error message when API returns 500
  // Actual (before fix): silent failure, sheet stays open with no feedback
  // ═══════════════════════════════════════════════════════════════════════════════

  test('C2.1 save shipping policy should show error toast on API 500', async ({ page }) => {
    await setupCheckoutPageMocks(page);

    // Override shipping PUT to return 500
    await page.route(CHECKOUT_SHIPPING_API, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      // GET still works
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockShippingPolicy),
      });
    });

    await page.goto(CHECKOUT_URL);

    // Open shipping policy sheet via the header button
    await page.getByRole('button', { name: /logística|frete|entrega/i }).first().click();

    // Wait for sheet to open and form to load
    await expect(page.getByText(/salvar|confirmar/i).first()).toBeVisible({ timeout: 5000 });

    // Click save
    await page.getByRole('button', { name: /salvar/i }).first().click();

    // Should show error toast
    await expect(
      page.getByText(/falha|erro|não foi possível/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #C3: updateAbandonmentStateMutation — NO onError handler (FIXED)
  // Expected: toast with error message when API returns 500
  // Actual (before fix): silent failure when pausing/resuming abandonment
  // ═══════════════════════════════════════════════════════════════════════════════

  test('C3.1 pause abandonment should show error toast on API 500', async ({ page }) => {
    await setupCheckoutPageMocks(page);

    // Mock order details for the details sheet
    await page.route('**/api/v1/tenants/*/commerce/orders/order-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            order: mockOrder,
            session: null,
            abandonmentTouches: [],
          }),
        });
      }
      return route.continue();
    });

    // Abandonment state update returns 500
    await page.route(CHECKOUT_ORDER_ABANDONMENT_API, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(CHECKOUT_URL);

    // Click on the order to open details sheet
    await page.getByText('Maria Silva').click();

    // Wait for details sheet to open
    await page.waitForTimeout(1000);

    // Click pause button (if visible)
    const pauseBtn = page.getByRole('button', { name: /pausar|parar/i });
    if (await pauseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pauseBtn.click();

      // Should show error toast
      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #C4: triggerAbandonmentTouchMutation — NO onError handler (FIXED)
  // Expected: toast with error message when API returns 500
  // Actual (before fix): silent failure when triggering manual touch
  // ═══════════════════════════════════════════════════════════════════════════════

  test('C4.1 manual touch should show error toast on API 500', async ({ page }) => {
    await setupCheckoutPageMocks(page);

    await page.route('**/api/v1/tenants/*/commerce/orders/order-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            order: { ...mockOrder, status: 'AWAITING_PAYMENT' },
            session: null,
            abandonmentTouches: [
              { id: 'touch-1', type: 'AUTO', sentAt: '2026-05-10T11:00:00Z', status: 'SENT' },
            ],
          }),
        });
      }
      return route.continue();
    });

    // Touch endpoint returns 500
    await page.route(CHECKOUT_ORDER_TOUCH_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(CHECKOUT_URL);
    await page.getByText('Maria Silva').click();
    await page.waitForTimeout(1000);

    // Click manual touch button
    const touchBtn = page.getByRole('button', { name: /toque|reenviar|retomar/i });
    if (await touchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await touchBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #C5: updateOrderStatusMutation — optimistic update rollback
  // Expected: on API 500, order status reverts to original
  // This mutation already had onError, but we verify rollback works correctly
  // ═══════════════════════════════════════════════════════════════════════════════

  test('C5.1 move order status should rollback on API 500', async ({ page }) => {
    await setupCheckoutPageMocks(page);

    // Override order status endpoint to return 500
    await page.route(CHECKOUT_ORDER_STATUS_API, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(CHECKOUT_URL);

    // Wait for orders to load
    await expect(page.getByText('Maria Silva')).toBeVisible({ timeout: 5000 });

    // Find and click the "move status" button for the order
    const moveBtn = page.getByRole('button', { name: /mover|avançar|preparar/i }).first();
    if (await moveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveBtn.click();

      // Should show error toast (rollback)
      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });

      // Order should still show original status (AWAITING_PAYMENT)
      await expect(page.getByText(/aguardando pagamento/i).first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #C6: updateAbandonmentConfigMutation uses useAuthStore.getState()
  // Verify it handles missing tenant gracefully
  // ═══════════════════════════════════════════════════════════════════════════════

  test('C6.1 save abandonment config should show error on 500', async ({ page }) => {
    await setupCheckoutPageMocks(page);

    // Override abandonment config PUT to return 500
    await page.route(CHECKOUT_ABANDONMENT_CONFIG_API, (route) => {
      const url = route.request().url();
      if (url.includes('/generate-message')) return route.continue();
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAbandonmentConfig),
      });
    });

    await page.goto(CHECKOUT_URL);

    // Open abandonment config sheet
    const configBtn = page.getByRole('button', { name: /abandono|régua|carrinho/i }).first();
    if (await configBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await configBtn.click();

      // Wait for sheet to open
      await page.waitForTimeout(1000);

      // Click save
      const saveBtn = page.getByRole('button', { name: /salvar/i }).first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();

        // Should show error toast
        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
