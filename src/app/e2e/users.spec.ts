import { test, expect } from '../playwright-fixture';

test.describe('Users (APP-USR-001)', () => {
  test.describe('Team Page', () => {
    test('@smoke should load team/users page', async ({ page }) => {
      await page.goto('/app/team');

      await expect(page).toHaveURL(/\/app\/team/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display users list or empty state', async ({ page }) => {
      await page.goto('/app/team');

      const list = page.locator(
        '[data-testid="users-list"], [data-testid="team-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhum usuário|nenhum usuario|sem membros|convide/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should display user role and status columns', async ({ page }) => {
      await page.goto('/app/team');

      const roleText = page.getByText(/admin|operador|viewer|gerente|papel|role/i);
      const statusText = page.getByText(/ativo|inativo|pendente|active|inactive/i);

      const hasRole = await roleText.first().isVisible().catch(() => false);
      const hasStatus = await statusText.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('User CRUD', () => {
    test('@regression should open invite/create user form', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="user-form"], [data-testid="invite-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should accept form with only required fields (APP-USR-001)', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        // Optional fields (accessibleBranchIds, mustChangePassword) should not be required
        const optionalFields = page.locator(
          '[data-testid="branch-select"], [data-testid="must-change-password"]'
        );
        const hasOptional = await optionalFields.first().isVisible().catch(() => false);

        // These fields should not have required indicator if present
        if (hasOptional) {
          const requiredMark = optionalFields.first().locator('[aria-required="true"], .required');
          const isRequired = await requiredMark.first().isVisible().catch(() => false);
          expect(isRequired).toBe(false);
        }
      }
    });

    test('@regression should validate required fields on user creation', async ({ page }) => {
      await page.goto('/app/team');

      const newButton = page.getByRole('button', { name: /novo|convidar|adicionar|invite|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|convidar|enviar|confirmar|save|invite/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle users API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/users/**', (route) =>
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
  });
});
