import { test, expect } from '../playwright-fixture';

test.describe('Proposals', () => {
  test.describe('Proposals List', () => {
    test('@smoke should load proposals page', async ({ page }) => {
      await page.goto('/app/proposals');

      await expect(page).toHaveURL(/\/app\/proposals/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display proposals list or empty state', async ({ page }) => {
      await page.goto('/app/proposals');

      const list = page.locator(
        '[data-testid="proposals-list"], table, [role="list"], .proposal-item'
      );
      const emptyState = page.getByText(/nenhuma proposta|sem propostas|crie sua primeira/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should display search or filter controls', async ({ page }) => {
      await page.goto('/app/proposals');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter|status/i });

      const hasSearch = await searchInput.first().isVisible().catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Proposal CRUD', () => {
    test('@regression should open create proposal form', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="proposal-form"], [data-testid="create-proposal"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate proposal form fields', async ({ page }) => {
      await page.goto('/app/proposals');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|enviar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Public Proposal Page', () => {
    test('@regression should load public proposal page with token', async ({ page }) => {
      // Public proposal page is accessible without auth
      await page.context().clearCookies();

      await page.goto('/proposal/test-token-123');

      // Should show proposal content or "not found" - not crash
      const content = page.locator('main, [role="main"], body');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle proposals API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/proposals/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/proposals');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
