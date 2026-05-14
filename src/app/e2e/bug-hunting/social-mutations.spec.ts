import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Social Mutations Error Handling
 *
 * These tests verify that mutations in the Social module properly handle
 * API failures and show user feedback. Identified bugs:
 * - toggleRuleMutation had NO onError handler (silent failure)
 * - replyMutation had NO onError handler for HTTP errors (silent failure)
 */

const TENANT_ID = 'tenant-test-id';
const SOCIAL_STATS_API = `**/api/v1/tenants/*/social/stats*`;
const SOCIAL_RULES_API = `**/api/v1/tenants/*/social/rules*`;
const SOCIAL_TOGGLE_API = `**/api/v1/tenants/*/social/rules/*/toggle*`;
const SOCIAL_COMMENTS_API = `**/api/v1/tenants/*/social/comments*`;
const SOCIAL_REPLY_API = `**/api/v1/tenants/*/social/comments/*/reply*`;
const SOCIAL_THREAD_API = `**/api/v1/tenants/*/social/comments/*/thread*`;
const SOCIAL_ACCOUNTS_API = `**/api/v1/tenants/*/social/accounts*`;

const SOCIAL_URL = '/app/social';

const mockRule = {
  id: 'rule-1',
  name: 'Regra de Boas-Vindas',
  platform: 'INSTAGRAM',
  isActive: true,
  priority: 10,
  conditions: { keywords: ['preço', 'valor'], excludeKeywords: [] },
  actions: {
    replyToComment: { enabled: true, mode: 'AI_GENERATED', aiPrompt: 'Responda', templates: [] },
    sendInboxMessage: { enabled: true, delaySeconds: 25, mode: 'TEMPLATE', templates: ['Olá!'], aiPrompt: '' },
  },
  limits: { maxRepliesPerPost: 50, maxRepliesPerHour: 30, cooldownPerUser: 60 },
  lastFiredAt: '2026-05-01T10:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const mockComment = {
  id: 'comment-1',
  authorUsername: 'joao_silva',
  text: 'Quanto custa esse produto?',
  platform: 'INSTAGRAM',
  postId: 'post-1',
  status: 'PENDING',
  receivedAt: '2026-05-10T14:30:00Z',
};

const mockStats = {
  totalComments: 150,
  pendingComments: 12,
  repliedComments: 100,
  autoRepliedComments: 80,
  activeRules: 3,
  connectedAccounts: 1,
};

async function setupSocialPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(SOCIAL_STATS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStats),
    }),
  );

  await page.route(SOCIAL_ACCOUNTS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

test.describe('@bug-hunt Social Mutations — Error Handling', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #S1: toggleRuleMutation — NO onError handler (FIXED)
  // Expected: toast with error message when API returns 500
  // Actual (before fix): silent failure, no user feedback
  // ═══════════════════════════════════════════════════════════════════════════════

  test('S1.1 toggle rule should show error toast on API 500', async ({ page }) => {
    await setupSocialPageMocks(page);

    await page.route(SOCIAL_RULES_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRule]),
        });
      }
      return route.continue();
    });

    // Toggle endpoint returns 500
    await page.route(SOCIAL_TOGGLE_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(SOCIAL_URL);

    // Navigate to rules tab
    await page.getByRole('tab', { name: /workflows/i }).click();
    await expect(page.getByText('Regra de Boas-Vindas')).toBeVisible();

    // Click the toggle button (Desativar since rule is active)
    await page.getByRole('button', { name: /desativar/i }).click();

    // Should show error toast
    await expect(
      page.getByText(/falha|erro|não foi possível/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('S1.2 toggle rule should keep rule in original state after failure', async ({ page }) => {
    await setupSocialPageMocks(page);

    await page.route(SOCIAL_RULES_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRule]),
        });
      }
      return route.continue();
    });

    await page.route(SOCIAL_TOGGLE_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(SOCIAL_URL);
    await page.getByRole('tab', { name: /workflows/i }).click();
    await expect(page.getByText('Regra de Boas-Vindas')).toBeVisible();

    // Rule should show "Ativo" badge before toggle
    await expect(page.getByText('Ativo')).toBeVisible();

    await page.getByRole('button', { name: /desativar/i }).click();

    // Wait for error to process
    await page.waitForTimeout(2000);

    // Rule should still show as active (server rejected the toggle)
    await expect(page.getByText('Ativo')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #S2: replyMutation — NO onError handler for HTTP errors (FIXED)
  // Expected: toast with error message when API returns 500
  // Actual (before fix): silent failure for network/HTTP errors
  // Note: API-level errors (result.success=false) were already handled in onSuccess
  // ═══════════════════════════════════════════════════════════════════════════════

  test('S2.1 reply to comment should show error toast on API 500', async ({ page }) => {
    await setupSocialPageMocks(page);

    await page.route(SOCIAL_COMMENTS_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [mockComment], total: 1, page: 1, limit: 20 }),
        });
      }
      return route.continue();
    });

    await page.route(SOCIAL_THREAD_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comment: mockComment, replies: [] }),
      }),
    );

    // Reply endpoint returns 500
    await page.route(SOCIAL_REPLY_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(SOCIAL_URL);

    // Comments tab is default — click on the comment to select it
    await page.getByText('Quanto custa esse produto?').click();

    // Type a reply
    await page.getByPlaceholder(/responder no comentário/i).fill('Olá! O preço é R$99.');

    // Click send
    await page.getByRole('button', { name: /enviar/i }).click();

    // Should show error toast
    await expect(
      page.getByText(/falha|erro|não foi possível/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('S2.2 reply draft should be preserved after failed send', async ({ page }) => {
    await setupSocialPageMocks(page);

    await page.route(SOCIAL_COMMENTS_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [mockComment], total: 1, page: 1, limit: 20 }),
        });
      }
      return route.continue();
    });

    await page.route(SOCIAL_THREAD_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comment: mockComment, replies: [] }),
      }),
    );

    await page.route(SOCIAL_REPLY_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(SOCIAL_URL);
    await page.getByText('Quanto custa esse produto?').click();

    const replyInput = page.getByPlaceholder(/responder no comentário/i);
    await replyInput.fill('Olá! O preço é R$99.');
    await page.getByRole('button', { name: /enviar/i }).click();

    // Wait for error
    await expect(
      page.getByText(/falha|erro|não foi possível/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Draft should still be in the input (not cleared on error)
    await expect(replyInput).toHaveValue('Olá! O preço é R$99.');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #S3: toggleRuleMutation with 429 rate limit
  // Expected: friendly rate limit message
  // ═══════════════════════════════════════════════════════════════════════════════

  test('S3.1 toggle rule should show friendly message on 429', async ({ page }) => {
    await setupSocialPageMocks(page);

    await page.route(SOCIAL_RULES_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRule]),
        });
      }
      return route.continue();
    });

    await page.route(SOCIAL_TOGGLE_API, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      }),
    );

    await page.goto(SOCIAL_URL);
    await page.getByRole('tab', { name: /workflows/i }).click();
    await expect(page.getByText('Regra de Boas-Vindas')).toBeVisible();

    await page.getByRole('button', { name: /desativar/i }).click();

    // Should show error toast (rate limit handled by getFriendlyErrorMessage)
    await expect(
      page.getByText(/falha|erro|muitas|aguarde|limite/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
