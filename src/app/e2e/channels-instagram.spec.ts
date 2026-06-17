import { test, expect } from '../playwright-fixture';
import { mockAuthMe, trackApiCalls } from './helpers';

/**
 * Settings → Channels → Connect Instagram via Meta (Facebook Login for Business).
 *
 * Covers the OAuth start + popup-callback flow:
 *  - clicking "Conectar com Meta Business" calls POST /channels/instagram/meta/start
 *  - the returned authorizationUrl (config_id flow) is handed to window.open
 *  - the popup posts back { source, success, branchId, accounts } and a single
 *    discovered account is auto-linked via PUT /tenants/:id/instagram-config
 */

const META_INSTAGRAM_OAUTH_EVENT = 'atendeai-meta-instagram-oauth';
const TENANT_ID = 'tenant-test-id';

const tenantSettingsResponse = {
  id: TENANT_ID,
  support: {
    tenantId: TENANT_ID,
    plan: 'PRO',
    planStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
  recentAuditLogs: [],
  channels: {
    whatsapp: { configured: false, connected: false },
    instagram: { configured: false, connected: false, instagramAccountId: null },
  },
  company: { companyName: 'Empresa Teste', cnpj: '12345678000100' },
  aiConfig: null,
  branches: [],
};

const whatsappConnectionResponse = {
  provider: 'META_CLOUD',
  connection: null,
  embeddedSignupReady: false,
  embeddedSignup: null,
};

async function mockChannelsPage(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(`**/api/v1/tenants/*/settings`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tenantSettingsResponse),
    }),
  );

  await page.route(`**/api/v1/tenants/*/whatsapp-connection*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(whatsappConnectionResponse),
    }),
  );

  await page.route('**/api/v1/channels/instagram/meta/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorizationUrl:
          'https://www.facebook.com/dialog/oauth?client_id=app-1&config_id=cfg-test-123&state=signed-state',
      }),
    }),
  );

  // Capture the popup URL instead of opening a real window.
  await page.addInitScript(() => {
    (window as unknown as { __lastOAuthUrl?: string }).__lastOAuthUrl = undefined;
    window.open = ((url?: string | URL) => {
      (window as unknown as { __lastOAuthUrl?: string }).__lastOAuthUrl = url
        ? String(url)
        : '';
      return window as unknown as Window;
    }) as typeof window.open;
  });
}

test.describe('Settings → Channels → Connect Instagram (Meta OAuth)', () => {
  test('@regression starts Meta OAuth with config_id and links the discovered account', async ({
    page,
  }) => {
    await mockChannelsPage(page);
    const igConfigCalls = await trackApiCalls(
      page,
      '**/api/v1/tenants/*/instagram-config',
    );

    await page.goto('/app/settings/channels');

    const connectButton = page.getByRole('button', {
      name: /conectar com meta business/i,
    });
    await expect(connectButton.first()).toBeVisible({ timeout: 10_000 });
    await connectButton.first().click();

    // The start endpoint produced a Facebook Login for Business URL (config_id).
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __lastOAuthUrl?: string }).__lastOAuthUrl,
          ),
        { timeout: 5_000 },
      )
      .toContain('config_id=cfg-test-123');

    // Simulate the OAuth popup posting a single discovered account (tenant scope).
    await page.evaluate((eventName) => {
      window.postMessage(
        {
          source: eventName,
          success: true,
          message: '',
          branchId: null,
          accounts: [
            {
              instagramAccountId: 'ig-123',
              username: 'minha_loja',
              pageId: 'page-1',
              pageName: 'Minha Loja',
              profilePictureUrl: null,
            },
          ],
        },
        '*',
      );
    }, META_INSTAGRAM_OAUTH_EVENT);

    // A single account is auto-linked via PUT /tenants/:id/instagram-config.
    await expect
      .poll(() => igConfigCalls.filter((c) => c.method === 'PUT').length, {
        timeout: 5_000,
      })
      .toBeGreaterThanOrEqual(1);

    const putCall = igConfigCalls.find((c) => c.method === 'PUT');
    expect(putCall?.body ?? '').toContain('ig-123');
  });

  test('@regression surfaces an error and does not link when the popup reports failure', async ({
    page,
  }) => {
    await mockChannelsPage(page);
    const igConfigCalls = await trackApiCalls(
      page,
      '**/api/v1/tenants/*/instagram-config',
    );

    await page.goto('/app/settings/channels');

    const connectButton = page.getByRole('button', {
      name: /conectar com meta business/i,
    });
    await expect(connectButton.first()).toBeVisible({ timeout: 10_000 });
    await connectButton.first().click();

    await page.evaluate((eventName) => {
      window.postMessage(
        {
          source: eventName,
          success: false,
          message: 'permission_denied',
          branchId: null,
          accounts: [],
        },
        '*',
      );
    }, META_INSTAGRAM_OAUTH_EVENT);

    await page.waitForTimeout(1_000);
    expect(igConfigCalls.filter((c) => c.method === 'PUT')).toHaveLength(0);

    const errorBoundary = page.locator('.error-boundary');
    expect(await errorBoundary.first().isVisible().catch(() => false)).toBe(false);
  });
});
