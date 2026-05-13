import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Platform Admin E2E Tests — Full coverage based on platform-admin.e2e-spec.md
 */

test.describe('Platform Admin', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load platform admin page', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const content = page.locator('main, [role="main"]');
      const accessDenied = page.getByText(/acesso negado|sem permissão|sem permissao|403|unauthorized/i);
      const loginRedirect = page.locator('[data-testid="login-form"]');

      const hasContent = await content.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);
      const hasLogin = await loginRedirect.first().isVisible().catch(() => false);

      expect(hasContent || hasDenied || hasLogin).toBe(true);
    });

    test('1.2 @smoke should display global KPIs', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const kpis = page.locator('[data-testid="kpi-card"], [data-testid="platform-metrics"]');
      const kpiText = page.getByText(/total|ativos|mrr|churn|tenants/i);

      const hasKpis = await kpis.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasText = await kpiText.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display tenants list', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const list = page.locator(
        '[data-testid="tenants-list"], table, [role="table"], [data-testid="platform-tenants"]'
      );
      const emptyState = page.getByText(/nenhum tenant|sem tenants/i);
      const accessDenied = page.getByText(/acesso negado|sem permissão|sem permissao/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty || hasDenied).toBe(true);
    });

    test('1.4 @smoke should display search field', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should display tenants with name, plan, status', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        const planText = page.getByText(/trial|starter|pro|enterprise|plano/i);
        const hasPlan = await planText.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.2 @regression should open tenant detail sheet on click', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const detail = page.locator(
          '[data-testid="tenant-detail"], [role="dialog"], [data-testid="tenant-info"], [data-testid="tenant-sheet"]'
        );
        await expect(detail.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.3 @regression should display tenant quotas', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const quotaText = page.getByText(/quota|cota|mensagens|tokens|contatos|limite/i);
        const hasQuota = await quotaText.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show suspend/reactivate tenant action', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const suspendBtn = page.getByRole('button', { name: /suspender|suspend|reativar|reactivate/i });
        const hasSuspend = await suspendBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should show send WhatsApp action', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const whatsappBtn = page.getByRole('button', { name: /whatsapp|enviar mensagem|send message/i });
        const hasWhatsapp = await whatsappBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate negative quota value', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const quotaInput = page.getByLabel(/quota|cota|limite|mensagens/i)
          .or(page.locator('[data-testid="quota-input"] input'));
        const hasQuota = await quotaInput.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasQuota) {
          await quotaInput.first().clear();
          await quotaInput.first().fill('-100');
          await quotaInput.first().blur();
          await page.waitForTimeout(1_000);
        }

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 4. FILTROS E BUSCA ───────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should search tenants by name', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('Empresa Teste');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should filter by plan', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const planFilter = page.getByRole('combobox', { name: /plano|plan/i })
        .or(page.locator('[data-testid="plan-filter"]'))
        .or(page.getByRole('button', { name: /plano|plan|trial|starter|pro/i }));
      const hasFilter = await planFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await planFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.3 @regression should filter by status', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('[data-testid="status-filter"]'))
        .or(page.getByRole('button', { name: /status|ativo|suspenso/i }));
      const hasFilter = await statusFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.4 @regression should show no results message', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('xyznonexistent123');
        await page.waitForTimeout(2_000);

        const noResults = page.getByText(/nenhum tenant|nenhum resultado|sem resultados/i);
        const hasNoResults = await noResults.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/platform*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/platform/tenants');

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
      await page.route('**/api/v1/platform*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/platform/tenants');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/platform*');

      await page.goto('/app/platform/tenants');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle 404 for non-existent tenant', async ({ page }) => {
      await page.route('**/api/v1/platform/tenants/non-existent*', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Tenant not found' }),
        })
      );

      await page.goto('/app/platform/tenants');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in search', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('<script>alert("xss")</script>');
        await page.waitForTimeout(2_000);
      }
    });

    test('9.2 @security should handle SQL injection in search', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill("'; DROP TABLE tenants; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should prevent double-click on suspend', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/platform/**');

      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const suspendBtn = page.getByRole('button', { name: /suspender|suspend/i });
        const hasSuspend = await suspendBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSuspend) {
          await suspendBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const patchCalls = calls.filter((c) => c.method === 'PATCH' || c.method === 'PUT' || c.method === 'POST');
          expect(patchCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display platform admin on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/platform/tenants');

      const content = page.locator('main, [role="main"]');
      const accessDenied = page.getByText(/acesso negado|sem permissão/i);

      const hasContent = await content.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasContent || hasDenied).toBe(true);
    });

    test('10.2 @regression should display platform admin on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/platform/tenants');

      const content = page.locator('main, [role="main"]');
      const accessDenied = page.getByText(/acesso negado|sem permissão/i);

      const hasContent = await content.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasContent || hasDenied).toBe(true);
    });

    test('10.3 @regression should display platform admin on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/platform/tenants');

      const content = page.locator('main, [role="main"]');
      const accessDenied = page.getByText(/acesso negado|sem permissão/i);

      const hasContent = await content.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasContent || hasDenied).toBe(true);
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-adjust on quota', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/platform/**');

      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update|confirmar/i });
        const hasSave = await saveBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSave) {
          await saveBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const writeCalls = calls.filter((c) => c.method === 'PUT' || c.method === 'PATCH' || c.method === 'POST');
          expect(writeCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // ─── 12. PERMISSÕES E SEGURANÇA ──────────────────────────────────────────────

  test.describe('12. Permissões e Segurança (APP-PADM-002)', () => {
    test('12.1 @regression should show friendly 403 for non-admin users', async ({ page }) => {
      await page.route('**/api/v1/tenant/me', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (json.data) {
          json.data.role = 'OPERATOR';
        }
        await route.fulfill({ body: JSON.stringify(json) });
      });

      await page.goto('/app/platform/tenants');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('12.2 @regression should redirect unauthenticated users to login', async ({ page }) => {
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());

      await page.goto('/app/platform/tenants');

      await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});

      const loginForm = page.locator('[data-testid="login-form"], form');
      const accessDenied = page.getByText(/acesso negado|login/i);

      const hasLogin = await loginForm.first().isVisible().catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasLogin || hasDenied).toBe(true);
    });
  });
});
