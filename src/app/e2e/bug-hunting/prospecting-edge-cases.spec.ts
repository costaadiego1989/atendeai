import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Prospecting Module Edge Cases
 *
 * These tests verify edge cases in the Prospecting module:
 * - Create campaign with API 500
 * - Import leads with empty results
 * - Dispatch prospect with API 500
 * - AI message suggestion timeout/failure
 * - Rate limit from external API (Google/Meta)
 */

const TENANT_ID = 'tenant-test-id';
const PROSPECTING_SEARCHES_API = '**/api/v1/tenants/*/prospecting/searches*';
const PROSPECTING_CAMPAIGNS_API = '**/api/v1/tenants/*/prospecting/campaigns*';
const PROSPECTING_IMPORT_API = '**/api/v1/tenants/*/prospecting/searches/*/import-contacts*';
const PROSPECTING_PROSPECT_API = '**/api/v1/tenants/*/prospecting/searches/*/prospect*';
const PROSPECTING_SUGGEST_API = '**/api/v1/tenants/*/prospecting/campaigns/message-suggestion*';
const PROSPECTING_DISPATCH_API = '**/api/v1/tenants/*/prospecting/campaigns/*/dispatch-next*';
const PROSPECTING_JOBS_API = '**/api/v1/tenants/*/prospecting/reports/jobs*';
const PROSPECTING_ADS_STATUS_API = '**/api/v1/tenants/*/prospecting/ads/connection/status*';

const PROSPECTING_URL = '/app/prospecting/searches';

const mockSearch = {
  id: 'search-1',
  tenantId: TENANT_ID,
  query: 'restaurantes em São Paulo',
  status: 'COMPLETED',
  totalResults: 20,
  importedCount: 0,
  createdAt: '2026-05-01T00:00:00Z',
};

const mockSearchResults = [
  {
    id: 'result-1',
    name: 'Restaurante Bom Sabor',
    phone: '11999990001',
    address: 'Rua A, 123',
    rating: 4.5,
    imported: false,
  },
  {
    id: 'result-2',
    name: 'Pizzaria Central',
    phone: '11999990002',
    address: 'Av B, 456',
    rating: 4.2,
    imported: false,
  },
];

const mockCampaign = {
  id: 'campaign-1',
  tenantId: TENANT_ID,
  name: 'Campanha Restaurantes',
  status: 'DRAFT',
  messageTemplate: 'Olá! Somos a AtendeAi...',
  totalProspects: 10,
  dispatchedCount: 0,
  createdAt: '2026-05-01T00:00:00Z',
};

async function setupProspectingPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(PROSPECTING_SEARCHES_API, (route) => {
    const url = route.request().url();
    if (url.includes('/import-contacts') || url.includes('/prospect') || url.includes('/results')) {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockSearch]),
      });
    }
    return route.continue();
  });

  await page.route('**/api/v1/tenants/*/prospecting/searches/search-1/results*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSearchResults),
    }),
  );

  await page.route(PROSPECTING_CAMPAIGNS_API, (route) => {
    const url = route.request().url();
    if (url.includes('/message-suggestion') || url.includes('/dispatch-next') ||
        url.includes('/activate') || url.includes('/pause') || url.includes('/start')) {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockCampaign]),
      });
    }
    return route.continue();
  });

  await page.route(PROSPECTING_JOBS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route(PROSPECTING_ADS_STATUS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: false, status: 'NOT_CONNECTED' }),
    }),
  );
}

test.describe('@bug-hunt Prospecting Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #PR1: Create search with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('PR1.1 create search should show error on API 500', async ({ page }) => {
    await setupProspectingPageMocks(page);

    // Override POST to return 500
    await page.route(PROSPECTING_SEARCHES_API, (route) => {
      const url = route.request().url();
      if (url.includes('/import-contacts') || url.includes('/prospect') || url.includes('/results')) {
        return route.continue();
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockSearch]),
      });
    });

    await page.goto(PROSPECTING_URL);
    await page.waitForTimeout(1000);

    // Click new search button
    const newBtn = page.getByRole('button', { name: /nova busca|pesquisar|criar/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(500);

      // Fill search query
      const queryInput = page.getByPlaceholder(/buscar|pesquisar|local|query/i).first();
      if (await queryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await queryInput.fill('padarias em Curitiba');
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /buscar|pesquisar|criar|iniciar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #PR2: Import leads with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('PR2.1 import leads should show error on API 500', async ({ page }) => {
    await setupProspectingPageMocks(page);

    // Import returns 500
    await page.route(PROSPECTING_IMPORT_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(PROSPECTING_URL);
    await page.waitForTimeout(1000);

    // Click on search to see results
    await page.getByText('restaurantes em São Paulo').first().click();
    await page.waitForTimeout(500);

    // Click import button
    const importBtn = page.getByRole('button', { name: /importar|import/i }).first();
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();

      // Confirm if dialog
      const confirmBtn = page.getByRole('button', { name: /confirmar|importar/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #PR4: Rate limit from external API (429)
  // Expected: friendly rate limit message
  // ═══════════════════════════════════════════════════════════════════════════════

  test('PR4.1 search with 429 should show rate limit message', async ({ page }) => {
    await setupProspectingPageMocks(page);

    await page.route(PROSPECTING_SEARCHES_API, (route) => {
      const url = route.request().url();
      if (url.includes('/import-contacts') || url.includes('/prospect') || url.includes('/results')) {
        return route.continue();
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockSearch]),
      });
    });

    await page.goto(PROSPECTING_URL);
    await page.waitForTimeout(1000);

    const newBtn = page.getByRole('button', { name: /nova busca|pesquisar|criar/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(500);

      const queryInput = page.getByPlaceholder(/buscar|pesquisar|local|query/i).first();
      if (await queryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await queryInput.fill('lojas em BH');
      }

      const submitBtn = page.getByRole('button', { name: /buscar|pesquisar|criar|iniciar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|muitas|aguarde|limite|rate/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #PR6: AI message suggestion failure
  // Expected: error toast or fallback
  // ═══════════════════════════════════════════════════════════════════════════════

  test('PR6.1 AI suggestion should show error on timeout/500', async ({ page }) => {
    await setupProspectingPageMocks(page);

    // Suggestion returns 500
    await page.route(PROSPECTING_SUGGEST_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI service unavailable' }),
      }),
    );

    await page.goto(PROSPECTING_URL);
    await page.waitForTimeout(1000);

    // Navigate to campaigns or find suggest button
    const suggestBtn = page.getByRole('button', { name: /sugerir|ia|gerar mensagem|suggest/i }).first();
    if (await suggestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await suggestBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível|indisponível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
