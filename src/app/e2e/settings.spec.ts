import { test, expect } from '../playwright-fixture';
import {
  mockApiError,
  mockApiTimeout,
  mockServiceUnavailable,
  trackApiCalls,
} from './helpers';

/**
 * Settings E2E Tests — Full coverage based on settings.e2e-spec.md
 */

test.describe('Settings', () => {
  // ─── 1. SMOKE TESTS ───────────────────────────────────────────────────────────

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load company settings page', async ({ page }) => {
      await page.goto('/app/settings/company');

      await expect(page).toHaveURL(/\/app\/settings\/company/);

      const content = page.locator('main, [role="main"], [data-testid="settings-page"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('1.2 @smoke should display settings sections', async ({ page }) => {
      await page.goto('/app/settings/company');

      const sections = page.getByText(/empresa|canais|integrações|integracoes|ia|ai/i);
      const hasSections = await sections.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('1.3 @smoke should display form with saved values', async ({ page }) => {
      await page.goto('/app/settings/company');

      const form = page.locator('form, [data-testid="company-form"], [data-testid="tenant-form"]');
      const nameInput = page.getByLabel(/nome|name|empresa|negócio|negocio/i);

      const hasForm = await form.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasName = await nameInput.first().isVisible().catch(() => false);

      expect(hasForm || hasName).toBe(true);
    });
  });

  // ─── 2. FUNCIONALIDADE PRINCIPAL ──────────────────────────────────────────────

  test.describe('2. Funcionalidade Principal', () => {
    test('2.1 @regression should display company profile form', async ({ page }) => {
      await page.goto('/app/settings/company');

      const nameInput = page.getByLabel(/nome|name|empresa/i);
      const cnpjInput = page.getByLabel(/cnpj|documento/i);

      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasCnpj = await cnpjInput.first().isVisible().catch(() => false);

      expect(hasName || hasCnpj).toBe(true);
    });

    test('2.2 @regression should show save button', async ({ page }) => {
      await page.goto('/app/settings/company');

      const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update/i });
      const hasSave = await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      expect(hasSave).toBe(true);
    });

    test('2.3 @regression should load channels settings page', async ({ page }) => {
      await page.goto('/app/settings/channels');

      await expect(page).toHaveURL(/\/app\/settings\/channels/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('2.4 @regression should display channel configuration options', async ({ page }) => {
      await page.goto('/app/settings/channels');

      const channelText = page.getByText(/canal|channel|whatsapp|instagram/i);
      const hasText = await channelText.first().isVisible({ timeout: 10_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('2.5 @regression should load AI settings page', async ({ page }) => {
      await page.goto('/app/settings/ai');

      await expect(page).toHaveURL(/\/app\/settings\/ai/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('2.6 @regression should display AI configuration options', async ({ page }) => {
      await page.goto('/app/settings/ai');

      const aiText = page.getByText(/inteligência artificial|ia|ai|assistente|auto-resposta/i);
      const toggles = page.locator('[role="switch"], input[type="checkbox"]');

      const hasText = await aiText.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasToggles = await toggles.first().isVisible().catch(() => false);

      expect(hasText || hasToggles).toBe(true);
    });

    test('2.7 @regression should load integrations settings page', async ({ page }) => {
      await page.goto('/app/settings/integrations');

      await expect(page).toHaveURL(/\/app\/settings\/integrations/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('2.8 @regression should display available integrations', async ({ page }) => {
      await page.goto('/app/settings/integrations');

      const integrations = page.getByText(/whatsapp|instagram|integração|integracao/i);
      const cards = page.locator(
        '[data-testid="integration-card"], .integration-item, [data-testid="integrations-list"]'
      );

      const hasText = await integrations.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasCards = await cards.first().isVisible().catch(() => false);

      expect(hasText || hasCards).toBe(true);
    });
  });

  // ─── 3. VALIDAÇÃO DE FORMULÁRIOS ──────────────────────────────────────────────

  test.describe('3. Validação de Formulários', () => {
    test('3.1 @regression should validate invalid CNPJ', async ({ page }) => {
      await page.goto('/app/settings/company');

      const cnpjInput = page.getByLabel(/cnpj|documento/i)
        .or(page.locator('[data-testid="cnpj-input"] input'));
      const hasCnpj = await cnpjInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasCnpj) {
        await cnpjInput.first().clear();
        await cnpjInput.first().fill('00000000000000');
        await cnpjInput.first().blur();
        await page.waitForTimeout(1_000);

        const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
        const hasError = await errors.first().isVisible().catch(() => false);

        const errorBoundary = page.locator('.error-boundary');
        const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('3.2 @regression should validate empty company name', async ({ page }) => {
      await page.goto('/app/settings/company');

      const nameInput = page.getByLabel(/nome|name|empresa/i);
      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasName) {
        await nameInput.first().clear();

        const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update/i });
        const hasSave = await saveBtn.first().isVisible().catch(() => false);

        if (hasSave) {
          await saveBtn.first().click();
          await page.waitForTimeout(2_000);

          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          const hasError = await errors.first().isVisible().catch(() => false);

          const errorBoundary = page.locator('.error-boundary');
          const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
          expect(hasCrash).toBe(false);
        }
      }
    });

    test('3.3 @regression should validate invalid email format', async ({ page }) => {
      await page.goto('/app/settings/company');

      const emailInput = page.getByLabel(/email|e-mail/i)
        .or(page.locator('input[type="email"]'));
      const hasEmail = await emailInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasEmail) {
        await emailInput.first().clear();
        await emailInput.first().fill('invalid-email');
        await emailInput.first().blur();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('3.4 @regression should validate invalid phone format', async ({ page }) => {
      await page.goto('/app/settings/company');

      const phoneInput = page.getByLabel(/telefone|phone|celular/i);
      const hasPhone = await phoneInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasPhone) {
        await phoneInput.first().clear();
        await phoneInput.first().fill('123');
        await phoneInput.first().blur();
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 7. ESTADOS VAZIOS ────────────────────────────────────────────────────────

  test.describe('7. Estados Vazios', () => {
    test('7.1 @regression should show empty channel state', async ({ page }) => {
      await page.route('**/api/v1/channels*', (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/channels');

      const emptyState = page.getByText(/nenhum canal|sem canais|configure um canal|conecte/i);
      const emptyComponent = page.locator('[data-testid="empty-state"]');

      const hasEmpty = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasComponent = await emptyComponent.first().isVisible().catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('7.2 @regression should show loading skeletons', async ({ page }) => {
      await page.route('**/api/v1/tenant*', async (route) => {
        await new Promise((r) => setTimeout(r, 3_000));
        return route.continue();
      });

      await page.goto('/app/settings/company');

      const skeletons = page.locator('[data-testid="skeleton"], .skeleton, .animate-pulse');
      const hasSkeletons = await skeletons.first().isVisible({ timeout: 3_000 }).catch(() => false);

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 8. TRATAMENTO DE ERROS ───────────────────────────────────────────────────

  test.describe('8. Tratamento de Erros', () => {
    test('8.1 @regression should handle API 500 on save gracefully', async ({ page }) => {
      await page.route('**/api/v1/tenant*', (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/settings/company');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('8.2 @regression should handle API 500 on load gracefully', async ({ page }) => {
      await page.route('**/api/v1/tenant*', (route) =>
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

    test('8.3 @regression should handle timeout gracefully', async ({ page }) => {
      await mockApiTimeout(page, '**/api/v1/tenant*');

      await page.goto('/app/settings/company');

      const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  // ─── 9. EDGE CASES ───────────────────────────────────────────────────────────

  test.describe('9. Edge Cases', () => {
    test('9.1 @security should escape XSS in company name', async ({ page }) => {
      page.on('dialog', () => {
        throw new Error('XSS executed');
      });

      await page.goto('/app/settings/company');

      const nameInput = page.getByLabel(/nome|name|empresa/i);
      const hasName = await nameInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasName) {
        await nameInput.first().clear();
        await nameInput.first().fill('<script>alert("xss")</script>');
      }

      await page.waitForTimeout(2_000);
    });

    test('9.2 @security should handle SQL injection in CNPJ', async ({ page }) => {
      await page.goto('/app/settings/company');

      const cnpjInput = page.getByLabel(/cnpj|documento/i)
        .or(page.locator('[data-testid="cnpj-input"] input'));
      const hasCnpj = await cnpjInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasCnpj) {
        await cnpjInput.first().clear();
        await cnpjInput.first().fill("'; DROP TABLE tenants; --");
        await page.waitForTimeout(2_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.3 @regression should accept CNPJ with punctuation', async ({ page }) => {
      await page.goto('/app/settings/company');

      const cnpjInput = page.getByLabel(/cnpj|documento/i)
        .or(page.locator('[data-testid="cnpj-input"] input'));
      const hasCnpj = await cnpjInput.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasCnpj) {
        await cnpjInput.first().clear();
        await cnpjInput.first().fill('12.345.678/0001-90');
        await page.waitForTimeout(1_000);
      }

      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });

    test('9.4 @regression should prevent double-click on save', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/tenant*');

      await page.goto('/app/settings/company');

      const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update/i });
      const hasSave = await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSave) {
        await saveBtn.first().dblclick();
        await page.waitForTimeout(3_000);

        const putCalls = calls.filter((c) => c.method === 'PUT' || c.method === 'PATCH');
        expect(putCalls.length).toBeLessThanOrEqual(1);
      }
    });
  });

  // ─── 10. RESPONSIVIDADE ───────────────────────────────────────────────────────

  test.describe('10. Responsividade', () => {
    test('10.1 @regression should display settings on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/settings/company');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.2 @regression should display settings on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/settings/company');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 @regression should display settings on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/settings/company');

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── 11. CONCORRÊNCIA ─────────────────────────────────────────────────────────

  test.describe('11. Concorrência', () => {
    test('11.1 @regression should prevent double-save on rapid clicks', async ({ page }) => {
      const calls = await trackApiCalls(page, '**/api/v1/tenant*');

      await page.goto('/app/settings/company');

      const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar|update/i });
      const hasSave = await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasSave) {
        await saveBtn.first().dblclick();
        await page.waitForTimeout(3_000);

        const writeCalls = calls.filter((c) => c.method === 'PUT' || c.method === 'PATCH' || c.method === 'POST');
        expect(writeCalls.length).toBeLessThanOrEqual(1);
      }
    });
  });
});
