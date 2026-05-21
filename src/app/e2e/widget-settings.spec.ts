import { test, expect } from '../playwright-fixture';

/**
 * Widget Settings E2E Tests
 *
 * NOTE: Full widget embed communication tests (widget.js loading on external page)
 * require a deployed environment with a built widget bundle.
 * API-level widget tests (sessions, messages, config) are in:
 *   src/api/modules/messaging/__tests__/widget.e2e-spec.ts
 */

test.describe('Widget Settings', () => {
  test.describe('1. Page Load', () => {
    test('1.1 @smoke should load widget settings page', async ({ page }) => {
      await page.goto('/app/settings/widget');

      await expect(page).toHaveURL(/\/app\/settings\/widget/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should not crash on load', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display widget config form', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const nameInput = page.getByLabel(/nome|name/i);
      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const form = page.locator('form');
      const hasForm = await form.first().isVisible().catch(() => false);

      expect(hasName || hasForm).toBe(true);
    });
  });

  test.describe('2. Form Fields', () => {
    test('2.1 @regression should display widget name field', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const nameInput = page.getByLabel(/nome/i);
      await expect(nameInput.first()).toBeVisible({ timeout: 10_000 });
    });

    test('2.2 @regression should display greeting textarea', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const greetingField = page.getByLabel(/saudação|greeting/i)
        .or(page.locator('textarea').first());
      const hasGreeting = await greetingField.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasGreeting).toBe(true);
    });

    test('2.3 @regression should display position selector', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const positionSelect = page.getByLabel(/posição|position/i)
        .or(page.locator('[role="combobox"]').first());
      const hasPosition = await positionSelect.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasPosition).toBe(true);
    });

    test('2.4 @regression should display color picker', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const colorInput = page.locator('input[type="color"]');
      const hasColor = await colorInput.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasColor).toBe(true);
    });

    test('2.5 @regression should display enabled toggle', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const toggle = page.locator('[role="switch"]');
      const hasToggle = await toggle.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasToggle).toBe(true);
    });

    test('2.6 @regression should display avatar upload section', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const uploadBtn = page.getByRole('button', { name: /enviar imagem|upload|avatar/i });
      const hasUpload = await uploadBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasUpload).toBe(true);
    });
  });

  test.describe('3. Preview', () => {
    test('3.1 @regression should display widget preview panel', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const preview = page.getByText(/preview/i);
      const hasPreview = await preview.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasPreview).toBe(true);
    });

    test('3.2 @regression should update preview when name changes', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const nameInput = page.getByLabel(/nome/i);
      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasName) {
        await nameInput.first().clear();
        await nameInput.first().fill('Meu Bot Teste');
        await page.waitForTimeout(500);

        const previewName = page.getByText('Meu Bot Teste');
        const hasPreviewName = await previewName.first().isVisible().catch(() => false);
        expect(hasPreviewName).toBe(true);
      }
    });
  });

  test.describe('4. Embed Snippet', () => {
    test('4.1 @regression should display installation section', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const installSection = page.getByText(/instalação|install|embed/i);
      const hasInstall = await installSection.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasInstall).toBe(true);
    });

    test('4.2 @regression should display embed code snippet', async ({ page }) => {
      await page.goto('/app/settings/widget');

      // Snippet contains <script or data-token
      const snippet = page.locator('code, pre, [data-testid="embed-snippet"]')
        .or(page.getByText(/widget\.js|data-token/i));
      const hasSnippet = await snippet.first().isVisible({ timeout: 15_000 }).catch(() => false);
      expect(hasSnippet).toBe(true);
    });
  });

  test.describe('5. Save', () => {
    test('5.1 @regression should have save button', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const saveBtn = page.getByRole('button', { name: /salvar|save/i });
      const hasSave = await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasSave).toBe(true);
    });

    test('5.2 @regression save button should be disabled when form is not dirty', async ({ page }) => {
      await page.goto('/app/settings/widget');

      // Wait for form to load
      await page.waitForTimeout(2_000);

      const saveBtn = page.getByRole('button', { name: /salvar widget|save widget/i });
      const hasSave = await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSave) {
        const isDisabled = await saveBtn.first().isDisabled().catch(() => false);
        expect(isDisabled).toBe(true);
      }
    });

    test('5.3 @regression should enable save button after making changes', async ({ page }) => {
      await page.goto('/app/settings/widget');

      const nameInput = page.getByLabel(/nome/i);
      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasName) {
        await nameInput.first().clear();
        await nameInput.first().fill('Widget Alterado');

        const saveBtn = page.getByRole('button', { name: /salvar|save/i });
        const hasSave = await saveBtn.first().isVisible().catch(() => false);

        if (hasSave) {
          const isEnabled = await saveBtn.first().isEnabled().catch(() => false);
          expect(isEnabled).toBe(true);
        }
      }
    });
  });

  test.describe('6. Error Handling', () => {
    test('6.1 @regression should handle API error gracefully', async ({ page }) => {
      await page.route('**/api/v1/tenants/*/widget-config', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/widget');
      await page.waitForTimeout(3_000);

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('7. Responsividade', () => {
    test('7.1 @regression should display on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/settings/widget');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('7.2 @regression should display on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/settings/widget');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
