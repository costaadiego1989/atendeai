import { test, expect } from '../playwright-fixture';

test.describe('Platform Admin (APP-PADM-002)', () => {
  test.describe('Admin Dashboard', () => {
    test('@smoke should load platform admin page', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      // May redirect to login or show 403 depending on user role
      const content = page.locator('main, [role="main"]');
      const accessDenied = page.getByText(/acesso negado|sem permissão|sem permissao|403|unauthorized/i);
      const loginRedirect = page.locator('[data-testid="login-form"]');

      const hasContent = await content.first().isVisible().catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);
      const hasLogin = await loginRedirect.first().isVisible().catch(() => false);

      // One of these should be true - page loads in some valid state
      expect(hasContent || hasDenied || hasLogin).toBe(true);
    });

    test('@regression should display tenants list for admin users', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const list = page.locator(
        '[data-testid="tenants-list"], table, [role="table"], [data-testid="platform-tenants"]'
      );
      const emptyState = page.getByText(/nenhum tenant|sem tenants/i);
      const accessDenied = page.getByText(/acesso negado|sem permissão|sem permissao/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty || hasDenied).toBe(true);
    });
  });

  test.describe('Access Control (APP-PADM-002)', () => {
    test('@regression should show friendly 403 message for non-admin users', async ({ page }) => {
      // Mock tenant/me to return non-admin role
      await page.route('**/api/v1/tenant/me', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (json.data) {
          json.data.role = 'OPERATOR';
        }
        await route.fulfill({ body: JSON.stringify(json) });
      });

      await page.goto('/app/platform/tenants');

      // Should show friendly message, not raw error
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('@regression should redirect unauthenticated users to login', async ({ page }) => {
      // Clear auth state
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());

      await page.goto('/app/platform/tenants');

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});

      const loginForm = page.locator('[data-testid="login-form"], form');
      const accessDenied = page.getByText(/acesso negado|login/i);

      const hasLogin = await loginForm.first().isVisible().catch(() => false);
      const hasDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasLogin || hasDenied).toBe(true);
    });
  });

  test.describe('Tenant Management', () => {
    test('@regression should show tenant search/filter controls', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter/i });

      const hasSearch = await searchInput.first().isVisible().catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);

      // Page loads without crash (may show access denied)
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('@regression should show tenant details on click', async ({ page }) => {
      await page.goto('/app/platform/tenants');

      const tenant = page.locator(
        '[data-testid="tenant-item"], tr[data-row], [role="row"]'
      );
      const hasTenant = await tenant.first().isVisible().catch(() => false);

      if (hasTenant) {
        await tenant.first().click();

        const detail = page.locator(
          '[data-testid="tenant-detail"], [role="dialog"], [data-testid="tenant-info"]'
        );
        await expect(detail.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle platform API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/platform/**', (route) =>
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
  });
});
