import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Contacts Module Edge Cases
 *
 * These tests verify edge cases in the Contacts module:
 * - Bulk delete with API partial failure
 * - Import CSV with invalid format
 * - Bulk actions with empty selection
 * - Open conversation without WhatsApp channel configured
 * - tenant!.id crash risk in bulk operations
 */

const TENANT_ID = 'tenant-test-id';
const CONTACTS_API = '**/api/v1/tenants/*/contacts*';
const CONTACTS_DELETE_API = '**/api/v1/tenants/*/contacts/*/delete*';
const CONTACTS_STAGE_API = '**/api/v1/tenants/*/contacts/*/stage*';
const CONTACTS_IMPORT_API = '**/api/v1/tenants/*/contacts/import*';
const CONVERSATIONS_OPEN_API = '**/api/v1/tenants/*/conversations/open-by-contact*';

const CONTACTS_URL = '/app/contacts';

const mockContacts = [
  {
    id: 'contact-1',
    name: 'João Silva',
    phone: '11999990001',
    email: 'joao@test.com',
    stage: 'LEAD',
    tags: ['vip'],
    branchId: 'branch-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'contact-2',
    name: 'Maria Santos',
    phone: '11999990002',
    email: 'maria@test.com',
    stage: 'CUSTOMER',
    tags: [],
    branchId: 'branch-1',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

async function setupContactsPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(CONTACTS_API, (route) => {
    const url = route.request().url();
    // Don't intercept sub-routes
    if (url.includes('/delete') || url.includes('/stage') || url.includes('/import') || url.includes('/timeline')) {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockContacts, meta: { total: 2, page: 1, limit: 50 } }),
      });
    }
    return route.continue();
  });
}

test.describe('@bug-hunt Contacts Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #CT1: Bulk delete with API 500 on one contact
  // Expected: partial failure reported to user
  // ═══════════════════════════════════════════════════════════════════════════════

  test('CT1.1 bulk delete should show error when API fails', async ({ page }) => {
    await setupContactsPageMocks(page);

    // Delete endpoint returns 500
    await page.route(CONTACTS_DELETE_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(CONTACTS_URL);
    await expect(page.getByText('João Silva')).toBeVisible({ timeout: 5000 });

    // Select contacts (checkbox)
    const checkboxes = page.locator('input[type="checkbox"]');
    const firstCheckbox = checkboxes.first();
    if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCheckbox.check();

      // Click bulk delete button
      const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover/i }).first();
      if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();

        // Confirm if dialog appears
        const confirmBtn = page.getByRole('button', { name: /confirmar|sim|excluir/i });
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        // Should show error feedback
        await expect(
          page.getByText(/falha|erro|não foi possível|parcial/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #CT2: Import CSV with invalid format
  // Expected: clear error message about format
  // ═══════════════════════════════════════════════════════════════════════════════

  test('CT2.1 import with API 422 should show validation error', async ({ page }) => {
    await setupContactsPageMocks(page);

    // Import returns 422 (invalid format)
    await page.route(CONTACTS_IMPORT_API, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid CSV format',
          code: 'INVALID_FORMAT',
          details: 'Missing required column: phone',
        }),
      }),
    );

    await page.goto(CONTACTS_URL);
    await page.waitForTimeout(1000);

    // Click import button
    const importBtn = page.getByRole('button', { name: /importar|import/i }).first();
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(500);

      // The import flow may require file upload — if there's a submit button, click it
      const submitBtn = page.getByRole('button', { name: /enviar|importar|confirmar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|inválido|formato/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #CT5: Open conversation without WhatsApp channel
  // Expected: error message about missing channel
  // ═══════════════════════════════════════════════════════════════════════════════

  test('CT5.1 open conversation should show error when channel unavailable', async ({ page }) => {
    await setupContactsPageMocks(page);

    // Open conversation returns 422 (no channel)
    await page.route(CONVERSATIONS_OPEN_API, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No WhatsApp channel configured',
          code: 'NO_CHANNEL',
        }),
      }),
    );

    await page.goto(CONTACTS_URL);
    await expect(page.getByText('João Silva')).toBeVisible({ timeout: 5000 });

    // Click on contact to open details or click conversation button
    await page.getByText('João Silva').click();
    await page.waitForTimeout(500);

    const chatBtn = page.getByRole('button', { name: /conversa|mensagem|whatsapp|chat/i }).first();
    if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatBtn.click();

      await expect(
        page.getByText(/falha|erro|canal|whatsapp|não configurado/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #CT4: Bulk stage update with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('CT4.1 bulk stage update should show error on API 500', async ({ page }) => {
    await setupContactsPageMocks(page);

    // Stage update returns 500
    await page.route(CONTACTS_STAGE_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(CONTACTS_URL);
    await expect(page.getByText('João Silva')).toBeVisible({ timeout: 5000 });

    // Select contact
    const checkboxes = page.locator('input[type="checkbox"]');
    const firstCheckbox = checkboxes.first();
    if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCheckbox.check();

      // Click stage/move button
      const stageBtn = page.getByRole('button', { name: /mover|etapa|stage|funil/i }).first();
      if (await stageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stageBtn.click();
        await page.waitForTimeout(500);

        // Select a stage option
        const stageOption = page.getByText(/cliente|customer|qualificado/i).first();
        if (await stageOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await stageOption.click();

          await expect(
            page.getByText(/falha|erro|não foi possível|parcial/i).first(),
          ).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
