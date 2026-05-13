import { test, expect } from '../playwright-fixture';
import { CheckoutPage } from './pages';
import {
  mockApiError,
  mockApiResponse,
  mockApiTimeout,
} from './helpers';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const ORDERS_API = `**/api/v1/tenants/${TENANT_ID}/checkout/orders*`;
const ANALYTICS_API = `**/api/v1/tenants/${TENANT_ID}/checkout/analytics*`;

/**
 * Checkout E2E Tests — Operations dashboard for managing orders.
 * Covers: smoke, KPIs, orders tabs, funnel, analytics, abandonment, shipping, reports, errors, responsiveness.
 */

test.describe('Checkout', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. SMOKE TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load checkout page with heading', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();
    });

    test('1.2 @smoke should display page description', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.description).toBeVisible();
    });

    test('1.3 @smoke should display header action buttons', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.abandonmentButton).toBeVisible();
      await expect(checkout.shippingButton).toBeVisible();
    });

    test('1.4 @smoke should display KPI cards', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.kpiOpenOrders).toBeVisible();
      await expect(checkout.kpiAwaitingPayment).toBeVisible();
      await expect(checkout.kpiPendingRevenue).toBeVisible();
      await expect(checkout.kpiPaidRevenue).toBeVisible();
    });

    test('1.5 @smoke should display period filter card', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.reportCardTitle).toBeVisible();
      await expect(checkout.periodToday).toBeVisible();
      await expect(checkout.period7d).toBeVisible();
      await expect(checkout.period30d).toBeVisible();
    });

    test('1.6 @smoke should display logistics strategy card', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.logisticsTitle).toBeVisible();
    });

    test('1.7 @smoke should display funnel section', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.funnelTitle).toBeVisible();
    });

    test('1.8 @smoke should display orders section', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.ordersTitle).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. ORDERS TABS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('2. Orders Tabs', () => {
    test('2.1 @regression should display order status tabs', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.tabAll).toBeVisible();
      await expect(checkout.tabNew).toBeVisible();
      await expect(checkout.tabPreparing).toBeVisible();
      await expect(checkout.tabReady).toBeVisible();
    });

    test('2.2 @regression should switch to New tab', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.tabNew.click();
      await checkout.assertNoCrash();
    });

    test('2.3 @regression should switch to Preparing tab', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.tabPreparing.click();
      await checkout.assertNoCrash();
    });

    test('2.4 @regression should switch to Delivered tab', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.tabDelivered.click();
      await checkout.assertNoCrash();
    });

    test('2.5 @regression should switch to Cancelled tab', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.tabCancelled.click();
      await checkout.assertNoCrash();
    });

    test('2.6 @regression should show orders or empty state', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      const hasOrders = await page.locator('.glass-card').nth(3)
        .isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await checkout.ordersEmptyTitle.isVisible().catch(() => false);
      const hasLoading = await checkout.ordersLoading.isVisible().catch(() => false);

      expect(hasOrders || hasEmpty || hasLoading).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. PERIOD TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('3. Period Toggle', () => {
    test('3.1 @regression should toggle to 7 dias', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.period7d.click();
      await checkout.assertNoCrash();
    });

    test('3.2 @regression should toggle to 30 dias', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.period30d.click();
      await checkout.assertNoCrash();
    });

    test('3.3 @regression should toggle to Hoje', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.periodToday.click();
      await checkout.assertNoCrash();
    });

    test('3.4 @regression should click generate report button', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.generateReportButton.click();
      await checkout.assertNoCrash();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('4. Analytics', () => {
    test('4.1 @regression should display analytics section', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.analyticsTitle).toBeVisible();
    });

    test('4.2 @regression should display products and customers tabs', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.analyticsProductsTab).toBeVisible();
      await expect(checkout.analyticsCustomersTab).toBeVisible();
    });

    test('4.3 @regression should switch to customers tab', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.analyticsCustomersTab.click();
      await checkout.assertNoCrash();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. ABANDONMENT CONFIG
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('5. Abandonment Config', () => {
    test('5.1 @regression should open abandonment config sheet', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openAbandonmentSheet();
      await expect(checkout.abandonmentSaveButton).toBeVisible();
    });

    test('5.2 @regression should display abandonment form fields', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openAbandonmentSheet();

      // Should show message toggle and interval config
      const messageLabel = page.getByText('Mensagem de Abandono');
      await expect(messageLabel).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. SHIPPING CONFIG
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('6. Shipping Config', () => {
    test('6.1 @regression should open shipping config sheet', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openShippingSheet();
      await expect(checkout.shippingModeSelect).toBeVisible();
      await expect(checkout.shippingSaveButton).toBeVisible();
    });

    test('6.2 @regression should display shipping form fields', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openShippingSheet();

      const freightLabel = page.getByText('Modelo de Cobrança de Frete');
      await expect(freightLabel).toBeVisible();

      const deliveryLabel = page.getByText('Janelas de Entrega');
      await expect(deliveryLabel).toBeVisible();
    });

    test('6.3 @regression should close shipping sheet on cancel', async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openShippingSheet();
      await expect(checkout.shippingSheetTitle).toBeVisible();

      await checkout.shippingCancelButton.click();
      await expect(checkout.shippingSheetTitle).toBeHidden({ timeout: 3_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('7. Error Handling', () => {
    test('7.1 @regression should handle orders API error gracefully', async ({ page }) => {
      await page.route(ORDERS_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();
      await checkout.assertNoCrash();
    });

    test('7.2 @regression should handle analytics API timeout gracefully', async ({ page }) => {
      await page.route(ANALYTICS_API, (route) => route.abort('timedout'));

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();
      await checkout.assertNoCrash();
    });

    test('7.3 @regression should handle orders API timeout gracefully', async ({ page }) => {
      await page.route(ORDERS_API, (route) => route.abort('timedout'));

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();
      await checkout.assertNoCrash();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. RESPONSIVENESS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('8. Responsiveness', () => {
    test('8.1 @regression checkout page renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.kpiOpenOrders).toBeVisible();
      await expect(checkout.abandonmentButton).toBeVisible();
    });

    test('8.2 @regression checkout page renders on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.reportCardTitle).toBeVisible();
      await expect(checkout.funnelTitle).toBeVisible();
    });

    test('8.3 @regression checkout page renders on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await expect(checkout.kpiOpenOrders).toBeVisible();
      await expect(checkout.kpiAwaitingPayment).toBeVisible();
      await expect(checkout.kpiPendingRevenue).toBeVisible();
      await expect(checkout.kpiPaidRevenue).toBeVisible();
      await expect(checkout.ordersTitle).toBeVisible();
      await expect(checkout.analyticsTitle).toBeVisible();
    });

    test('8.4 @regression shipping sheet works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.assertPageVisible();

      await checkout.openShippingSheet();
      await expect(checkout.shippingModeSelect).toBeVisible();
      await expect(checkout.shippingSaveButton).toBeVisible();
    });
  });
});
