import { Page, Route } from '@playwright/test';

/**
 * Helper to mock API responses for E2E tests.
 * Provides common patterns for intercepting and mocking API calls.
 */

export type MockResponseOptions = {
  status?: number;
  body?: Record<string, unknown> | unknown[];
  delay?: number;
  headers?: Record<string, string>;
};

/**
 * Mock a specific API endpoint with a custom response.
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string,
  options: MockResponseOptions = {},
) {
  const { status = 200, body = {}, delay = 0, headers = {} } = options;

  await page.route(urlPattern, async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers,
    });
  });
}

/**
 * Mock API to return an error response.
 */
export async function mockApiError(
  page: Page,
  urlPattern: string,
  status: number,
  error: string,
  code?: string,
) {
  await mockApiResponse(page, urlPattern, {
    status,
    body: { error, code: code ?? `ERROR_${status}` },
  });
}

/**
 * Mock API to simulate network timeout.
 */
export async function mockApiTimeout(page: Page, urlPattern: string) {
  await page.route(urlPattern, (route) => route.abort('timedout'));
}

/**
 * Mock API to simulate slow response.
 */
export async function mockApiSlow(
  page: Page,
  urlPattern: string,
  delayMs: number,
) {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * Mock API to return 401 (unauthorized).
 */
export async function mockUnauthorized(page: Page, urlPattern: string) {
  await mockApiError(page, urlPattern, 401, 'Unauthorized', 'UNAUTHORIZED');
}

/**
 * Mock API to return 403 (forbidden).
 */
export async function mockForbidden(page: Page, urlPattern: string) {
  await mockApiError(page, urlPattern, 403, 'Forbidden', 'FORBIDDEN');
}

/**
 * Mock API to return 429 (rate limited).
 */
export async function mockRateLimited(page: Page, urlPattern: string) {
  await mockApiError(page, urlPattern, 429, 'Too many requests', 'RATE_LIMITED');
}

/**
 * Mock API to return 503 (service unavailable).
 */
export async function mockServiceUnavailable(page: Page, urlPattern: string) {
  await mockApiError(page, urlPattern, 503, 'Service unavailable', 'SERVICE_UNAVAILABLE');
}

/**
 * Intercept API calls and track request count.
 */
export async function trackApiCalls(page: Page, urlPattern: string) {
  const calls: { method: string; url: string; body?: string }[] = [];

  await page.route(urlPattern, async (route) => {
    const request = route.request();
    calls.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? undefined,
    });
    await route.continue();
  });

  return calls;
}

/**
 * Mock tenant/me endpoint with custom data.
 */
export async function mockTenantMe(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  await page.route('**/api/v1/tenant/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'tenant-test-id',
          name: 'Empresa Teste',
          plan: 'PRO',
          role: 'OWNER',
          billingAccess: {
            enabledModules: [
              'MESSAGING',
              'CONTACTS',
              'SCHEDULING',
              'CATALOG',
              'SALES',
              'BILLING',
              'INVENTORY',
              'RECOVERY',
              'PROSPECTING',
              'SOCIAL',
              'AI',
              'CHECKOUT_WA',
              'AGENDAMENTO_ONLINE',
              'ESTOQUE_IA',
              'Cobrança_AUTO',
              'PROSPECCAO_ATIVA',
              'INTEGRATIONS_HUB',
              'OMNICHANNEL_SOCIAL',
            ],
            moduleAccess: {
              MESSAGING: true,
              CONTACTS: true,
              SCHEDULING: true,
              CATALOG: true,
              SALES: true,
              BILLING: true,
              INVENTORY: true,
              RECOVERY: true,
              PROSPECTING: true,
              SOCIAL: true,
              AI: true,
              CHECKOUT_WA: true,
              AGENDAMENTO_ONLINE: true,
              ESTOQUE_IA: true,
              'Cobrança_AUTO': true,
              PROSPECCAO_ATIVA: true,
              INTEGRATIONS_HUB: true,
              OMNICHANNEL_SOCIAL: true,
            },
          },
          ...overrides,
        },
      }),
    });
  });
}

/**
 * Default user data for auth mocks.
 */
const defaultMockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  tenantId: 'tenant-test-id',
  role: 'OWNER' as const,
};

/**
 * Default tenant data for auth mocks.
 */
const defaultMockTenant = {
  id: 'tenant-test-id',
  name: 'Empresa Teste',
  plan: 'PRO',
  cnpj: '12345678000100',
  businessType: 'SERVICOS',
  planStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  billingAccess: {
    enabledModules: [
      'MESSAGING', 'CONTACTS', 'SCHEDULING', 'CATALOG', 'SALES',
      'BILLING', 'INVENTORY', 'RECOVERY', 'PROSPECTING', 'SOCIAL',
      'AI', 'CHECKOUT_WA', 'AGENDAMENTO_ONLINE', 'ESTOQUE_IA',
      'Cobrança_AUTO', 'PROSPECCAO_ATIVA', 'INTEGRATIONS_HUB', 'OMNICHANNEL_SOCIAL',
    ],
    moduleAccess: {
      MESSAGING: true, CONTACTS: true, SCHEDULING: true, CATALOG: true,
      SALES: true, BILLING: true, INVENTORY: true, RECOVERY: true,
      PROSPECTING: true, SOCIAL: true, AI: true, CHECKOUT_WA: true,
      AGENDAMENTO_ONLINE: true, ESTOQUE_IA: true, 'Cobrança_AUTO': true,
      PROSPECCAO_ATIVA: true, INTEGRATIONS_HUB: true, OMNICHANNEL_SOCIAL: true,
    },
  },
  branches: [
    { id: 'branch-1', name: 'Matriz', isHeadquarters: true, active: true },
  ],
};

/**
 * Mock GET /auth/me endpoint — the bootstrap call that determines authentication.
 * Returns { data: { user, tenant } } which is the format expected by authService.getCurrentSession().
 * Also mocks /tenant/me for hooks that call it separately.
 */
export async function mockAuthMe(
  page: Page,
  options: { user?: Record<string, unknown>; tenant?: Record<string, unknown> } = {},
) {
  const user = { ...defaultMockUser, ...options.user };
  const tenant = { ...defaultMockTenant, ...options.tenant };

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user, tenant } }),
    });
  });

  await mockTenantMe(page);
}
