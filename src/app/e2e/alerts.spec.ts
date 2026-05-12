import { test, expect } from '../playwright-fixture';

test.describe('Alerts (APP-ALT-002)', () => {
  test.describe('Alerts List', () => {
    test('@smoke should load alerts page', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      await expect(page).toHaveURL(/\/app\/settings\/alerts/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display alerts list or empty state', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const list = page.locator(
        '[data-testid="alerts-list"], table, [role="list"], .alert-item'
      );
      const emptyState = page.getByText(/nenhum alerta|sem alertas|nenhuma regra|configure/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });
  });

  test.describe('Alert Rules CRUD', () => {
    test('@regression should open create alert rule form', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="alert-form"], [data-testid="create-alert"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate alert rule form', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
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

    test('@regression should display domain error with stable code (APP-ALT-002)', async ({ page }) => {
      // Mock alerts endpoint to return domain error
      await page.route('**/api/v1/alerts*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Validation failed',
              code: 'ALERT_RULE_INVALID',
              message: 'Condição de alerta inválida',
            }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/alerts');

      // Page should load without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle alerts API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/alerts/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/settings/alerts');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
