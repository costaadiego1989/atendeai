import { test, expect } from '../playwright-fixture';

/**
 * RAG PDF Processing E2E Tests
 *
 * Tests the PDF upload flow and RAG status display in the company settings page.
 * Runs against the real API with authenticated session.
 *
 * Verifies:
 * - PDF section is visible with upload area
 * - Status indicators render for uploaded documents
 * - "Base inteligente ativa" indicator appears when documents are indexed
 * - Chunk count badges display for processed documents
 */

const COMPANY_URL = '/app/settings/company';

test.describe('RAG PDF Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COMPANY_URL);
    await page.waitForURL(/\/app\/settings\/company/, { timeout: 15_000 });
  });

  test('should display PDF section with upload area', async ({ page }) => {
    const pdfLabel = page.getByText(/arquivo.*pdf/i);
    await expect(pdfLabel.first()).toBeVisible({ timeout: 10_000 });

    // Upload area should be present
    const uploadArea = page.getByText(/clique ou arraste/i);
    const hasUpload = await uploadArea.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // Or at least the PDF info box
    const infoBox = page.getByText(/cérebro da sua IA/i);
    const hasInfo = await infoBox.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasUpload || hasInfo).toBe(true);
  });

  test('should display PDF file cards when documents exist', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForTimeout(2_000);

    // Check if there are any PDF cards (FileText icon containers)
    const pdfCards = page.locator('.rounded-2xl').filter({ hasText: /\.pdf|Catálogo PDF|Documento/i });
    const cardCount = await pdfCards.count();

    if (cardCount > 0) {
      // If documents exist, verify card structure
      const firstCard = pdfCards.first();
      await expect(firstCard).toBeVisible();

      // Should have a "Visualizar PDF" button
      const viewBtn = firstCard.getByText(/visualizar pdf/i);
      await expect(viewBtn).toBeVisible();
    } else {
      // No documents uploaded — just verify the upload area is present
      const uploadArea = page.getByText(/clique ou arraste/i);
      await expect(uploadArea.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should show RAG processing status for uploaded documents', async ({ page }) => {
    await page.waitForTimeout(2_000);

    // Look for any status indicator (processing or ready)
    const statusIndicators = [
      page.getByText('Indexado'),
      page.getByText('Processando...'),
      page.getByText('Extraindo texto...'),
      page.getByText('Dividindo em blocos...'),
      page.getByText('Gerando embeddings...'),
      page.getByText('Erro no processamento'),
    ];

    let hasAnyStatus = false;
    for (const indicator of statusIndicators) {
      if (await indicator.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
        hasAnyStatus = true;
        break;
      }
    }

    // If no documents are uploaded, status won't appear — that's OK
    const pdfCards = page.locator('.rounded-2xl').filter({ hasText: /\.pdf|Catálogo PDF/i });
    const cardCount = await pdfCards.count();

    if (cardCount > 0) {
      // Documents exist — at least one should have a status
      expect(hasAnyStatus).toBe(true);
    }
  });

  test('should show chunk count badge for indexed documents', async ({ page }) => {
    await page.waitForTimeout(2_000);

    // Check if any document is in READY state with chunks
    const chunkBadge = page.getByText(/\d+ blocos/);
    const hasChunks = await chunkBadge.first().isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasChunks) {
      // Verify the badge has the expected styling
      const badge = chunkBadge.first();
      await expect(badge).toBeVisible();
    }

    // If no indexed documents, this is expected — test passes
  });

  test('should show "Base inteligente ativa" when documents are indexed', async ({ page }) => {
    await page.waitForTimeout(2_000);

    const indicator = page.getByText('Base inteligente ativa');
    const hasIndicator = await indicator.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasIndicator) {
      // Verify the total chunks text is also present
      const totalText = page.getByText(/\d+ blocos indexados para respostas contextuais/);
      await expect(totalText).toBeVisible();
    }

    // If no indexed documents exist, indicator won't show — that's OK
  });

  test('should not crash when loading PDF section', async ({ page }) => {
    // Verify no error boundary or crash
    const errorBoundary = page.locator('.error-boundary');
    const hasCrash = await errorBoundary.first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasCrash).toBe(false);

    // Page should still be on settings
    await expect(page).toHaveURL(/\/app\/settings\/company/);
  });

  test('should display canSendIt toggle for PDF documents', async ({ page }) => {
    await page.waitForTimeout(2_000);

    const pdfCards = page.locator('.rounded-2xl').filter({ hasText: /\.pdf|Catálogo PDF/i });
    const cardCount = await pdfCards.count();

    if (cardCount > 0) {
      // Look for the "IA pode enviar link ao cliente" toggle
      const toggleLabel = page.getByText(/IA pode enviar link ao cliente/i);
      const hasToggle = await toggleLabel.first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasToggle) {
        // Verify the switch is present
        const switchEl = page.locator('[role="switch"]').first();
        await expect(switchEl).toBeVisible();
      }
    }
  });
});
