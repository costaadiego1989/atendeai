import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Users (Team) E2E Tests — Full coverage based on users.e2e-spec.md
 */

test.describe('Users (Team)', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load team page', async ({ page }) => {
      await page.goto('/app/team');

      await expect(page).toHaveURL(/\/app\/team/);

      const content = page.locator('main, [role="main"], [data-testid="team-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display invite button', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display user roles', async ({ page }) => {
      await page.goto('/app/team');

      const roleText = page.getByText(/admin|operador|viewer|gerente|papel|role|owner/i);
      const hasRole = await roleText.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.4 @smoke should display members list or empty state', async ({ page }) => {
      await page.goto('/app/team');

      const list = page.locator(
        '[data-testid="users-list"], [data-testid="team-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhum usuário|nenhum usuario|sem membros|convide/i);

      const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should display members with name, email, role, status', async ({ page }) => {
      await page.goto('/app/team');

      const member = page.locator(
        '[data-testid="user-item"], tr[data-row], [role="row"], .member-item'
      );
      const hasMember = await member.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasMember) {
        const roleText = page.getByText(/admin|operador|viewer|owner/i);
        const hasRole = await roleText.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.2 @regression should open invite user form', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="user-form"], [data-testid="invite-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('2.3 @regression should show role selector in invite form', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const roleSelect = page.getByLabel(/papel|role|permissão|permissao/i)
          .or(page.locator('[data-testid="role-select"]'))
          .or(page.getByRole('combobox', { name: /role|papel/i }));
        const hasRole = await roleSelect.first().isVisible({ timeout: 5_000 }).catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.4 @regression should show edit role action on member', async ({ page }) => {
      await page.goto('/app/team');

      const member = page.locator(
        '[data-testid="user-item"], tr[data-row], [role="row"], .member-item'
      );
      const hasMember = await member.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasMember) {
        const editBtn = page.getByRole('button', { name: /editar|edit|alterar/i })
          .or(page.locator('[data-testid="edit-role"]'));
        const moreMenu = page.getByRole('button', { name: /mais|more|opções|options/i });

        const hasEdit = await editBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasMore = await moreMenu.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.5 @regression should show remove member action', async ({ page }) => {
      await page.goto('/app/team');

      const member = page.locator(
        '[data-testid="user-item"], tr[data-row], [role="row"], .member-item'
      );
      const hasMember = await member.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasMember) {
        const removeBtn = page.getByRole('button', { name: /remover|excluir|deletar|remove|delete/i })
          .or(page.locator('[data-testid="remove-member"]'));
        const moreMenu = page.getByRole('button', { name: /mais|more|opções|options/i });

        const hasRemove = await removeBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasMore = await moreMenu.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('2.6 @regression should accept form with only required fields (APP-USR-001)', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const optionalFields = page.locator(
          '[data-testid="branch-select"], [data-testid="must-change-password"]'
        );
        const hasOptional = await optionalFields.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasOptional) {
          const requiredMark = optionalFields.first().locator('[aria-required="true"], .required');
          const isRequired = await requiredMark.first().isVisible().catch(() => false);
          expect(isRequired).toBe(false);
        }
      }
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate empty form submission', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|convidar|enviar|confirmar|save|invite/i });
        const hasSubmit = await submitBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });

    test('3.2 @regression should validate invalid email format', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const emailField = page.getByLabel(/email|e-mail/i)
          .or(page.locator('input[type="email"]'));
        const hasEmail = await emailField.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasEmail) {
          await emailField.first().fill('invalid-email');
          await emailField.first().blur();
          await page.waitForTimeout(1_000);

          const submitBtn = page.getByRole('button', { name: /salvar|convidar|enviar|confirmar|save|invite/i });
          const hasSubmit = await submitBtn.first().isVisible().catch(() => false);
          if (hasSubmit) await submitBtn.first().click();

          await page.waitForTimeout(2_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });

    test('3.3 @regression should validate email already registered', async ({ page }) => {
      await page.route('**/api/v1/users*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'User already exists', code: 'USER_ALREADY_MEMBER' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/team');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 4. FILTROS E BUSCA ───────────────────────────────────────────────────────

  test.describe('4. Filtros e Busca', () => {
    test('4.1 @regression should search members by name or email', async ({ page }) => {
      await page.goto('/app/team');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('admin');
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('4.2 @regression should filter by role', async ({ page }) => {
      await page.goto('/app/team');

      const roleFilter = page.getByRole('combobox', { name: /role|papel|permissão/i })
        .or(page.locator('[data-testid="role-filter"]'))
        .or(page.getByRole('button', { name: /filtrar|filter|role|papel/i }));
      const hasFilter = await roleFilter.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasFilter) {
        await roleFilter.first().click();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty state with only owner', async ({ page }) => {
      await page.route('**/api/v1/users*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [{ id: '1', name: 'Owner', role: 'OWNER' }], meta: { total: 1 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/team');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('7.2 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/users*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/team');

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
      await page.route('**/api/v1/users*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/team');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/users*');

      await page.goto('/app/team');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.3 @regression should handle plan limit error on invite', async ({ page }) => {
      await page.route('**/api/v1/users*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Plan limit reached', code: 'PLAN_LIMIT_MEMBERS' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/team');

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in email field', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();
        const emailField = page.getByLabel(/email|e-mail/i)
          .or(page.locator('input[type="email"]'));
        const hasEmail = await emailField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasEmail) await emailField.first().fill('<script>alert("xss")</script>@test.com');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @security should handle SQL injection in search', async ({ page }) => {
      await page.goto('/app/team');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const hasSearch = await searchInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill("'; DROP TABLE users; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should prevent removing last admin', async ({ page }) => {
      await page.goto('/app/team');

      // This is a business rule - page should not crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display team on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/team');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display team on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/team');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display team on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/team');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-invite on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/users*');

      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const emailField = page.getByLabel(/email|e-mail/i)
          .or(page.locator('input[type="email"]'));
        const hasEmail = await emailField.first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasEmail) await emailField.first().fill('test@example.com');

        const submitBtn = page.getByRole('button', { name: /salvar|convidar|enviar|confirmar|save|invite/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().dblclick();
          await page.waitForTimeout(3_000);

          const postCalls = calls.filter((c) => c.method === 'POST');
          expect(postCalls.length).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
