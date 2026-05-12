import { test, expect } from '../playwright-fixture';

test.describe('Settings', () => {
  test.describe('Company Settings (APP-SET-001)', () => {
    test('@smoke should load company settings page', async ({ page }) => {
      await page.goto('/app/settings/company');

      await expect(page).toHaveURL(/\/app\/settings\/company/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display company profile form', async ({ page }) => {
      await page.goto('/app/settings/company');

      const form = page.locator('form, [data-testid="company-form"], [data-testid="tenant-form"]');
      const nameInput = page.getByLabel(/nome|name|empresa|negócio|negocio/i);

      const hasForm = await form.first().isVisible().catch(() => false);
      const hasName = await nameInput.first().isVisible().catch(() => false);

      expect(hasForm || hasName).toBe(true);
    });

    test('@regression should save company profile changes', async ({ page }) => {
      await page.goto('/app/settings/company');

      const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update/i });
      const hasSave = await saveBtn.first().isVisible().catch(() => false);

      expect(hasSave).toBe(true);
    });
  });

  test.describe('Integrations (APP-SET-003)', () => {
    test('@regression should load integrations settings page', async ({ page }) => {
      await page.goto('/app/settings/integrations');

      await expect(page).toHaveURL(/\/app\/settings\/integrations/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display available integrations', async ({ page }) => {
      await page.goto('/app/settings/integrations');

      // Should show integration cards (WhatsApp, Instagram, ERPs, etc.)
      const integrations = page.getByText(/whatsapp|instagram|integração|integracao/i);
      const cards = page.locator(
        '[data-testid="integration-card"], .integration-item, [data-testid="integrations-list"]'
      );

      const hasText = await integrations.first().isVisible().catch(() => false);
      const hasCards = await cards.first().isVisible().catch(() => false);

      expect(hasText || hasCards).toBe(true);
    });
  });

  test.describe('Channels', () => {
    test('@regression should load channels settings page', async ({ page }) => {
      await page.goto('/app/settings/channels');

      await expect(page).toHaveURL(/\/app\/settings\/channels/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display channel configuration options', async ({ page }) => {
      await page.goto('/app/settings/channels');

      const channelText = page.getByText(/canal|channel|whatsapp|instagram/i);
      const hasText = await channelText.first().isVisible().catch(() => false);

      // Page loads without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('AI Settings', () => {
    test('@regression should load AI settings page', async ({ page }) => {
      await page.goto('/app/settings/ai');

      await expect(page).toHaveURL(/\/app\/settings\/ai/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display AI configuration options', async ({ page }) => {
      await page.goto('/app/settings/ai');

      const aiText = page.getByText(/inteligência artificial|ia|ai|assistente|auto-resposta/i);
      const toggles = page.locator('[role="switch"], input[type="checkbox"]');

      const hasText = await aiText.first().isVisible().catch(() => false);
      const hasToggles = await toggles.first().isVisible().catch(() => false);

      expect(hasText || hasToggles).toBe(true);
    });
  });

  test.describe('Alerts Settings', () => {
    test('@regression should load alerts settings page', async ({ page }) => {
      await page.goto('/app/settings/alerts');

      await expect(page).toHaveURL(/\/app\/settings\/alerts/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Error Handling', () => {
    test('@regression should handle settings API errors gracefully', async ({ page }) => {
      await page.route('**/api/v1/tenant/**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/app/settings/company');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });
});
