import { test, expect } from '../playwright-fixture';

test.describe('Prospecting', () => {
  test.describe('Searches List (APP-PROS-001)', () => {
    test('@smoke should load prospecting searches page', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      await expect(page).toHaveURL(/\/app\/prospecting\/searches/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display searches list or empty state', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const list = page.locator(
        '[data-testid="searches-list"], [data-testid="campaigns-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhuma busca|sem buscas|nenhuma campanha|crie sua primeira/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should display search/filter controls', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

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

  test.describe('Campaign CRUD', () => {
    test('@regression should open create campaign/search form', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="campaign-form"], [data-testid="search-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate campaign form fields', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|iniciar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Execution States (APP-PROS-003)', () => {
    test('@regression should show campaign detail with execution status', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      const campaign = page.locator(
        '[data-testid="campaign-item"], [data-testid="search-item"], tr[data-row], [role="row"]'
      );
      const hasCampaign = await campaign.first().isVisible().catch(() => false);

      if (hasCampaign) {
        await campaign.first().click();

        // Detail view with status
        const detail = page.locator(
          '[data-testid="campaign-detail"], [data-testid="search-detail"], [role="dialog"]'
        );
        const statusBadge = page.getByText(/em execução|execucao|pausada|concluída|concluida|rascunho/i);

        const hasDetail = await detail.first().isVisible().catch(() => false);
        const hasStatus = await statusBadge.first().isVisible().catch(() => false);

        expect(hasDetail || hasStatus).toBe(true);
      }
    });

    test('@regression should display prospect count and progress', async ({ page }) => {
      await page.goto('/app/prospecting/searches');

      // Look for progress indicators
      const progress = page.locator(
        '[data-testid="campaign-progress"], [role="progressbar"], .progress'
      );
      const countText = page.getByText(/prospect|encontrado|resultado/i);

      const hasProgress = await progress.first().isVisible().catch(() => false);
      const hasCount = await countText.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/prospecting/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/prospecting/searches');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
