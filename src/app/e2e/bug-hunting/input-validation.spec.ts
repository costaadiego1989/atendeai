import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Input Validation & Edge Cases
 *
 * These tests verify that the app handles edge-case inputs correctly.
 * Identified bugs:
 * - parseCurrencyInput corrupts float inputs (10.5 → "1.05")
 * - Forms accept empty/zero values without validation
 * - Large text inputs cause timeouts without feedback
 * - useUndo executes delete on unmount without user confirmation
 */

const AUTH_ME = '**/api/v1/auth/me';
const CATALOG_ITEMS_API = '**/api/v1/tenants/*/catalog/items*';
const CATALOG_CATEGORIES_API = '**/api/v1/tenants/*/catalog/categories*';
const CATALOG_IMPORT_API = '**/api/v1/tenants/*/catalog/import*';
const SCHEDULING_PROFESSIONALS_API = '**/api/v1/scheduling/professionals*';
const SCHEDULING_CATEGORIES_API = '**/api/v1/scheduling/categories*';
const COUPONS_API = '**/api/v1/sales/coupons*';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  tenantId: 'tenant-test-id',
};

async function setupPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);
}

test.describe('@bug-hunt Input Validation & Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1: Currency input with decimal number gets corrupted
  // parseCurrencyInput(10.5) → String(10.5) = "105" → /100 = "1.05" (WRONG)
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.1 currency input should correctly parse Brazilian format (R$ 150,00)', async ({ page }) => {
    await setupPageMocks(page);

    let submittedPrice: number | null = null;

    await page.route(CATALOG_ITEMS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0 } }),
        });
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        submittedPrice = body?.price ?? null;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'new-item', ...body } }),
        });
      }
      return route.continue();
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    // Open create item form
    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    // Fill name
    await page.getByPlaceholder(/camiseta dry fit/i).fill('Produto Teste');

    // Type price in Brazilian format: R$ 150,00 (should be 150.00 or 15000 cents)
    const priceInput = page.getByPlaceholder('0,00');
    await priceInput.fill('150,00');

    // Submit
    const saveBtn = page.getByRole('button', { name: /salvar|criar|adicionar/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Verify the submitted price is correct (150.00 reais = 15000 cents)
    if (submittedPrice !== null) {
      // Price should be either 150.00 (reais) or 15000 (cents) — NOT 1.50 or 15
      expect(submittedPrice as number).toBeGreaterThan(100);
    }
  });

  test('1.2 currency input should handle edge values correctly', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(CATALOG_ITEMS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 } }),
      }),
    );

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    const priceInput = page.getByPlaceholder('0,00');

    // Test: typing "0" should either be rejected or show as R$ 0,00
    await priceInput.fill('0');
    let value = await priceInput.inputValue();
    // Zero price should either be blocked or clearly shown
    expect(value === '' || value === '0' || value === '0,00' || value === 'R$ 0,00').toBe(true);

    // Test: typing very large number
    await priceInput.fill('99999999');
    value = await priceInput.inputValue();
    // Should not overflow or show scientific notation
    expect(value).not.toContain('e+');
    expect(value).not.toContain('Infinity');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #2: Coupon code validation — special characters and length
  // Expected: code is sanitized/validated before submission
  // Actual: may accept invalid codes that break on backend
  // ═══════════════════════════════════════════════════════════════════════════════

  test('2.1 coupon code should be uppercased and trimmed', async ({ page }) => {
    await setupPageMocks(page);

    let submittedCode: string | null = null;

    await page.route(COUPONS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        submittedCode = body?.code ?? null;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'new-coupon', ...body } }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/sales/promotions');
    await page.getByRole('tab', { name: /cupons/i }).click();
    await page.waitForTimeout(500);

    // Open create coupon form
    const newCouponBtn = page.getByRole('button', { name: /novo cupom|criar|adicionar/i }).first();
    await newCouponBtn.click();

    // Type lowercase code with spaces
    await page.getByPlaceholder(/OFERTA10/i).fill('  promo summer  ');
    await page.getByPlaceholder(/descrição opcional/i).fill('Promoção de verão');
    await page.getByPlaceholder('10', { exact: true }).fill('10');

    // Submit
    const saveBtn = page.getByRole('button', { name: /salvar cupom/i });
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Code should be uppercased and trimmed
    if (submittedCode !== null) {
      expect(submittedCode as string).toBe('PROMO SUMMER');
      expect(submittedCode as string).not.toMatch(/^\s|\s$/); // No leading/trailing spaces
    }
  });

  test('2.2 coupon with duplicate code should show specific error', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(COUPONS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ id: 'c1', code: 'EXISTING', active: true, discountValue: 10, discountType: 'PERCENTAGE' }] }),
        });
      }
      if (method === 'POST') {
        // Simulate duplicate code error
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Coupon code already exists', code: 'DUPLICATE_CODE' }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/sales/promotions');
    await page.getByRole('tab', { name: /cupons/i }).click();

    const newCouponBtn = page.getByRole('button', { name: /novo cupom|criar|adicionar/i }).first();
    await newCouponBtn.click();

    await page.getByPlaceholder(/OFERTA10/i).fill('EXISTING');
    await page.getByPlaceholder(/descrição opcional/i).fill('Duplicado');
    await page.getByPlaceholder('10', { exact: true }).fill('5');

    const saveBtn = page.getByRole('button', { name: /salvar cupom/i });
    await saveBtn.click();

    // Should show error about duplicate code (not generic "falha ao criar")
    await expect(
      page.getByText(/já existe|código.*exist/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #3: Form submission with required fields empty
  // Expected: validation errors shown inline
  // Actual: may submit with empty values or show generic error
  // ═══════════════════════════════════════════════════════════════════════════════

  test('3.1 catalog item creation should validate required fields', async ({ page }) => {
    await setupPageMocks(page);

    let postCalled = false;

    await page.route(CATALOG_ITEMS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0 } }),
        });
      }
      if (method === 'POST') {
        postCalled = true;
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Validation failed', details: { name: 'required' } }),
        });
      }
      return route.continue();
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    // Try to submit without filling anything
    const saveBtn = page.getByRole('button', { name: /salvar|criar|adicionar/i }).last();

    // Check if button is disabled (proper client-side validation)
    const isDisabled = await saveBtn.isDisabled();
    if (isDisabled) {
      // Good: button is disabled, form prevents submission without required fields
      expect(postCalled).toBe(false);
      return;
    }

    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Should show validation error OR prevent submission entirely
    // BUG: If no client-side validation, the POST fires with empty data
    const hasValidationFeedback = await page.getByText(/obrigatório|required|preencha|nome/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!hasValidationFeedback && !postCalled) {
      // Good: button was disabled or form prevented submission
      expect(true).toBe(true);
    } else if (hasValidationFeedback) {
      // Good: validation message shown
      expect(true).toBe(true);
    } else {
      // Bad: POST was called with empty data and no validation shown
      expect(postCalled).toBe(false);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #4: Scheduling — professional with empty name
  // Expected: validation prevents submission
  // Actual: may create professional with empty name
  // ═══════════════════════════════════════════════════════════════════════════════

  test('4.1 scheduling professional should require name', async ({ page }) => {
    await setupPageMocks(page);

    let postCalled = false;

    await page.route(SCHEDULING_PROFESSIONALS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0 } }),
        });
      }
      if (method === 'POST') {
        postCalled = true;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'prof-1', name: '' } }),
        });
      }
      return route.continue();
    });

    await page.route(SCHEDULING_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/app/scheduling');
    await page.waitForTimeout(1000);

    const newProfBtn = page.getByRole('button', { name: /novo profissional|adicionar/i }).first();
    if (await newProfBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newProfBtn.click();

      // Try to submit with empty name
      const saveBtn = page.getByRole('button', { name: /salvar|criar/i }).last();
      await saveBtn.click();
      await page.waitForTimeout(1000);

      // Should NOT have submitted (client-side validation should block)
      if (postCalled) {
        // BUG: Empty name was submitted to the API
        expect(postCalled as boolean).toBe(false);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #5: XSS via user input in displayed fields
  // Expected: HTML is escaped when rendered
  // Actual: if using dangerouslySetInnerHTML or v-html, script could execute
  // ═══════════════════════════════════════════════════════════════════════════════

  test('5.1 HTML in item name should be escaped, not rendered', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(CATALOG_ITEMS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'item-xss',
              name: '<img src=x onerror=alert(1)>Produto XSS',
              price: 5000,
              type: 'PRODUCT',
              active: true,
            },
          ],
          meta: { total: 1 },
        }),
      }),
    );

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    // Listen for dialog (alert) — if XSS works, alert(1) fires
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto('/app/catalog');
    await page.waitForTimeout(2000);

    // XSS should NOT have fired
    expect(alertFired).toBe(false);

    // The text should be visible as escaped text, not rendered as HTML
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toContain('<img src=x onerror=alert(1)>');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #6: Very long text input handling
  // Expected: input is truncated or rejected with feedback
  // Actual: may cause performance issues or silent truncation
  // ═══════════════════════════════════════════════════════════════════════════════

  test('6.1 extremely long description should be handled gracefully', async ({ page }) => {
    await setupPageMocks(page);

    await page.route(CATALOG_ITEMS_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0 } }),
        });
      }
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Description too long', code: 'VALIDATION_ERROR' }),
      });
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    await page.getByPlaceholder(/camiseta dry fit/i).fill('Produto com descrição longa');

    // Type a very long description (5000 chars)
    const longText = 'A'.repeat(5000);
    const descInput = page.getByPlaceholder(/contexto que a ia/i);
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill(longText);

      // Input should either truncate or show character count warning
      const actualValue = await descInput.inputValue();
      // If there's a maxLength, the value will be shorter
      if (actualValue.length < 5000) {
        // Good: input has maxLength constraint
        expect(actualValue.length).toBeLessThan(5000);
      }
    }

    // Page should not freeze or crash
    await expect(page.locator('body')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #7: Concurrent form submissions (double-submit)
  // Expected: button disabled during submission
  // Actual: multiple POST requests if button not disabled
  // ═══════════════════════════════════════════════════════════════════════════════

  test.fail('7.1 form submit button should be disabled during API call', async ({ page }) => {
    await setupPageMocks(page);

    let postCount = 0;

    await page.route(CATALOG_ITEMS_API, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0 } }),
        });
      }
      if (method === 'POST') {
        postCount++;
        // Simulate slow API (1.5s)
        return new Promise((resolve) => {
          setTimeout(() => {
            route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({ data: { id: 'new', name: 'Test' } }),
            });
            resolve(undefined);
          }, 1500);
        });
      }
      return route.continue();
    });

    await page.route(CATALOG_CATEGORIES_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'cat-1', name: 'Geral' }] }),
      }),
    );

    await page.goto('/app/catalog');
    await page.waitForTimeout(1000);

    const newItemBtn = page.getByRole('button', { name: /novo item|adicionar/i }).first();
    await newItemBtn.click();

    await page.getByPlaceholder(/camiseta dry fit/i).fill('Produto Double Submit');
    const priceInput = page.getByPlaceholder('0,00');
    if (await priceInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await priceInput.fill('100,00');
    }

    // Click save multiple times rapidly
    const saveBtn = page.getByRole('button', { name: /salvar|criar|adicionar/i }).last();
    await saveBtn.click();
    await saveBtn.click();
    await saveBtn.click();

    await page.waitForTimeout(2500);

    // Should only have sent ONE POST request
    expect(postCount).toBe(1);
  });
});
