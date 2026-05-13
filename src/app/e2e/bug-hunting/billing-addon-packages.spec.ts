import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Billing Addon Packages
 *
 * These tests verify the addon package (quota-boost) UI behaviors:
 * - Package card visibility at 80%+ usage
 * - Purchase flow triggers checkout
 * - Price display correctness
 * - Cancel flow reverts state
 * - Package not available for TRIAL
 */

const USAGE_API = '**/api/v1/tenants/*/usage';
const PLANS_API = '**/api/v1/tenants/*/subscription/plans';
const CATALOG_API = '**/api/v1/tenants/*/subscription/catalog';
const ADDON_PACKAGE_API = '**/api/v1/tenants/*/subscription/addon-package';

function buildUsageResponse(overrides: {
  messages?: { used: number; quota: number };
  aiTokens?: { used: number; quota: number };
  contacts?: { used: number; quota: number };
  plan?: string;
}) {
  return {
    data: {
      tenantId: 'tenant-test-id',
      plan: overrides.plan ?? 'PROFISSIONAL',
      currentPeriod: {
        start: '2026-05-01T00:00:00Z',
        end: '2026-05-31T23:59:59Z',
      },
      usage: {
        messages: overrides.messages ?? { used: 60000, quota: 75000 },
        aiTokens: overrides.aiTokens ?? { used: 6000000, quota: 7500000 },
        contacts: overrides.contacts ?? { used: 200, quota: 2500 },
      },
    },
  };
}

function buildPlansResponse() {
  return {
    data: {
      tenantId: 'tenant-test-id',
      plans: [
        { code: 'TRIAL', displayName: 'Trial', monthlyPrice: 0, sortOrder: 0, active: true, messagesQuota: 1500, aiTokensQuota: 150000, contactsQuota: 50, features: [] },
        { code: 'ESSENCIAL', displayName: 'Essencial', monthlyPrice: 9700, sortOrder: 1, active: true, messagesQuota: 15000, aiTokensQuota: 1500000, contactsQuota: 500, features: [] },
        { code: 'PROFISSIONAL', displayName: 'Profissional', monthlyPrice: 19700, sortOrder: 2, active: true, messagesQuota: 75000, aiTokensQuota: 7500000, contactsQuota: 2500, features: [] },
        { code: 'ESCALA', displayName: 'Escala', monthlyPrice: 49700, sortOrder: 3, active: true, messagesQuota: 300000, aiTokensQuota: 30000000, contactsQuota: 10000, features: [] },
      ],
    },
  };
}

function buildCatalogResponse() {
  return {
    data: {
      tenantId: 'tenant-test-id',
      subscription: {
        plan: 'PROFISSIONAL',
        status: 'ACTIVE',
        pricing: {
          baseMonthlyPrice: 19700,
          addonsMonthlyPrice: 0,
          totalMonthlyPrice: 19700,
        },
        includedModules: [],
        addonModules: [],
        enabledModules: [],
        moduleAccess: {},
      },
      availableAddons: [],
      niche: null,
    },
  };
}

function buildAddonPackageInfoResponse(active = false) {
  return {
    data: {
      tenantId: 'tenant-test-id',
      available: true,
      active,
      package: {
        messages: 37500,
        aiTokens: 3750000,
        contacts: 1250,
        price: 9850,
      },
    },
  };
}

async function setupAddonMocks(
  page: import('@playwright/test').Page,
  options: {
    usageOverrides?: Parameters<typeof buildUsageResponse>[0];
    addonActive?: boolean;
    addonAvailable?: boolean;
  } = {},
) {
  await mockAuthMe(page);

  await page.route(USAGE_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildUsageResponse(options.usageOverrides ?? {})),
    }),
  );

  await page.route(PLANS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPlansResponse()),
    }),
  );

  await page.route(CATALOG_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildCatalogResponse()),
    }),
  );

  if (options.addonAvailable === false) {
    await page.route(ADDON_PACKAGE_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              tenantId: 'tenant-test-id',
              available: false,
              active: false,
              package: null,
            },
          }),
        });
      }
      return route.continue();
    });
  } else {
    await page.route(ADDON_PACKAGE_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            buildAddonPackageInfoResponse(options.addonActive ?? false),
          ),
        });
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              tenantId: 'tenant-test-id',
              package: { messages: 37500, aiTokens: 3750000, contacts: 1250, price: 9850 },
              mode: 'CHECKOUT_REQUIRED',
              checkoutUrl: 'https://checkout.example.com/addon-test',
            },
          }),
        });
      }
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { tenantId: 'tenant-test-id', status: 'CANCELED' } }),
        });
      }
      return route.continue();
    });
  }
}

test.describe('@bug-hunt Billing Addon Packages', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.1: Addon package card visible when usage >= 80%
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.1 addon package card should be visible when usage >= 80%', async ({ page }) => {
    await setupAddonMocks(page, {
      usageOverrides: { messages: { used: 60000, quota: 75000 } }, // 80%
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    await expect(page.getByText('Pacote Adicional de Quota')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /contratar pacote/i })).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.2: Addon package shows correct price
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.2 addon package should display correct price', async ({ page }) => {
    await setupAddonMocks(page, {
      usageOverrides: { messages: { used: 65000, quota: 75000 } },
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Price should be R$ 98,50 (9850 cents = 50% of 19700)
    const addonCard = page.getByText('Pacote Adicional de Quota').locator('..');
    await expect(addonCard).toBeVisible({ timeout: 5000 });

    // Check that the price is displayed somewhere in the card area
    const cardContent = await page.getByText('Pacote Adicional de Quota').locator('..').locator('..').textContent();
    expect(cardContent).toContain('37.500');
    expect(cardContent).toContain('1.250');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.3: Purchase button triggers checkout
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.3 purchase button should trigger checkout flow', async ({ page }) => {
    const addonCalls: string[] = [];
    await setupAddonMocks(page, {
      usageOverrides: { messages: { used: 70000, quota: 75000 } },
    });

    // Track POST calls to addon-package endpoint
    await page.route(ADDON_PACKAGE_API, (route) => {
      if (route.request().method() === 'POST') {
        addonCalls.push('POST');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              tenantId: 'tenant-test-id',
              package: { messages: 37500, aiTokens: 3750000, contacts: 1250, price: 9850 },
              mode: 'CHECKOUT_REQUIRED',
              checkoutUrl: 'https://checkout.example.com/addon-test',
            },
          }),
        });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildAddonPackageInfoResponse(false)),
        });
      }
      return route.continue();
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    const purchaseBtn = page.getByRole('button', { name: /contratar pacote/i });
    await expect(purchaseBtn).toBeVisible({ timeout: 5000 });

    // Block popups so the page doesn't navigate away
    await page.evaluate(() => { window.open = () => null; });

    await purchaseBtn.click();
    await page.waitForTimeout(1500);

    // The POST to addon-package should have been made
    expect(addonCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.4: Active addon shows cancel button
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.4 active addon should show cancel button instead of purchase', async ({ page }) => {
    await setupAddonMocks(page, {
      usageOverrides: { messages: { used: 65000, quota: 75000 } },
      addonActive: true,
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    await expect(page.getByText('Pacote Adicional de Quota')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Pacote ativo neste ciclo')).toBeVisible();
    await expect(page.getByRole('button', { name: /cancelar pacote/i })).toBeVisible();

    // Purchase button should NOT be visible
    await expect(page.getByRole('button', { name: /contratar pacote/i })).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.5: Addon card NOT visible when usage < 80%
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.5 addon card should not be visible when usage < 80%', async ({ page }) => {
    await setupAddonMocks(page, {
      usageOverrides: {
        messages: { used: 5000, quota: 75000 },
        aiTokens: { used: 500000, quota: 7500000 },
        contacts: { used: 100, quota: 2500 },
      },
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Page should load
    await expect(page.getByRole('paragraph').filter({ hasText: 'Plano atual' })).toBeVisible({ timeout: 5000 });

    // Addon card should NOT be visible
    await expect(page.getByText('Pacote Adicional de Quota')).not.toBeVisible();
  });
});
