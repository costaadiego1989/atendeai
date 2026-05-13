import { test, expect } from '../../playwright-fixture';
import { mockTenantMe } from '../helpers';

const AUTH_ME = '**/api/v1/auth/me';
const TENANT_ID = 'tenant-test-id';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  tenantId: TENANT_ID,
  role: 'OWNER',
};

const mockTenant = {
  id: TENANT_ID,
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

test('diagnostic: correct auth/me format with user+tenant', async ({ page }) => {
  // Mock auth/me with correct format: { data: { user, tenant } }
  await page.route(AUTH_ME, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user: mockUser, tenant: mockTenant } }),
    }),
  );
  await mockTenantMe(page);

  await page.route('**/api/v1/sales/promotions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    }),
  );
  await page.route('**/api/v1/sales/coupons*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    }),
  );

  await page.goto('/app/sales/promotions');
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('FINAL URL:', url);
  const tabs = await page.locator('[role="tab"]').all();
  console.log('TABS found:', tabs.length);
  for (const tab of tabs) {
    console.log('  TAB:', await tab.textContent());
  }
});
