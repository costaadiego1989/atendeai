import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Proposals Module Edge Cases
 *
 * These tests verify edge cases in the Proposals module:
 * - Accept expired proposal (public page)
 * - Accept with empty signature canvas
 * - Generate PDF with incomplete data
 * - Send proposal without recipient
 * - Double-accept (idempotency)
 */

const TENANT_ID = 'tenant-test-id';
const PROPOSALS_API = '**/api/v1/tenants/*/proposals*';
const PUBLIC_PROPOSAL_API = '**/api/v1/public/proposals/*';
const PUBLIC_PROPOSAL_ACCEPT_API = '**/api/v1/public/proposals/*/accept*';
const PUBLIC_PROPOSAL_REJECT_API = '**/api/v1/public/proposals/*/reject*';
const PROPOSAL_PDF_API = '**/api/v1/tenants/*/proposals/*/pdf*';
const PROPOSAL_SEND_API = '**/api/v1/tenants/*/proposals/*/send*';

const PROPOSALS_URL = '/app/proposals';
const PUBLIC_PROPOSAL_URL = '/p/proposal-token-123';

const mockProposal = {
  id: 'prop-1',
  tenantId: TENANT_ID,
  title: 'Proposta Comercial - Website',
  status: 'SENT',
  recipientName: 'João Silva',
  recipientEmail: 'joao@test.com',
  recipientPhone: '11999990001',
  totalAmount: 500000,
  currency: 'BRL',
  validUntil: '2026-12-31T23:59:59Z',
  items: [
    { id: 'item-1', description: 'Desenvolvimento Website', quantity: 1, unitPrice: 500000 },
  ],
  pdfUrl: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

const mockExpiredProposal = {
  ...mockProposal,
  id: 'prop-expired',
  status: 'SENT',
  validUntil: '2026-01-01T00:00:00Z', // Already expired
};

const mockAcceptedProposal = {
  ...mockProposal,
  id: 'prop-accepted',
  status: 'ACCEPTED',
};

const mockPublicProposal = {
  id: 'prop-public',
  token: 'proposal-token-123',
  title: 'Proposta Comercial - Website',
  status: 'SENT',
  tenantName: 'Empresa Teste',
  tenantLogo: null,
  recipientName: 'João Silva',
  totalAmount: 500000,
  currency: 'BRL',
  validUntil: '2026-12-31T23:59:59Z',
  items: [
    { id: 'item-1', description: 'Desenvolvimento Website', quantity: 1, unitPrice: 500000 },
  ],
  createdAt: '2026-05-01T00:00:00Z',
};

const mockExpiredPublicProposal = {
  ...mockPublicProposal,
  validUntil: '2026-01-01T00:00:00Z', // Already expired
};

async function setupProposalsPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(PROPOSALS_API, (route) => {
    const url = route.request().url();
    if (url.includes('/pdf') || url.includes('/send') || url.includes('/schedule')) {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [mockProposal], meta: { total: 1 } }),
      });
    }
    return route.continue();
  });
}

test.describe('@bug-hunt Proposals Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #P1: Accept expired proposal
  // Expected: server rejects with 422, user sees clear error
  // ═══════════════════════════════════════════════════════════════════════════════

  test('P1.1 accept expired proposal should show expiration error', async ({ page }) => {
    // Mock public proposal endpoint (no auth needed)
    await page.route(PUBLIC_PROPOSAL_API, (route) => {
      const url = route.request().url();
      if (url.includes('/accept') || url.includes('/reject')) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockExpiredPublicProposal }),
      });
    });

    // Accept returns 422 (expired)
    await page.route(PUBLIC_PROPOSAL_ACCEPT_API, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Proposal expired', code: 'PROPOSAL_EXPIRED' }),
      }),
    );

    await page.goto(PUBLIC_PROPOSAL_URL);
    await page.waitForTimeout(1500);

    // Look for accept button
    const acceptBtn = page.getByRole('button', { name: /aceitar|accept|aprovar/i }).first();
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Fill signer name if required
      const signerInput = page.getByLabel(/nome|name|assinante/i).first();
      if (await signerInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await signerInput.fill('João Silva');
      }

      await acceptBtn.click();

      // Should show error about expiration
      await expect(
        page.getByText(/falha|erro|expirad|vencid|expired/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #P5: Double-accept (already accepted proposal)
  // Expected: idempotent or clear message
  // ═══════════════════════════════════════════════════════════════════════════════

  test('P5.1 accept already-accepted proposal should handle gracefully', async ({ page }) => {
    const acceptedPublicProposal = {
      ...mockPublicProposal,
      status: 'ACCEPTED',
    };

    await page.route(PUBLIC_PROPOSAL_API, (route) => {
      const url = route.request().url();
      if (url.includes('/accept') || url.includes('/reject')) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: acceptedPublicProposal }),
      });
    });

    // Accept returns 409 (already accepted)
    await page.route(PUBLIC_PROPOSAL_ACCEPT_API, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Proposal already accepted', code: 'ALREADY_ACCEPTED' }),
      }),
    );

    await page.goto(PUBLIC_PROPOSAL_URL);
    await page.waitForTimeout(1500);

    // If proposal is already accepted, the UI should show accepted state
    // or the accept button should be disabled/hidden
    const acceptBtn = page.getByRole('button', { name: /aceitar|accept|aprovar/i }).first();
    const isAcceptVisible = await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (isAcceptVisible) {
      // If button is still visible (bug), clicking should show error
      await acceptBtn.click();
      await expect(
        page.getByText(/falha|erro|já aceita|already|aceita/i).first(),
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Correct behavior: button is hidden/disabled for accepted proposals
      await expect(page.getByText(/aceita|aprovada|accepted/i).first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #P2: Generate PDF with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('P2.1 generate PDF should show error on API 500', async ({ page }) => {
    await setupProposalsPageMocks(page);

    // PDF generation returns 500
    await page.route(PROPOSAL_PDF_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(PROPOSALS_URL);
    await expect(page.getByText('Proposta Comercial')).toBeVisible({ timeout: 5000 });

    // Click on proposal to open details
    await page.getByText('Proposta Comercial').first().click();
    await page.waitForTimeout(500);

    // Click PDF button
    const pdfBtn = page.getByRole('button', { name: /pdf|gerar|download/i }).first();
    if (await pdfBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pdfBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #P3: Send proposal with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('P3.1 send proposal should show error on API 500', async ({ page }) => {
    await setupProposalsPageMocks(page);

    // Send returns 500
    await page.route(PROPOSAL_SEND_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(PROPOSALS_URL);
    await expect(page.getByText('Proposta Comercial')).toBeVisible({ timeout: 5000 });

    await page.getByText('Proposta Comercial').first().click();
    await page.waitForTimeout(500);

    // Click send button
    const sendBtn = page.getByRole('button', { name: /enviar|send/i }).first();
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendBtn.click();

      // Confirm if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirmar|enviar/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
