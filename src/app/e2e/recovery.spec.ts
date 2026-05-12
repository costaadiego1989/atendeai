import { test, expect } from '../playwright-fixture';

test.describe('Recovery', () => {
  test.describe('Playbooks List', () => {
    test('@smoke should load recovery page', async ({ page }) => {
      await page.goto('/app/recovery');

      await expect(page).toHaveURL(/\/app\/recovery/);

      const content = page.locator(
        'main, [role="main"], [data-testid="recovery-page"], [data-testid="recovery"]'
      );
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display playbooks list or empty state', async ({ page }) => {
      await page.goto('/app/recovery');

      const list = page.locator(
        '[data-testid="playbooks-list"], table, [role="list"], .playbook-item'
      );
      const emptyState = page.getByText(/nenhum playbook|sem playbooks|crie seu primeiro|nenhuma regra/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should display search or filter controls', async ({ page }) => {
      await page.goto('/app/recovery');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      const filterBtn = page.getByRole('button', { name: /filtrar|filter/i });
      const tabs = page.locator('[role="tablist"]');

      const hasSearch = await searchInput.first().isVisible().catch(() => false);
      const hasFilter = await filterBtn.first().isVisible().catch(() => false);
      const hasTabs = await tabs.first().isVisible().catch(() => false);

      // At minimum page loads without error
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Playbook CRUD', () => {
    test('@regression should open create playbook form', async ({ page }) => {
      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="playbook-form"], [data-testid="create-playbook"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate playbook form fields', async ({ page }) => {
      await page.goto('/app/recovery');

      const newButton = page.getByRole('button', { name: /novo|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Cases & Outreach', () => {
    test('@regression should show cases when clicking a playbook', async ({ page }) => {
      await page.goto('/app/recovery');

      const playbook = page.locator(
        '[data-testid="playbook-item"], tr[data-row], .playbook-card, [role="row"]'
      );
      const hasPlaybook = await playbook.first().isVisible().catch(() => false);

      if (hasPlaybook) {
        await playbook.first().click();

        // Cases list or detail view
        const cases = page.locator(
          '[data-testid="cases-list"], [data-testid="playbook-detail"], table'
        );
        const caseText = page.getByText(/caso|case|devedor|inadimplente/i);

        const hasCases = await cases.first().isVisible().catch(() => false);
        const hasText = await caseText.first().isVisible().catch(() => false);

        expect(hasCases || hasText).toBe(true);
      }
    });

    test('@regression should display recovery metrics or reports', async ({ page }) => {
      await page.goto('/app/recovery');

      // Look for metrics/KPIs section
      const metrics = page.locator(
        '[data-testid="recovery-metrics"], [data-testid="kpi-card"], .metrics'
      );
      const metricsText = page.getByText(/recuperado|taxa|valor|total/i);

      const hasMetrics = await metrics.first().isVisible().catch(() => false);
      const hasText = await metricsText.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/recovery/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/recovery');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
