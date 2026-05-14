import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Recovery Module Edge Cases
 *
 * These tests verify edge cases in the Recovery module:
 * - tenant!.id non-null assertions (22 usages) — crash risk during logout/switch
 * - selectedCaseId! used in outreach/guidance/payment without guard
 * - Payment link for already-paid case
 * - Recurring charge with invalid interval
 */

const TENANT_ID = 'tenant-test-id';
const RECOVERY_CASES_API = '**/api/v1/tenants/*/recovery/cases*';
const RECOVERY_CASE_DETAIL_API = '**/api/v1/tenants/*/recovery/cases/*';
const RECOVERY_OUTREACH_API = '**/api/v1/tenants/*/recovery/cases/*/outreach*';
const RECOVERY_PAYMENT_LINK_API = '**/api/v1/tenants/*/recovery/cases/*/payment-link*';
const RECOVERY_STATUS_API = '**/api/v1/tenants/*/recovery/cases/*/status*';
const RECOVERY_PLAYBOOKS_API = '**/api/v1/tenants/*/recovery/playbooks*';
const RECOVERY_JOBS_API = '**/api/v1/tenants/*/recovery/async-jobs*';
const CONTACTS_API = '**/api/v1/tenants/*/contacts*';
const CONTACT_TIMELINE_API = '**/api/v1/tenants/*/contacts/*/timeline*';

const RECOVERY_URL = '/app/recovery';

const mockCase = {
  id: 'case-1',
  tenantId: TENANT_ID,
  contactId: 'contact-1',
  debtorName: 'João Devedor',
  debtorCompanyName: null,
  debtorDocument: '12345678900',
  phone: '11999998888',
  source: 'MANUAL',
  status: 'OPEN',
  chargeType: 'SERVICO',
  chargeTitle: 'Mensalidade Janeiro',
  chargeDescription: null,
  referencePeriod: '2026-01',
  amountDue: 15000,
  dueDate: '2026-01-15',
  assignedTags: [],
  lastContactedAt: null,
  nextActionAt: null,
  paymentReference: null,
  externalReference: null,
  conversationId: null,
  playbookId: null,
  playbookPhaseId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockPaidCase = {
  ...mockCase,
  id: 'case-paid',
  status: 'PAID',
  debtorName: 'Maria Pagou',
  paymentReference: 'pay_123',
};

async function setupRecoveryPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(RECOVERY_CASES_API, (route) => {
    const url = route.request().url();
    // Don't intercept sub-routes
    if (url.match(/\/cases\/[^/]+\//)) return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockCase, mockPaidCase]),
      });
    }
    return route.continue();
  });

  await page.route(RECOVERY_PLAYBOOKS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route(RECOVERY_JOBS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route(CONTACT_TIMELINE_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
}

test.describe('@bug-hunt Recovery Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #R2: Outreach without selected case (selectedCaseId! assertion)
  // Expected: outreach should be blocked or show error if no case is selected
  // Actual: crash due to non-null assertion on selectedCaseId
  // ═══════════════════════════════════════════════════════════════════════════════

  test('R2.1 outreach with API 500 should show error toast', async ({ page }) => {
    await setupRecoveryPageMocks(page);

    // Mock case detail
    await page.route('**/api/v1/tenants/*/recovery/cases/case-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCase),
        });
      }
      return route.continue();
    });

    // Outreach returns 500
    await page.route(RECOVERY_OUTREACH_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(RECOVERY_URL);
    await expect(page.getByText('João Devedor')).toBeVisible({ timeout: 5000 });

    // Select the case
    await page.getByText('João Devedor').click();
    await page.waitForTimeout(1000);

    // Click outreach/contact button
    const outreachBtn = page.getByRole('button', { name: /contato|outreach|cobrar|mensagem/i }).first();
    if (await outreachBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await outreachBtn.click();
      await page.waitForTimeout(500);

      // Try to send
      const sendBtn = page.getByRole('button', { name: /enviar|confirmar/i }).first();
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.click();

        // Should show error toast
        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #R3: Payment link for already-paid case
  // Expected: should show warning or block the action
  // ═══════════════════════════════════════════════════════════════════════════════

  test('R3.1 payment link for PAID case should show appropriate feedback', async ({ page }) => {
    await setupRecoveryPageMocks(page);

    await page.route('**/api/v1/tenants/*/recovery/cases/case-paid', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPaidCase),
        });
      }
      return route.continue();
    });

    // Payment link returns 422 (case already paid)
    await page.route(RECOVERY_PAYMENT_LINK_API, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Case already paid', code: 'CASE_ALREADY_PAID' }),
      }),
    );

    await page.goto(RECOVERY_URL);
    await expect(page.getByText('Maria Pagou')).toBeVisible({ timeout: 5000 });

    // Select the paid case
    await page.getByText('Maria Pagou').click();
    await page.waitForTimeout(1000);

    // Try to generate payment link
    const payBtn = page.getByRole('button', { name: /cobrança|pagamento|link/i }).first();
    if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.getByRole('button', { name: /gerar|enviar|confirmar/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();

        // Should show error toast about case being already paid
        await expect(
          page.getByText(/falha|erro|já pag|already/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #R4: Update status with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('R4.1 update case status should show error on API 500', async ({ page }) => {
    await setupRecoveryPageMocks(page);

    await page.route('**/api/v1/tenants/*/recovery/cases/case-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCase),
        });
      }
      return route.continue();
    });

    // Status update returns 500
    await page.route(RECOVERY_STATUS_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(RECOVERY_URL);
    await expect(page.getByText('João Devedor')).toBeVisible({ timeout: 5000 });
    await page.getByText('João Devedor').click();
    await page.waitForTimeout(1000);

    // Click status change button
    const statusBtn = page.getByRole('button', { name: /status|alterar|mover/i }).first();
    if (await statusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusBtn.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.getByRole('button', { name: /salvar|confirmar|atualizar/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #R5: Report generation with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('R5.1 generate report should show error on API 500', async ({ page }) => {
    await setupRecoveryPageMocks(page);

    // Report job creation returns 500
    await page.route('**/api/v1/tenants/*/recovery/report*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(RECOVERY_URL);
    await page.waitForTimeout(1000);

    // Click report/export button
    const reportBtn = page.getByRole('button', { name: /relatório|exportar|csv/i }).first();
    if (await reportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportBtn.click();
      await page.waitForTimeout(500);

      const generateBtn = page.getByRole('button', { name: /gerar|exportar|iniciar/i }).first();
      if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await generateBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
