import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Conversations/Messaging page (/app/conversations).
 * Real heading: "Conversas"
 * Layout: 3-column (list | chat | sidebar)
 */
export class MessagingPage extends BasePage {
  // ─── Page Header ──────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly searchInput: Locator;

  // ─── Queue Filter Buttons ─────────────────────────────────────────────────────
  readonly filterTodas: Locator;
  readonly filterNovas: Locator;
  readonly filterMinhas: Locator;
  readonly filterAguardando: Locator;

  // ─── Status Filter (Select) ───────────────────────────────────────────────────
  readonly statusFilterTrigger: Locator;

  // ─── KPI Cards ────────────────────────────────────────────────────────────────
  readonly kpiNovasMensagens: Locator;
  readonly kpiMeusAtendimentos: Locator;
  readonly kpiAguardandoRetorno: Locator;

  // ─── Conversation List ────────────────────────────────────────────────────────
  readonly conversationListHeading: Locator;
  readonly conversationItems: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  // ─── Chat Panel (center) ──────────────────────────────────────────────────────
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly attachButton: Locator;
  readonly aiSuggestButton: Locator;
  readonly refreshButton: Locator;
  readonly noConversationSelected: Locator;
  readonly loadingMessages: Locator;

  // ─── AI Autopilot ─────────────────────────────────────────────────────────────
  readonly aiAutopilotSwitch: Locator;
  readonly aiAutopilotDescription: Locator;

  // ─── Sidebar Actions ──────────────────────────────────────────────────────────
  readonly sidebarHeading: Locator;
  readonly encerrarButton: Locator;
  readonly verContatoButton: Locator;
  readonly funilButton: Locator;
  readonly cobrarButton: Locator;
  readonly chatPorIAButton: Locator;
  readonly atendenteButton: Locator;
  readonly saleAttributionButton: Locator;

  // ─── Sale Attribution Dialog ──────────────────────────────────────────────────
  readonly saleAmountInput: Locator;
  readonly saleNotesInput: Locator;
  readonly saleCancelButton: Locator;
  readonly saleSubmitButton: Locator;

  constructor(page: Page) {
    super(page);

    // Page Header
    this.heading = page.locator('h1.page-title');
    this.searchInput = page.getByPlaceholder('Buscar conversa, telefone ou mensagem');

    // Queue Filters
    this.filterTodas = page.getByRole('button', { name: 'Todas' });
    this.filterNovas = page.getByRole('button', { name: 'Novas' });
    this.filterMinhas = page.getByRole('button', { name: 'Minhas' });
    this.filterAguardando = page.getByRole('button', { name: 'Aguardando cliente' });

    // Status Filter
    this.statusFilterTrigger = page.locator('button').filter({ hasText: /Todos os status|Status/ });

    // KPI Cards
    this.kpiNovasMensagens = page.getByText('Novas Mensagens');
    this.kpiMeusAtendimentos = page.getByText('Meus Atendimentos');
    this.kpiAguardandoRetorno = page.getByText('Aguardando Retorno');

    // Conversation List
    this.conversationListHeading = page.getByRole('heading', { name: 'Fila de conversas' });
    this.conversationItems = page.locator('section button').filter({ has: page.locator('p.truncate') });
    this.emptyState = page.getByText('Nenhuma conversa encontrada');
    this.loadingState = page.getByText('Carregando conversas...');

    // Chat Panel
    this.messageInput = page.getByPlaceholder('Digite sua mensagem para o cliente...');
    this.sendButton = page.getByRole('button', { name: 'Enviar' });
    this.attachButton = page.locator('button[title="Anexar imagem, audio ou documento"]');
    this.aiSuggestButton = page.locator('button[title="Gerar resposta com IA"]');
    this.refreshButton = page.getByRole('button', { name: 'Atualizar' });
    this.noConversationSelected = page.getByText('Selecione uma conversa');
    this.loadingMessages = page.getByText('Carregando histórico...');

    // AI Autopilot
    this.aiAutopilotSwitch = page.getByRole('switch');
    this.aiAutopilotDescription = page.getByText(
      'Ative para a IA gerar e enviar a resposta automaticamente',
      { exact: false },
    );

    // Sidebar
    this.sidebarHeading = page.getByText('Contexto e ações');
    this.encerrarButton = page.getByRole('button', { name: 'Encerrar' });
    this.verContatoButton = page.getByRole('button', { name: 'Ver contato' });
    this.funilButton = page.getByRole('button', { name: 'Funil' });
    this.cobrarButton = page.getByRole('button', { name: 'Cobrar' });
    this.chatPorIAButton = page.getByRole('button', { name: 'Chat por IA' });
    this.atendenteButton = page.getByRole('button', { name: 'Atendente' });
    this.saleAttributionButton = page.getByRole('button', { name: /Marcar como venda|Confirmar venda/ });

    // Sale Attribution Dialog
    this.saleAmountInput = page.getByLabel('Valor (opcional)');
    this.saleNotesInput = page.getByLabel('Notas ou referência (opcional)');
    this.saleCancelButton = page.getByRole('button', { name: 'Cancelar' });
    this.saleSubmitButton = page.getByRole('button', { name: /Pedir validacao IA|Confirmar venda/ });
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/app/conversations');
  }

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.heading).toHaveText('Conversas');
  }

  // ─── Conversation List ──────────────────────────────────────────────────────

  async waitForListLoaded() {
    // Wait for either conversations to appear or empty state
    const listOrEmpty = this.conversationItems.first()
      .or(this.emptyState);
    await listOrEmpty.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }

  async getConversationCount(): Promise<number> {
    return this.conversationItems.count();
  }

  async selectConversation(contactName: string) {
    const item = this.page.locator('section button').filter({ hasText: contactName });
    await item.first().click();
  }

  async selectFirstConversation() {
    await this.conversationItems.first().click();
  }

  async assertConversationInList(contactName: string) {
    const item = this.page.locator('section button').filter({ hasText: contactName });
    await expect(item.first()).toBeVisible({ timeout: 10_000 });
  }

  // ─── Search & Filters ───────────────────────────────────────────────────────

  async searchConversations(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // debounce
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  async selectQueueFilter(filter: 'Todas' | 'Novas' | 'Minhas' | 'Aguardando cliente') {
    const btn = this.page.getByRole('button', { name: filter });
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  async selectStatusFilter(status: string) {
    await this.statusFilterTrigger.first().click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  // ─── Chat Panel ─────────────────────────────────────────────────────────────

  async assertChatPanelVisible() {
    await expect(this.messageInput).toBeVisible({ timeout: 10_000 });
  }

  async typeMessage(text: string) {
    await this.messageInput.fill(text);
  }

  async sendMessage(text: string) {
    await this.typeMessage(text);
    await this.sendButton.click();
  }

  async assertMessageInChat(text: string) {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
  }

  // ─── Sidebar Actions ────────────────────────────────────────────────────────

  async archiveConversation() {
    await this.encerrarButton.click();
  }

  async openSaleDialog() {
    await this.saleAttributionButton.click();
  }

  async fillSaleAmount(value: string) {
    await this.saleAmountInput.fill(value);
  }

  async fillSaleNotes(notes: string) {
    await this.saleNotesInput.fill(notes);
  }

  async submitSale() {
    await this.saleSubmitButton.click();
  }

  async cancelSale() {
    await this.saleCancelButton.click();
  }
}
