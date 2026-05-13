import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Sales module pages.
 * Covers: /app/sales/metrics, /app/sales/payment-links, /app/sales/promotions
 */
export class SalesPage extends BasePage {
  // ─── METRICS PAGE ───────────────────────────────────────────────────────────
  readonly metricsHeading: Locator;
  readonly rangeButton7d: Locator;
  readonly rangeButton30d: Locator;
  readonly rangeButton90d: Locator;
  readonly refreshButton: Locator;
  readonly radarBadge: Locator;
  readonly kpiMessages: Locator;
  readonly kpiIntents: Locator;
  readonly kpiCheckouts: Locator;
  readonly kpiRecoveredRevenue: Locator;
  readonly funnelSection: Locator;
  readonly executiveSection: Locator;
  readonly recentCheckoutsSection: Locator;
  readonly metricsLoadingText: Locator;
  readonly metricsErrorState: Locator;

  // ─── PAYMENT LINKS PAGE ─────────────────────────────────────────────────────
  readonly paymentLinksHeading: Locator;
  readonly newChargeButton: Locator;
  readonly reportCard: Locator;
  readonly generateReportButton: Locator;
  readonly kpiChargesGenerated: Locator;
  readonly kpiChargesActive: Locator;
  readonly kpiChargesPaid: Locator;
  readonly kpiPotentialRevenue: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly sourceFilter: Locator;
  readonly clearFiltersButton: Locator;
  readonly operationHeading: Locator;
  readonly onboardingCard: Locator;
  readonly enablePaymentsButton: Locator;

  // ─── CREATE CHARGE SHEET ────────────────────────────────────────────────────
  readonly createSheetTitle: Locator;
  readonly contactSearchInput: Locator;
  readonly customerDocumentInput: Locator;
  readonly chargeNameInput: Locator;
  readonly chargeValueInput: Locator;
  readonly chargeBillingSelect: Locator;
  readonly chargeDueDateInput: Locator;
  readonly chargeDescriptionInput: Locator;

  // ─── PROMOTIONS PAGE ────────────────────────────────────────────────────────
  readonly promotionsHeading: Locator;
  readonly promotionsTab: Locator;
  readonly couponsTab: Locator;
  readonly campaignsHeading: Locator;
  readonly newPromotionButton: Locator;
  readonly promotionSearchInput: Locator;
  readonly promotionStatusFilter: Locator;
  readonly promotionEmptyState: Locator;

  // ─── PROMOTION SHEET ────────────────────────────────────────────────────────
  readonly promotionSheetTitle: Locator;
  readonly promotionNameInput: Locator;
  readonly promotionDiscountTypeSelect: Locator;
  readonly promotionDiscountValueInput: Locator;
  readonly promotionStartInput: Locator;
  readonly promotionExpirationInput: Locator;
  readonly promotionDescriptionInput: Locator;
  readonly promotionSaveButton: Locator;
  readonly promotionCancelButton: Locator;

  // ─── COUPONS TAB ────────────────────────────────────────────────────────────
  readonly couponsHeading: Locator;
  readonly newCouponButton: Locator;
  readonly couponSearchInput: Locator;
  readonly couponStatusFilter: Locator;
  readonly couponEmptyState: Locator;

  // ─── COUPON SHEET ───────────────────────────────────────────────────────────
  readonly couponSheetTitle: Locator;
  readonly couponCodeInput: Locator;
  readonly couponDiscountTypeSelect: Locator;
  readonly couponDiscountValueInput: Locator;
  readonly couponSaveButton: Locator;
  readonly couponCancelButton: Locator;

  constructor(page: Page) {
    super(page);

    // Metrics
    this.metricsHeading = page.getByRole('heading', { name: /Metricas de vendas/i });
    this.rangeButton7d = page.getByRole('button', { name: '7 dias' });
    this.rangeButton30d = page.getByRole('button', { name: '30 dias' });
    this.rangeButton90d = page.getByRole('button', { name: '90 dias' });
    this.refreshButton = page.getByRole('button', { name: /Atualizar/i });
    this.radarBadge = page.getByText('Radar comercial');
    this.kpiMessages = page.getByText('Mensagens comerciais');
    this.kpiIntents = page.getByText('Intencoes de compra');
    this.kpiCheckouts = page.getByText('Checkouts emitidos', { exact: true }).first();
    this.kpiRecoveredRevenue = page.getByText('Receita recuperada').first();
    this.funnelSection = page.getByText('Efetividade do funil');
    this.executiveSection = page.getByText('Leitura executiva');
    this.recentCheckoutsSection = page.getByText('Checkouts recentes');
    this.metricsLoadingText = page.getByText('Carregando metricas comerciais...');
    this.metricsErrorState = page.getByText(/não foi possivel carregar o painel/i);

    // Payment Links
    this.paymentLinksHeading = page.getByRole('heading', { name: /Cobranças/i }).first();
    this.newChargeButton = page.getByRole('button', { name: /Nova cobrança/i })
      .or(page.getByRole('button', { name: /Habilitar recebimentos/i }).first());
    this.reportCard = page.getByText('Relatório de Cobranças');
    this.generateReportButton = page.getByRole('button', { name: /Gerar relatorio/i });
    this.kpiChargesGenerated = page.getByText('Cobranças geradas');
    this.kpiChargesActive = page.getByText('Cobranças ativas');
    this.kpiChargesPaid = page.getByText('Cobranças pagas');
    this.kpiPotentialRevenue = page.getByText('Receita potencial');
    this.searchInput = page.getByPlaceholder('Buscar por título, descrição ou contato');
    this.statusFilter = page.locator('select, [role="combobox"]').first();
    this.sourceFilter = page.getByText('Todas as origens');
    this.clearFiltersButton = page.getByRole('button', { name: /Limpar filtros/i });
    this.operationHeading = page.getByRole('heading', { name: /Operação financeira/i });
    this.onboardingCard = page.getByText('Recebimentos ainda não habilitados');
    this.enablePaymentsButton = page.getByRole('button', { name: /Habilitar recebimentos/i }).first();

    // Create Charge Sheet
    this.createSheetTitle = page.getByText('Criar cobrança');
    this.contactSearchInput = page.getByPlaceholder('Buscar por nome, telefone ou email');
    this.customerDocumentInput = page.getByLabel(/CPF ou CNPJ do pagador/i);
    this.chargeNameInput = page.getByLabel(/Título da cobrança/i);
    this.chargeValueInput = page.getByLabel(/Valor/i).first();
    this.chargeBillingSelect = page.getByLabel(/Forma de pagamento/i);
    this.chargeDueDateInput = page.getByLabel(/Vencimento/i);
    this.chargeDescriptionInput = page.getByLabel(/Descrição/i).first();

    // Promotions Page
    this.promotionsHeading = page.getByRole('heading', { name: /Promoções & Cupons/i });
    this.promotionsTab = page.getByRole('tab', { name: /Promoções/i });
    this.couponsTab = page.getByRole('tab', { name: /Cupons/i });
    this.campaignsHeading = page.getByRole('heading', { name: /Todas as Campanhas/i });
    this.newPromotionButton = page.getByRole('button', { name: /Nova Promoção/i });
    this.promotionSearchInput = page.getByPlaceholder('Buscar campanhas...');
    this.promotionStatusFilter = page.getByText('Todos os status').first();
    this.promotionEmptyState = page.getByText('Nenhuma promoção encontrada.');

    // Promotion Sheet
    this.promotionSheetTitle = page.getByText(/Criar Promoção|Editar Promoção/);
    this.promotionNameInput = page.getByPlaceholder('Ex: Black Friday');
    this.promotionDiscountTypeSelect = page.getByLabel('Tipo de Desconto').first();
    this.promotionDiscountValueInput = page.getByRole('spinbutton').first();
    this.promotionStartInput = page.locator('div', { hasText: /^Início$/ }).getByRole('textbox');
    this.promotionExpirationInput = page.locator('div', { hasText: /^Expiração/ }).getByRole('textbox');
    this.promotionDescriptionInput = page.getByPlaceholder(/regulamento interno/i);
    this.promotionSaveButton = page.getByRole('button', { name: /^Salvar$/i });
    this.promotionCancelButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Coupons Tab
    this.couponsHeading = page.getByRole('heading', { name: /Todos os Cupons/i });
    this.newCouponButton = page.getByRole('button', { name: /Novo Cupom/i });
    this.couponSearchInput = page.getByPlaceholder('Buscar por código...');
    this.couponStatusFilter = page.getByText('Todos os status').first();
    this.couponEmptyState = page.getByText('Nenhum cupom gerado.');

    // Coupon Sheet
    this.couponSheetTitle = page.getByText(/Criar Cupom|Editar Cupom/);
    this.couponCodeInput = page.getByPlaceholder('Ex: OFERTA10');
    this.couponDiscountTypeSelect = page.getByLabel('Tipo de Desconto').first();
    this.couponDiscountValueInput = page.getByRole('spinbutton').first();
    this.couponSaveButton = page.getByRole('button', { name: /Salvar Cupom/i });
    this.couponCancelButton = page.getByRole('button', { name: /Cancelar/i }).first();
  }

  // ─── NAVIGATION ─────────────────────────────────────────────────────────────

  async gotoMetrics() {
    await this.page.goto('/app/sales/metrics');
    await this.page.waitForURL(/\/app\/sales\/metrics/);
  }

  async gotoPaymentLinks() {
    await this.page.goto('/app/sales/payment-links');
    await this.page.waitForURL(/\/app\/sales\/payment-links/);
  }

  async gotoPromotions() {
    await this.page.goto('/app/sales/promotions');
    await this.page.waitForURL(/\/app\/sales\/promotions/);
  }

  // ─── ASSERTIONS ─────────────────────────────────────────────────────────────

  async assertMetricsPageVisible() {
    await expect(this.metricsHeading).toBeVisible({ timeout: 15_000 });
  }

  async assertPaymentLinksPageVisible() {
    await expect(this.paymentLinksHeading).toBeVisible({ timeout: 15_000 });
  }

  async assertPromotionsPageVisible() {
    await expect(this.promotionsHeading).toBeVisible({ timeout: 15_000 });
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  async openCreateChargeSheet() {
    const newChargeBtn = this.page.getByRole('button', { name: /Nova cobrança/i });
    await newChargeBtn.click();
    await expect(this.createSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async openPromotionSheet() {
    await this.newPromotionButton.click();
    await expect(this.promotionSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async switchToCouponsTab() {
    await this.couponsTab.click();
    await expect(this.couponsHeading).toBeVisible({ timeout: 5_000 });
  }

  async openCouponSheet() {
    await this.newCouponButton.click();
    await expect(this.couponSheetTitle).toBeVisible({ timeout: 5_000 });
  }
}
