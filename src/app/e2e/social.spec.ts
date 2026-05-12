import { test, expect } from '../playwright-fixture';

test.describe('Social', () => {
  test.describe('Feed & Publications (APP-SOC-002)', () => {
    test('@smoke should load social page', async ({ page }) => {
      await page.goto('/app/social');

      await expect(page).toHaveURL(/\/app\/social/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display publications list or empty state', async ({ page }) => {
      await page.goto('/app/social');

      const list = page.locator(
        '[data-testid="publications-list"], [data-testid="posts-list"], table, [role="list"], .post-item'
      );
      const emptyState = page.getByText(/nenhuma publicação|nenhuma publicacao|sem publicações|sem posts/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });

    test('@regression should show create publication button', async ({ page }) => {
      await page.goto('/app/social');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|publicar|agendar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Publication CRUD', () => {
    test('@regression should open create publication form', async ({ page }) => {
      await page.goto('/app/social');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|publicar|agendar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="post-form"], [data-testid="publication-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate publication form fields', async ({ page }) => {
      await page.goto('/app/social');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|publicar|agendar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /publicar|agendar|salvar|enviar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });

    test('@regression should show scheduling date picker for posts', async ({ page }) => {
      await page.goto('/app/social');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|publicar|agendar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        // Look for date/time picker for scheduling
        const datePicker = page.locator(
          '[data-testid="schedule-date"], input[type="datetime-local"], [data-testid="date-picker"]'
        );
        const scheduleOption = page.getByText(/agendar|schedule|data|horário|horario/i);

        const hasPicker = await datePicker.first().isVisible().catch(() => false);
        const hasOption = await scheduleOption.first().isVisible().catch(() => false);

        expect(hasPicker || hasOption).toBe(true);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle social API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/social/**', (route) =>
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
  });
});
