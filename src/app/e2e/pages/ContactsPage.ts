import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Contacts List page (/app/contacts).
 * Real heading: "Contatos"
 * Key elements: search, stage filter, table, new contact button, import button
 */
export class ContactsPage extends BasePage {
  // Header
  readonly heading: Locator;
  readonly newContactButton: Locator;
  readonly importButton: Locator;
  readonly reportsButton: Locator;

  // Filters
  readonly searchInput: Locator;
  readonly stageFilter: Locator;
  readonly resultsBadge: Locator;

  // Table
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly selectAllCheckbox: Locator;

  // Bulk actions
  readonly bulkActionsBar: Locator;
  readonly bulkDeleteButton: Locator;
  readonly bulkStageSelect: Locator;
  readonly bulkUpdateButton: Locator;
  readonly clearSelectionButton: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Create Contact Sheet
  readonly createSheetTitle: Locator;
  readonly contactNameInput: Locator;
  readonly contactPhoneInput: Locator;
  readonly contactDocumentInput: Locator;
  readonly contactEmailInput: Locator;
  readonly contactTagsInput: Locator;
  readonly contactNotesInput: Locator;
  readonly saveContactButton: Locator;
  readonly cancelButton: Locator;

  // Edit Contact Sheet
  readonly editSheetTitle: Locator;
  readonly editNameInput: Locator;
  readonly editEmailInput: Locator;
  readonly editTagsInput: Locator;
  readonly editNotesInput: Locator;
  readonly saveChangesButton: Locator;

  // KPIs
  readonly kpiTotalCRM: Locator;
  readonly kpiFunnelActive: Locator;
  readonly kpiCustomers: Locator;
  readonly kpiInactive: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.locator('h1.page-title');
    this.newContactButton = page.getByRole('button', { name: /novo contato/i });
    this.importButton = page.getByRole('button', { name: /importar lista/i });
    this.reportsButton = page.getByRole('button', { name: /relatórios/i });

    // Filters
    this.searchInput = page.getByPlaceholder('Buscar por nome, telefone, email ou tag...');
    this.stageFilter = page.locator('[role="combobox"]').filter({ hasText: /estágio|todos/i });
    this.resultsBadge = page.locator('text=/\\d+ resultado/');

    // Table
    this.table = page.locator('table');
    this.tableRows = page.locator('tbody tr');
    this.selectAllCheckbox = page.getByRole('checkbox', { name: /select all contacts/i });

    // Bulk actions
    this.bulkActionsBar = page.getByText(/selecionados/i).locator('..');
    this.bulkDeleteButton = page.getByRole('button', { name: /excluir em lote/i });
    this.bulkStageSelect = page.getByRole('combobox').filter({ hasText: /mover para/i });
    this.bulkUpdateButton = page.getByRole('button', { name: 'Atualizar' });
    this.clearSelectionButton = page.getByRole('button', { name: /limpar sele/i });

    // Empty state
    this.emptyState = page.getByText('Nenhum contato encontrado');

    // Create Contact Sheet
    this.createSheetTitle = page.getByText('Novo contato no CRM');
    this.contactNameInput = page.locator('#contact-name');
    this.contactPhoneInput = page.locator('#contact-phone');
    this.contactDocumentInput = page.locator('#contact-document');
    this.contactEmailInput = page.locator('#contact-email');
    this.contactTagsInput = page.locator('#contact-tags');
    this.contactNotesInput = page.locator('#contact-notes');
    this.saveContactButton = page.getByRole('button', { name: /salvar contato/i });
    this.cancelButton = page.getByRole('button', { name: /cancelar/i });

    // Edit Contact Sheet
    this.editSheetTitle = page.getByText('Editar contato');
    this.editNameInput = page.locator('#edit-contact-name');
    this.editEmailInput = page.locator('#edit-contact-email');
    this.editTagsInput = page.locator('#edit-contact-tags');
    this.editNotesInput = page.locator('#edit-contact-notes');
    this.saveChangesButton = page.getByRole('button', { name: /salvar alterações/i });

    // KPIs
    this.kpiTotalCRM = page.getByText('Total no CRM');
    this.kpiFunnelActive = page.getByText('Funil ativo');
    this.kpiCustomers = page.getByText('Clientes', { exact: true });
    this.kpiInactive = page.getByText('Inativos');
  }

  async goto() {
    await this.page.goto('/app/contacts');
  }

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.heading).toHaveText('Contatos');
    await expect(this.searchInput).toBeVisible();
    await expect(this.newContactButton).toBeVisible();
  }

  async assertTableVisible() {
    await expect(this.table).toBeVisible({ timeout: 10_000 });
  }

  async assertEmptyState() {
    await expect(this.emptyState).toBeVisible({ timeout: 10_000 });
  }

  async getRowCount(): Promise<number> {
    await this.table.waitFor({ state: 'visible', timeout: 10_000 });
    return this.tableRows.count();
  }

  async searchContacts(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce + API response
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  async selectStageFilter(stage: string) {
    await this.stageFilter.click();
    await this.page.getByRole('option', { name: new RegExp(stage, 'i') }).click();
  }

  async openCreateSheet() {
    await this.newContactButton.click();
    await expect(this.createSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async fillCreateForm(data: {
    name: string;
    phone: string;
    document?: string;
    email?: string;
    notes?: string;
  }) {
    await this.contactNameInput.fill(data.name);
    await this.contactPhoneInput.fill(data.phone);
    if (data.document) await this.contactDocumentInput.fill(data.document);
    if (data.email) await this.contactEmailInput.fill(data.email);
    if (data.notes) await this.contactNotesInput.fill(data.notes);
  }

  async submitCreateForm() {
    await this.saveContactButton.scrollIntoViewIfNeeded();
    await this.saveContactButton.click();
  }

  async createContact(data: {
    name: string;
    phone: string;
    document?: string;
    email?: string;
    notes?: string;
  }) {
    await this.openCreateSheet();
    await this.fillCreateForm(data);
    await this.submitCreateForm();
  }

  async openEditSheet(contactName: string) {
    // Navigate to detail page first, then click edit
    await this.clickContactRow(contactName);
    await this.page.getByRole('button', { name: /editar dados/i }).click();
    await expect(this.editSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async fillEditForm(data: {
    name?: string;
    email?: string;
    notes?: string;
  }) {
    if (data.name) {
      await this.editNameInput.clear();
      await this.editNameInput.fill(data.name);
    }
    if (data.email) {
      await this.editEmailInput.clear();
      await this.editEmailInput.fill(data.email);
    }
    if (data.notes) {
      await this.editNotesInput.clear();
      await this.editNotesInput.fill(data.notes);
    }
  }

  async submitEditForm() {
    await this.saveChangesButton.click();
  }

  async clickContactRow(contactName: string) {
    await this.page.getByRole('link', { name: contactName }).first().click();
    await this.page.waitForURL(/\/app\/contacts\//, { timeout: 10_000 });
  }

  async selectContactCheckbox(contactName: string) {
    await this.page.getByRole('checkbox', { name: new RegExp(`Select ${contactName}`, 'i') }).check();
  }

  async assertContactInTable(contactName: string) {
    await expect(this.page.getByRole('link', { name: contactName }).first()).toBeVisible({ timeout: 10_000 });
  }

  async assertContactNotInTable(contactName: string) {
    await expect(this.page.getByRole('link', { name: contactName })).not.toBeVisible({ timeout: 10_000 });
  }

  async openImportSheet() {
    await this.importButton.click();
    await expect(this.page.getByText('Importar lista de contatos')).toBeVisible({ timeout: 5_000 });
  }
}
