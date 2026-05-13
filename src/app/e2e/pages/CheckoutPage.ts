import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Checkout module page (/app/checkout).
 * Operations dashboard for managing orders, KPIs, shipping, abandonment.
 */
export class CheckoutPage extends BasePage {
  // ─── HEADER ─────────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly description: Locator;
  readonly abandonmentButton: Locator;
  readonly shippingButton: Locator;

  // ─── PERIOD FILTER ──────────────────────────────────────────────────────────
  readonly reportCardTitle: Locator;
  readonly periodToday: Locator;
  readonly period7d: Locator;
  readonly period30d: Locator;
  readonly generateReportButton: Locator;

  // ─── KPI CARDS ──────────────────────────────────────────────────────────────
  readonly kpiOpenOrders: Locator;
  readonly kpiAwaitingPayment: Locator;
  readonly kpiPendingRevenue: Locator;
  readonly kpiPaidRevenue: Locator;

  // ─── LOGISTICS CARD ─────────────────────────────────────────────────────────
  readonly logisticsTitle: Locator;
  readonly logisticsFreightModel: Locator;

  // ─── FUNNEL ─────────────────────────────────────────────────────────────────
  readonly funnelTitle: Locator;
  readonly funnelEmpty: Locator;

  // ─── ORDERS TABLE ───────────────────────────────────────────────────────────
  readonly ordersTitle: Locator;
  readonly ordersDescription: Locator;
  readonly tabAll: Locator;
  readonly tabNew: Locator;
  readonly tabPreparing: Locator;
  readonly tabReady: Locator;
  readonly tabShipping: Locator;
  readonly tabDelivered: Locator;
  readonly tabCancelled: Locator;
  readonly ordersLoading: Locator;
  readonly ordersEmptyTitle: Locator;

  // ─── ANALYTICS ──────────────────────────────────────────────────────────────
  readonly analyticsTitle: Locator;
  readonly analyticsProductsTab: Locator;
  readonly analyticsCustomersTab: Locator;
  readonly analyticsProductsEmpty: Locator;
  readonly analyticsCustomersEmpty: Locator;

  // ─── ABANDONMENT SHEET ──────────────────────────────────────────────────────
  readonly abandonmentSheetTitle: Locator;
  readonly abandonmentSaveButton: Locator;

  // ─── SHIPPING SHEET ─────────────────────────────────────────────────────────
  readonly shippingSheetTitle: Locator;
  readonly shippingModeSelect: Locator;
  readonly shippingSaveButton: Locator;
  readonly shippingCancelButton: Locator;

  // ─── REPORTS SHEET ──────────────────────────────────────────────────────────
  readonly reportsSheetTitle: Locator;
  readonly reportsCsvButton: Locator;
  readonly reportsCloseButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.getByRole('heading', { name: /Checkout e Pedidos/i });
    this.description = page.getByText(/Acompanhe os pedidos conversacionais/i);
    this.abandonmentButton = page.getByRole('button', { name: /Carrinho Abandonado/i });
    this.shippingButton = page.getByRole('button', { name: /Configurações de Entrega/i });

    // Period filter
    this.reportCardTitle = page.getByText('Relatório do checkout');
    this.periodToday = page.getByRole('button', { name: 'Hoje' });
    this.period7d = page.getByRole('button', { name: '7 dias' });
    this.period30d = page.getByRole('button', { name: '30 dias' });
    this.generateReportButton = page.getByRole('button', { name: /Gerar relatorio/i });

    // KPIs
    this.kpiOpenOrders = page.getByText('Pedidos em aberto');
    this.kpiAwaitingPayment = page.getByText('Aguardando pagamento');
    this.kpiPendingRevenue = page.getByText('Receita aguardando');
    this.kpiPaidRevenue = page.getByText('Receita paga');

    // Logistics
    this.logisticsTitle = page.getByText('Estratégia de Logística');
    this.logisticsFreightModel = page.getByText('Modelo de Frete');

    // Funnel
    this.funnelTitle = page.getByText('Funil do checkout');
    this.funnelEmpty = page.getByText(/Assim que houver pedidos circulando/i);

    // Orders
    this.ordersTitle = page.getByText('Operacao de pedidos');
    this.ordersDescription = page.getByText(/Controle preparo, separacao/i);
    this.tabAll = page.getByRole('tab', { name: /Todos/i }).or(page.getByText('Todos').first());
    this.tabNew = page.getByRole('tab', { name: /Novo/i }).or(page.getByText('Novo').first());
    this.tabPreparing = page.getByRole('tab', { name: /Em preparo/i }).or(page.getByText('Em preparo').first());
    this.tabReady = page.getByRole('tab', { name: /Pronto/i }).or(page.getByText('Pronto').first());
    this.tabShipping = page.getByRole('tab', { name: /Enviado/i }).or(page.getByText('Enviado').first());
    this.tabDelivered = page.getByRole('tab', { name: /Entregue/i }).or(page.getByText('Entregue').first());
    this.tabCancelled = page.getByRole('tab', { name: /Cancelados/i }).or(page.getByText('Cancelados').first());
    this.ordersLoading = page.getByText('Carregando pedidos da operacao...');
    this.ordersEmptyTitle = page.getByText('Nenhum pedido nesta etapa');

    // Analytics
    this.analyticsTitle = page.getByText('Inteligência Comercial');
    this.analyticsProductsTab = page.getByText('Produtos Vendidos');
    this.analyticsCustomersTab = page.getByText('Clientes');
    this.analyticsProductsEmpty = page.getByText('Nenhum produto vendido');
    this.analyticsCustomersEmpty = page.getByText('Nenhum cliente identificado');

    // Abandonment Sheet
    this.abandonmentSheetTitle = page.getByText('Configurar Carrinho Abandonado');
    this.abandonmentSaveButton = page.getByRole('button', { name: /Salvar configuração/i });

    // Shipping Sheet
    this.shippingSheetTitle = page.getByText('Regras de Entrega e Checkout');
    this.shippingModeSelect = page.locator('#shipping-mode');
    this.shippingSaveButton = page.getByRole('button', { name: /Salvar Regras/i });
    this.shippingCancelButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Reports Sheet
    this.reportsSheetTitle = page.getByText('Relatório do checkout').nth(1);
    this.reportsCsvButton = page.getByRole('button', { name: /Baixar CSV/i });
    this.reportsCloseButton = page.getByRole('button', { name: /Fechar/i });
  }

  // ─── NAVIGATION ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/app/checkout');
    await this.page.waitForURL(/\/app\/checkout/);
  }

  // ─── ASSERTIONS ─────────────────────────────────────────────────────────────

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  async openAbandonmentSheet() {
    await this.abandonmentButton.click();
    await expect(this.abandonmentSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async openShippingSheet() {
    await this.shippingButton.click();
    await expect(this.shippingSheetTitle).toBeVisible({ timeout: 5_000 });
  }
}
