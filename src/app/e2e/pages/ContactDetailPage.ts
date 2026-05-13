import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Contact Detail page (/app/contacts/:id).
 * Shows contact summary, timeline, and pipeline/funnel board.
 */
export class ContactDetailPage extends BasePage {
  // Navigation
  readonly backLink: Locator;

  // Summary card
  readonly contactName: Locator;
  readonly contactPhone: Locator;
  readonly contactEmail: Locator;
  readonly contactStage: Locator;
  readonly tagsSection: Locator;
  readonly notesSection: Locator;

  // Actions
  readonly openConversationButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  // Delete confirmation dialog
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  // Tabs
  readonly timelineTab: Locator;
  readonly pipelineTab: Locator;

  // Timeline
  readonly timelineEmpty: Locator;

  // Not found state
  readonly notFoundState: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation
    this.backLink = page.getByRole('link', { name: /voltar para contatos/i });

    // Summary card
    this.contactName = page.locator('h1').first();
    this.contactPhone = page.locator('[class*="Phone"]').locator('..');
    this.contactEmail = page.locator('[class*="Mail"]').locator('..');
    this.contactStage = page.locator('[class*="badge"], [class*="Badge"]').first();
    this.tagsSection = page.getByText('Tags').locator('..');
    this.notesSection = page.getByText('Notas').locator('..');

    // Actions
    this.openConversationButton = page.getByRole('button', { name: /abrir conversa/i });
    this.editButton = page.getByRole('button', { name: /editar dados/i });
    this.deleteButton = page.getByRole('button', { name: /remover contato/i });

    // Delete confirmation
    this.confirmDeleteButton = page.getByRole('button', { name: /remover contato/i }).last();
    this.cancelDeleteButton = page.getByRole('button', { name: /voltar/i });

    // Tabs
    this.timelineTab = page.getByRole('tab', { name: /timeline/i });
    this.pipelineTab = page.getByRole('tab', { name: /funil/i });

    // Timeline
    this.timelineEmpty = page.getByText('Sem histórico ainda');

    // Not found
    this.notFoundState = page.getByText('Contato não encontrado');
  }

  async goto(contactId: string) {
    await this.page.goto(`/app/contacts/${contactId}`);
  }

  async assertPageVisible() {
    await expect(this.contactName).toBeVisible({ timeout: 15_000 });
    await expect(this.editButton).toBeVisible();
  }

  async assertNotFound() {
    await expect(this.notFoundState).toBeVisible({ timeout: 10_000 });
  }

  async goBackToList() {
    await this.backLink.click();
    await this.page.waitForURL(/\/app\/contacts$/, { timeout: 10_000 });
  }

  async deleteContact() {
    await this.deleteButton.click();
    // Wait for confirmation dialog
    await expect(this.page.getByText('Remover contato do CRM?')).toBeVisible({ timeout: 5_000 });
    await this.confirmDeleteButton.click();
  }

  async switchToTimeline() {
    await this.timelineTab.click();
  }

  async switchToPipeline() {
    await this.pipelineTab.click();
  }

  async assertContactName(name: string) {
    await expect(this.contactName).toHaveText(name);
  }
}
