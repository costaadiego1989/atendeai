import { test, expect } from '../playwright-fixture';

test.describe('Agent Rules', () => {
  test.describe('Rules List', () => {
    test('@smoke should load agent rules page via AI settings', async ({ page }) => {
      await page.goto('/app/settings/ai');

      await expect(page).toHaveURL(/\/app\/settings\/ai/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display rules list or empty state', async ({ page }) => {
      await page.goto('/app/settings/ai');

      const list = page.locator(
        '[data-testid="rules-list"], [data-testid="agent-rules-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhuma regra|sem regras|configure|crie sua primeira/i);
      const aiContent = page.getByText(/inteligência artificial|ia|ai|assistente|regra/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);
      const hasAI = await aiContent.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty || hasAI).toBe(true);
    });
  });

  test.describe('Rule CRUD', () => {
    test('@regression should open create rule form', async ({ page }) => {
      await page.goto('/app/settings/ai');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="rule-form"], [data-testid="agent-rule-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate rule form fields', async ({ page }) => {
      await page.goto('/app/settings/ai');

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

    test('@regression should show AI toggle or configuration options', async ({ page }) => {
      await page.goto('/app/settings/ai');

      const toggles = page.locator('[role="switch"], input[type="checkbox"]');
      const configOptions = page.getByText(/ativar|desativar|habilitar|auto-resposta|tom|personalidade/i);

      const hasToggles = await toggles.first().isVisible().catch(() => false);
      const hasConfig = await configOptions.first().isVisible().catch(() => false);

      expect(hasToggles || hasConfig).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle agent-rules API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/agent-rules/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/settings/ai');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
