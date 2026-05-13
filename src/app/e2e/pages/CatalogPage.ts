import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Catalog module page (/app/catalog).
 * Single page with tabs: Itens / Categorias / Prontidão.
 */
export class CatalogPage extends BasePage {
  // ─── HEADER ─────────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly description: Locator;
  readonly importButton: Locator;
  readonly newCategoryButton: Locator;
  readonly newItemButton: Locator;

  // ─── FILTER BAR ─────────────────────────────────────────────────────────────
  readonly reportTitle: Locator;
  readonly typeAll: Locator;
  readonly typeProducts: Locator;
  readonly typeServices: Locator;
  readonly typeRentals: Locator;
  readonly reportsButton: Locator;

  // ─── KPI CARDS ──────────────────────────────────────────────────────────────
  readonly kpiActiveItems: Locator;
  readonly kpiCategories: Locator;
  readonly kpiServices: Locator;
  readonly kpiProducts: Locator;

  // ─── TABS ───────────────────────────────────────────────────────────────────
  readonly itemsTab: Locator;
  readonly categoriesTab: Locator;
  readonly readinessTab: Locator;

  // ─── ITEMS TAB ──────────────────────────────────────────────────────────────
  readonly itemSearchInput: Locator;
  readonly itemTypeFilter: Locator;
  readonly showInactiveToggle: Locator;
  readonly itemsTable: Locator;
  readonly itemsLoading: Locator;
  readonly itemsEmptyTitle: Locator;
  readonly itemsEmptyAction: Locator;

  // ─── CATEGORIES TAB ─────────────────────────────────────────────────────────
  readonly categoriesLoading: Locator;
  readonly categoriesEmptyTitle: Locator;
  readonly categoriesEmptyAction: Locator;

  // ─── READINESS TAB ──────────────────────────────────────────────────────────
  readonly readinessAgenda: Locator;
  readonly readinessEstoque: Locator;
  readonly readinessIA: Locator;

  // ─── ITEM SHEET (Create/Edit) ───────────────────────────────────────────────
  readonly itemSheetTitle: Locator;
  readonly itemNameInput: Locator;
  readonly itemTypeSelect: Locator;
  readonly itemPriceInput: Locator;
  readonly itemRefInput: Locator;
  readonly itemTagsInput: Locator;
  readonly itemDescriptionInput: Locator;
  readonly createItemButton: Locator;
  readonly cancelItemButton: Locator;

  // ─── CATEGORY SHEET (Create/Edit) ──────────────────────────────────────────
  readonly categorySheetTitle: Locator;
  readonly categoryNameInput: Locator;
  readonly categoryDescriptionInput: Locator;
  readonly saveCategoryButton: Locator;
  readonly cancelCategoryButton: Locator;

  // ─── IMPORT SHEET ───────────────────────────────────────────────────────────
  readonly importSheetTitle: Locator;
  readonly importTextarea: Locator;
  readonly importSubmitButton: Locator;
  readonly downloadTemplateButton: Locator;

  // ─── REPORTS SHEET ──────────────────────────────────────────────────────────
  readonly reportsSheetTitle: Locator;
  readonly reportsCsvButton: Locator;
  readonly reportsCloseButton: Locator;

  // ─── DELETE DIALOGS ─────────────────────────────────────────────────────────
  readonly deleteCategoryDialog: Locator;
  readonly deleteItemDialog: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.getByRole('heading', { name: /Catálogo/i });
    this.description = page.getByText(/Cadastre produtos, serviços e locações/i);
    this.importButton = page.getByRole('button', { name: /Importar lista/i });
    this.newCategoryButton = page.getByRole('button', { name: /Nova categoria/i });
    this.newItemButton = page.getByRole('button', { name: /Novo item/i });

    // Filter bar
    this.reportTitle = page.getByText('Relatório do catalogo');
    this.typeAll = page.getByRole('button', { name: 'Todos' });
    this.typeProducts = page.getByRole('button', { name: 'Produtos' });
    this.typeServices = page.getByRole('button', { name: 'Serviços' });
    this.typeRentals = page.getByRole('button', { name: 'Locações' });
    this.reportsButton = page.getByRole('button', { name: /Relatórios/i });

    // KPIs
    this.kpiActiveItems = page.getByText('Itens ativos');
    this.kpiCategories = page.getByText('Categorias').first();
    this.kpiServices = page.getByText('serviços');
    this.kpiProducts = page.getByText('Produtos').first();

    // Tabs
    this.itemsTab = page.getByRole('tab', { name: /Itens/i })
      .or(page.getByText('Itens').first());
    this.categoriesTab = page.getByRole('tab', { name: /Categorias/i })
      .or(page.getByText('Categorias').first());
    this.readinessTab = page.getByRole('tab', { name: /Prontidão/i })
      .or(page.getByText('Prontidão').first());

    // Items tab
    this.itemSearchInput = page.getByPlaceholder('Buscar por nome, categoria ou referência...');
    this.itemTypeFilter = page.getByText('Todos os tipos');
    this.showInactiveToggle = page.getByRole('button', { name: /Mostrar inativos|Mostrando inativos/i });
    this.itemsTable = page.locator('table');
    this.itemsLoading = page.getByText('Carregando itens do catálogo...');
    this.itemsEmptyTitle = page.getByText('Nenhum item encontrado');
    this.itemsEmptyAction = page.getByRole('button', { name: /Novo item/i });

    // Categories tab
    this.categoriesLoading = page.getByText('Carregando categorias...');
    this.categoriesEmptyTitle = page.getByText('Nenhuma categoria cadastrada');
    this.categoriesEmptyAction = page.getByRole('button', { name: /Nova categoria/i });

    // Readiness tab
    this.readinessAgenda = page.getByText('Agenda');
    this.readinessEstoque = page.getByText('Estoque');
    this.readinessIA = page.getByText('IA comercial');

    // Item Sheet
    this.itemSheetTitle = page.getByText(/Novo item|Editar item/);
    this.itemNameInput = page.getByPlaceholder('Ex: Camiseta dry fit');
    this.itemPriceInput = page.getByLabel(/Preço base/i);
    this.itemRefInput = page.getByPlaceholder('SKU ou codigo interno');
    this.itemTagsInput = page.getByPlaceholder(/premium, verao/i);
    this.itemDescriptionInput = page.getByPlaceholder(/Contexto que a IA/i);
    this.itemTypeSelect = page.getByLabel(/Tipo/i).first();
    this.createItemButton = page.getByRole('button', { name: /Criar item/i });
    this.cancelItemButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Category Sheet
    this.categorySheetTitle = page.getByText(/Nova categoria|Editar categoria/);
    this.categoryNameInput = page.getByPlaceholder('Ex: Procedimentos premium');
    this.categoryDescriptionInput = page.getByPlaceholder(/Explique quando essa categoria/i);
    this.saveCategoryButton = page.getByRole('button', { name: /Salvar categoria|Salvar ajustes/i });
    this.cancelCategoryButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Import Sheet
    this.importSheetTitle = page.getByText('Importar itens do catalogo');
    this.importTextarea = page.getByPlaceholder(/produto,nome,preço/i);
    this.importSubmitButton = page.getByRole('button', { name: /Importar itens/i });
    this.downloadTemplateButton = page.getByRole('button', { name: /Baixar modelo/i });

    // Reports Sheet
    this.reportsSheetTitle = page.getByText('Exportar catálogo');
    this.reportsCsvButton = page.getByRole('button', { name: /Baixar CSV/i });
    this.reportsCloseButton = page.getByRole('button', { name: /Fechar/i });

    // Delete dialogs
    this.deleteCategoryDialog = page.getByText('Remover categoria?');
    this.deleteItemDialog = page.getByText('Remover item?');
  }

  // ─── NAVIGATION ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/app/catalog');
    await this.page.waitForURL(/\/app\/catalog/);
  }

  // ─── ASSERTIONS ─────────────────────────────────────────────────────────────

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  async switchToCategoriesTab() {
    await this.categoriesTab.click();
  }

  async switchToReadinessTab() {
    await this.readinessTab.click();
  }

  async openNewItemSheet() {
    await this.newItemButton.click();
    await expect(this.itemSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async openNewCategorySheet() {
    await this.newCategoryButton.click();
    await expect(this.categorySheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async openImportSheet() {
    await this.importButton.click();
    await expect(this.importSheetTitle).toBeVisible({ timeout: 5_000 });
  }

  async openReportsSheet() {
    await this.reportsButton.click();
    await expect(this.reportsSheetTitle).toBeVisible({ timeout: 5_000 });
  }
}
