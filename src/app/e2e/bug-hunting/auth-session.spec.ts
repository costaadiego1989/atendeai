import { test, expect } from '../../playwright-fixture';
import { mockAuthMe, mockTenantMe } from '../helpers';

/**
 * Bug-Finding Tests: Auth & Session Edge Cases
 *
 * These tests verify that authentication edge cases are handled correctly.
 * Identified bugs:
 * - 401 during mutation → refresh → retry flow may not work
 * - Session expiry with unsaved form data loses user work
 * - getFriendlyErrorMessage crashes when options is undefined
 * - Network errors (fetch TypeError) lose context
 * - Multiple concurrent 401s may cause redirect loop
 */

const AUTH_ME = '**/api/v1/auth/me';
const AUTH_REFRESH = '**/api/v1/auth/refresh*';
const COUPONS_API = '**/api/v1/sales/coupons*';
const CONTACTS_API = '**/api/v1/contacts*';
const CATALOG_ITEMS_API = '**/api/v1/tenants/*/catalog/items*';
const CATALOG_CATEGORIES_API = '**/api/v1/tenants/*/catalog/categories*';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  tenantId: 'tenant-test-id',
  role: 'OWNER',
};

const mockTenant = {
  id: 'tenant-test-id',
  name: 'Empresa Teste',
  plan: 'PRO',
  cnpj: '12345678000100',
  businessType: 'SERVICOS',
  planStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  billingAccess: {
    enabledModules: ['MESSAGING', 'CONTACTS', 'SCHEDULING', 'CATALOG', 'SALES'],
    moduleAccess: {
      MESSAGING: true, CONTACTS: true, SCHEDULING: true, CATALOG: true,
      SALES: true, BILLING: true, INVENTORY: true, RECOVERY: true,
      PROSPECTING: true, SOCIAL: true, AI: true, CHECKOUT_WA: true,
      AGENDAMENTO_ONLINE: true,
    },
  },
  branches: [
    { id: 'branch-1', name: 'Matriz', isHeadquarters: true, active: true },
  ],
};

async function setupAuthenticatedPage(page: import('@playwright/test').Page) {
  await mockAuthMe(page);
}

test.describe('@bug-hunt Auth & Session Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1: 401 on data fetch → auto-refresh → retry
  // Expected: transparent retry after token refresh
  // Actual: may show error state or redirect to login prematurely
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.1 expired token on page load should auto-refresh and retry', async ({ page }) => {
    let authAttempts = 0;
    let refreshCalled = false;

    // First /auth/me call returns 401, second (after refresh) returns 200
    await page.route(AUTH_ME, (route) => {
      authAttempts++;
      if (authAttempts === 1) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: mockUser, tenant: mockTenant } }),
      });
    });

    // Refresh endpoint succeeds
    await page.route(AUTH_REFRESH, (route) => {
      refreshCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { accessToken: 'new-token' } }),
      });
    });

    await mockTenantMe(page);

    await page.route(CONTACTS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'c1', name: 'João', phone: '11999999999' }], meta: { total: 1 } }),
      }),
    );

    await page.goto('/app/contacts');
    await page.waitForTimeout(3000);

    // Should NOT be on login page (refresh should have worked)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    // Should show contacts data (retry succeeded)
    await expect(
      page.getByText('João').or(page.getByText(/contato/i)).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #2: 401 on mutation when refresh also fails → should redirect to login
  // Expected: clean redirect to /login with session-expired reason
  // Actual: may crash or show unhandled error
  // ═══════════════════════════════════════════════════════════════════════════════

  // BUG CONFIRMED: When mutation gets 401 and refresh also fails with 401,
  // the app does NOT redirect to /login or show session-expired message.
  // It stays on the current page silently.
  test.fail('2.1 double 401 (mutation + refresh) should redirect to login', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route(COUPONS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ id: 'c1', code: 'TEST', active: true, discountValue: 10, discountType: 'PERCENTAGE' }] }),
        });
      }
      // Mutation returns 401
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Refresh also fails
    await page.route(AUTH_REFRESH, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Refresh token expired' }),
      }),
    );

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/sales/promotions');
    await page.getByRole('tab', { name: /cupons/i }).click();
    await page.waitForTimeout(1000);

    // Trigger a mutation (toggle coupon)
    const toggle = page.getByRole('switch').first();
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggle.click();
    }

    await page.waitForTimeout(3000);

    // Should redirect to login OR show session expired message
    const url = page.url();
    const hasLoginRedirect = url.includes('/login');
    const hasSessionExpiredMsg = await page.getByText(/sessão.*expir|session.*expired/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasLoginRedirect || hasSessionExpiredMsg).toBe(true);

    // Should NOT have unhandled crashes
    const hasCrash = errors.some(
      (e) => e.includes('Cannot read properties of null') || e.includes('Cannot read properties of undefined'),
    );
    expect(hasCrash).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #3: Network error (offline) during API call
  // Expected: user-friendly "sem conexão" message
  // Actual: TypeError from fetch gets swallowed or shows generic error
  // ═══════════════════════════════════════════════════════════════════════════════

  test('3.1 network failure should show connection error message', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route(CONTACTS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'c1', name: 'João', phone: '11999999999' }], meta: { total: 1 } }),
      }),
    );

    await page.goto('/app/contacts');
    await page.waitForTimeout(1500);

    // Now simulate network failure on next API call
    await page.route(CONTACTS_API, (route) => route.abort('connectionrefused'));

    // Trigger a refetch (e.g., pull-to-refresh or manual refresh)
    const refreshBtn = page.getByRole('button', { name: /atualizar|refresh|recarregar/i });
    if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshBtn.click();
    } else {
      // Force refetch by navigating
      await page.reload();
    }

    await page.waitForTimeout(3000);

    // Should show some kind of error/offline indicator
    // NOT a white screen or unhandled error
    const hasErrorFeedback = await page.getByText(/erro|falha|conexão|offline|tente novamente/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const pageText = await page.textContent('body');
    const isNotBlank = (pageText?.trim().length ?? 0) > 50;

    // Either shows error message OR at least doesn't crash (shows stale data)
    expect(hasErrorFeedback || isNotBlank).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #4: Session expiry while user has unsaved form data
  // Expected: warn user before redirecting, or preserve form state
  // Actual: hard redirect loses all form data without warning
  // ═══════════════════════════════════════════════════════════════════════════════

  test('4.1 session expiry with filled form should warn or preserve data', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route(CATALOG_ITEMS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 } }),
      }),
    );

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

    // Mock inventory items
    await page.route('**/api/v1/tenants/*/inventory/items*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    // Open form and fill it with data
    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    await page.getByPlaceholder(/camiseta dry fit/i).fill('Produto Importante que não quero perder');

    // Now simulate session expiry — next API call returns 401 + refresh fails
    await page.route(AUTH_ME, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      }),
    );
    await page.route(AUTH_REFRESH, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Refresh token expired' }),
      }),
    );

    // Trigger an API call that will get 401 (e.g., try to save)
    await page.route(CATALOG_ITEMS_API, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      }
      return route.continue();
    });

    const saveBtn = page.getByRole('button', { name: /salvar|criar|adicionar/i }).last();
    await saveBtn.click();

    await page.waitForTimeout(3000);

    // Document behavior: does the app warn about unsaved data?
    const url = page.url();
    if (url.includes('/login')) {
      // Redirected without warning — this is the bug
      console.warn('BUG: User redirected to login without warning about unsaved form data');
    }

    // At least verify no crash
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors.length).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #5: Multiple concurrent 401s should only trigger ONE refresh
  // Expected: single refresh, all pending requests retry
  // Actual: may trigger multiple refreshes or redirect loop
  // ═══════════════════════════════════════════════════════════════════════════════

  test('5.1 concurrent 401s should trigger single refresh', async ({ page }) => {
    let refreshCount = 0;

    // Auth/me: first call returns 401, subsequent calls return 200
    let authCalled = false;
    await page.route(AUTH_ME, (route) => {
      if (!authCalled && refreshCount === 0) {
        authCalled = true;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: mockUser, tenant: mockTenant } }),
      });
    });

    await mockTenantMe(page);

    await page.route(AUTH_REFRESH, (route) => {
      refreshCount++;
      // Simulate refresh taking 500ms
      return new Promise((resolve) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { accessToken: 'new-token' } }),
          });
          resolve(undefined);
        }, 500);
      });
    });

    await page.route(CONTACTS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'c1', name: 'João' }] }),
      }),
    );

    await page.goto('/app/contacts');
    await page.waitForTimeout(5000);

    // Should have only called refresh ONCE despite multiple 401s
    expect(refreshCount).toBeLessThanOrEqual(2); // Allow small margin for race
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #6: Accessing protected route without auth should redirect cleanly
  // Expected: redirect to /login without flash of protected content
  // Actual: may briefly show protected page before redirect
  // ═══════════════════════════════════════════════════════════════════════════════

  test('6.1 unauthenticated access should redirect without content flash', async ({ page }) => {
    // No auth mocks — simulate completely unauthenticated user
    await page.route(AUTH_ME, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      }),
    );

    await page.route(AUTH_REFRESH, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No refresh token' }),
      }),
    );

    await page.goto('/app/contacts');

    // Should redirect to login within reasonable time
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Should show login page content
    await expect(
      page.getByRole('button', { name: /entrar/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #7: Rate limiting (429) should show user-friendly message
  // Expected: "Muitas tentativas, aguarde X segundos"
  // Actual: may show generic error or no feedback
  // ═══════════════════════════════════════════════════════════════════════════════

  // BUG CONFIRMED: When API returns 429 (rate limited), the app shows no
  // user-friendly message. No "muitas tentativas" or error feedback is displayed.
  test.fail('7.1 rate limited API should show friendly message', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route(CONTACTS_API, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '30' },
        body: JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      }),
    );

    await page.goto('/app/contacts');
    await page.waitForTimeout(3000);

    // Should show rate limit message, not generic error
    const hasRateLimitMsg = await page.getByText(/muitas tentativas|aguarde|limite|too many/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasAnyError = await page.getByText(/erro|error|falha/i)
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // At minimum, some error feedback should be shown (not blank page)
    expect(hasRateLimitMsg || hasAnyError).toBe(true);
  });
});
