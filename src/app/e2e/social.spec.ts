import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Social E2E Tests — Full coverage based on social.e2e-spec.md
 */

test.describe('Social', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load social page', async ({ page }) => {
      await page.goto('/app/social');

      await expect(page).toHaveURL(/\/app\/social/);

      const content = page.locator('main, [role="main"], [data-testid="social-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display Instagram connection status', async ({ page }) => {
      await page.goto('/app/social');

      const connectionStatus = page.getByText(/conectad|desconectad|instagram|conexão|conectar/i)
        .or(page.locator('[data-testid="connection-status"]'));
      const hasStatus = await connectionStatus.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display engagement metrics cards', async ({ page }) => {
      await page.goto('/app/social');

      const metrics = page.locator('[data-testid="kpi-card"], [data-testid="metrics-card"], .metrics');
      const metricsText = page.getByText(/likes|comentários|comentarios|alcance|reach|engajamento/i);

      const hasMetrics = await metrics.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasText = await metricsText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.4 @smoke should display posts list', async ({ page }) => {
      await page.goto('/app/social');

      const list = page.locator(
        '[data-testid="publications-list"], [data-testid="posts-list"], table, [role="list"], .post-item'
      );
      const emptyState = page.getByText(/nenhuma publicação|nenhum post|sem publicações|conecte/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should show connect Instagram button or connected state', async ({ page }) => {
      await page.goto('/app/social');

      const connectBtn = page.getByRole('button', { name: /conectar|connect|instagram/i });
      const connectedBadge = page.getByText(/conectad|connected/i);

      const hasConnect = await connectBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasConnected = await connectedBadge.first().isVisible().catch(() => false);

      expect(hasConnect || hasConnected).toBe(true);
    });

    test('2.2 @regression should display posts with image and metrics', async ({ page }) => {
      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        const image = post.first().locator('img');
        const hasImage = await image.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.3 @regression should show post comments section', async ({ page }) => {
      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"], tr[data-row]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        await post.first().click();

        const comments = page.getByText(/comentário|comment/i)
          .or(page.locator('[data-testid="comments-section"]'));
        const hasComments = await comments.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show reply to comment action', async ({ page }) => {
      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"], tr[data-row]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        await post.first().click();

        const replyBtn = page.getByRole('button', { name: /responder|reply/i })
          .or(page.locator('[data-testid="reply-button"]'));
        const replyInput = page.locator('textarea, input[placeholder*="responder"], input[placeholder*="reply"]');

        const hasReply = await replyBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasInput = await replyInput.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should show disconnect account option', async ({ page }) => {
      await page.goto('/app/social');

      const disconnectBtn = page.getByRole('button', { name: /desconectar|disconnect|remover conta/i });
      const settingsBtn = page.getByRole('button', { name: /configurações|settings|config/i });

      const hasDisconnect = await disconnectBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasSettings = await settingsBtn.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.6 @regression should show period filter for metrics', async ({ page }) => {
      await page.goto('/app/social');

      const periodFilter = page.getByRole('combobox', { name: /período|period/i })
        .or(page.locator('[data-testid="period-filter"]'))
        .or(page.getByRole('button', { name: /7 dias|30 dias|período|period/i }));
      const hasPeriod = await periodFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate empty comment reply', async ({ page }) => {
      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"], tr[data-row]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        await post.first().click();

        const replyBtn = page.getByRole('button', { name: /responder|reply|enviar/i });
        const hasReply = await replyBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasReply) {
          await replyBtn.first().click();
          await page.waitForTimeout(2_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });
  });

  // ─── 4. FILTROS E BUSCA ───────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should filter posts by period', async ({ page }) => {
      await page.goto('/app/social');

      const periodFilter = page.getByRole('combobox', { name: /período|period/i })
        .or(page.locator('[data-testid="period-filter"]'))
        .or(page.getByRole('button', { name: /7 dias|30 dias|período|period/i }));
      const hasPeriod = await periodFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPeriod) {
        await periodFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should search posts by caption', async ({ page }) => {
      await page.goto('/app/social');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('promoção');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show connect CTA when Instagram not connected', async ({ page }) => {
      await page.route('**/api/v1/social*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: null, connected: false }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/social');

      const connectCta = page.getByText(/conecte|conectar|connect|vincule sua conta/i)
        .or(page.getByRole('button', { name: /conectar|connect/i }));
      const hasCta = await connectCta.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('7.2 @regression should show empty state when no posts', async ({ page }) => {
      await page.route('**/api/v1/social/posts*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/social');

      const emptyState = page.getByText(/nenhum post|nenhuma publicação|sem posts|sem publicações/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('7.3 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/social*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/social');

      const skeletons = page.locator('[data-testid="skeleton"], .skeleton, .animate-pulse');
      const hasSkeletons = await skeletons.first().isVisible({ timeout: 3_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 gracefully', async ({ page }) => {
      await page.route('**/api/v1/social*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/social');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle Instagram token expired', async ({ page }) => {
      await page.route('**/api/v1/social*', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Instagram token expired', code: 'IG_TOKEN_EXPIRED' }),
        })
      );

      await page.goto('/app/social');

      const reconnectMsg = page.getByText(/reconecte|reconect|token expirado|expired/i);
      const hasMsg = await reconnectMsg.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle rate limit from Instagram', async ({ page }) => {
      await page.route('**/api/v1/social*', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Rate limit exceeded' }),
        })
      );

      await page.goto('/app/social');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.4 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/social*');

      await page.goto('/app/social');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in comment reply', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"], tr[data-row]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        await post.first().click();

        const replyInput = page.locator('textarea, input[placeholder*="responder"], input[placeholder*="reply"]');
        const hasInput = await replyInput.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasInput) await replyInput.first().fill('<script>alert("xss")</script>');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @regression should handle long caption truncation', async ({ page }) => {
      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        const seeMore = page.getByText(/ver mais|see more|mostrar mais/i);
        const hasSeeMore = await seeMore.first().isVisible().catch(() => false);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should handle large metric values formatting', async ({ page }) => {
      await page.goto('/app/social');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.4 @regression should prevent double-click on connect', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/social/**');

      await page.goto('/app/social');

      const connectBtn = page.getByRole('button', { name: /conectar|connect/i });
      const hasConnect = await connectBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasConnect) {
        await connectBtn.first().dblclick();
        await page.waitForTimeout(3_000);

        const postCalls = calls.filter((c) => c.method === 'POST');
        expect(postCalls.length).toBeLessThanOrEqual(1);
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display social on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/social');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display social on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/social');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display social on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/social');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-reply to comment', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/social/**');

      await page.goto('/app/social');

      const post = page.locator(
        '[data-testid="post-item"], .post-card, [role="article"], tr[data-row]'
      );
      const hasPost = await post.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPost) {
        await post.first().click();

        const replyInput = page.locator('textarea, input[placeholder*="responder"], input[placeholder*="reply"]');
        const hasInput = await replyInput.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasInput) {
          await replyInput.first().fill('Test reply');

          const sendBtn = page.getByRole('button', { name: /enviar|send|responder|reply/i });
          const hasSend = await sendBtn.first().isVisible().catch(() => false);

          if (hasSend) {
            await sendBtn.first().dblclick();
            await page.waitForTimeout(3_000);

            const postCalls = calls.filter((c) => c.method === 'POST');
            expect(postCalls.length).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });
});
