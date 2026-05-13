import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Scheduling module page (/app/scheduling).
 * Single page with internal tabs: professionals / categories.
 */
export class SchedulingPage extends BasePage {
  // ─── HEADER ─────────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly description: Locator;

  // ─── REPORT CARD ────────────────────────────────────────────────────────────
  readonly reportCardTitle: Locator;
  readonly periodToday: Locator;
  readonly period7d: Locator;
  readonly period30d: Locator;
  readonly reportsButton: Locator;

  // ─── OVERVIEW CARDS (KPIs) ──────────────────────────────────────────────────
  readonly kpiProfessionals: Locator;
  readonly kpiCategories: Locator;
  readonly kpiDaySlots: Locator;
  readonly kpiReservations: Locator;

  // ─── GOOGLE CALENDAR ────────────────────────────────────────────────────────
  readonly googleCalendarBadge: Locator;
  readonly googleCalendarConnected: Locator;
  readonly googleCalendarDisconnected: Locator;
  readonly connectGoogleButton: Locator;
  readonly disconnectGoogleButton: Locator;

  // ─── TABS ───────────────────────────────────────────────────────────────────
  readonly professionalsTab: Locator;
  readonly categoriesTab: Locator;

  // ─── PROFESSIONALS TAB ──────────────────────────────────────────────────────
  readonly professionalsCardTitle: Locator;
  readonly addProfessionalButton: Locator;
  readonly scheduleDayTab: Locator;
  readonly scheduleRecurringTab: Locator;
  readonly calendarDayButton: Locator;
  readonly calendarWeekButton: Locator;
  readonly calendarMonthButton: Locator;
  readonly dayAvailabilityTitle: Locator;
  readonly addSlotButton: Locator;
  readonly bulkSlotsButton: Locator;
  readonly saveDaySlotsButton: Locator;
  readonly noProfessionalsEmpty: Locator;
  readonly selectProfessionalEmpty: Locator;
  readonly noSlotsEmpty: Locator;

  // ─── CATEGORIES TAB ─────────────────────────────────────────────────────────
  readonly categoriesCardTitle: Locator;
  readonly addCategoryButton: Locator;
  readonly noCategoriesEmpty: Locator;

  // ─── CREATE PROFESSIONAL SHEET ──────────────────────────────────────────────
  readonly createProfessionalTitle: Locator;
  readonly professionalNameInput: Locator;
  readonly professionalPhoneInput: Locator;
  readonly createProfessionalButton: Locator;
  readonly cancelProfessionalButton: Locator;

  // ─── CREATE CATEGORY SHEET ──────────────────────────────────────────────────
  readonly createCategoryTitle: Locator;
  readonly categoryNameInput: Locator;
  readonly categoryUnitSelect: Locator;
  readonly categoryDurationInput: Locator;
  readonly categoryPriceInput: Locator;
  readonly createCategoryButton: Locator;
  readonly cancelCategoryButton: Locator;

  // ─── BULK SLOT GENERATOR SHEET ──────────────────────────────────────────────
  readonly bulkSheetTitle: Locator;
  readonly bulkStartDateInput: Locator;
  readonly bulkEndDateInput: Locator;
  readonly bulkDayStartInput: Locator;
  readonly bulkDayEndInput: Locator;
  readonly bulkSlotDurationInput: Locator;
  readonly generateSlotsButton: Locator;

  // ─── REPORTS SHEET ──────────────────────────────────────────────────────────
  readonly reportsSheetTitle: Locator;
  readonly reportsCsvButton: Locator;
  readonly reportsCloseButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.getByRole('heading', { name: /Agenda operacional/i });
    this.description = page.getByText(/Organize profissionais, serviços/i);

    // Report card
    this.reportCardTitle = page.getByText('Relatório da agenda');
    this.periodToday = page.getByRole('button', { name: 'Hoje' });
    this.period7d = page.getByRole('button', { name: '7 dias' });
    this.period30d = page.getByRole('button', { name: '30 dias' });
    this.reportsButton = page.getByRole('button', { name: /Relatórios/i });

    // KPIs
    this.kpiProfessionals = page.getByText('Profissionais').first();
    this.kpiCategories = page.getByText('Categorias').first();
    this.kpiDaySlots = page.getByText('Slots do dia');
    this.kpiReservations = page.getByText('Reservas');

    // Google Calendar
    this.googleCalendarBadge = page.getByText('Google Calendar');
    this.googleCalendarConnected = page.getByText('Calendario conectado');
    this.googleCalendarDisconnected = page.getByText(/Conecte sua agenda ao Google Calendar/i);
    this.connectGoogleButton = page.getByRole('button', { name: /Conectar Google Calendar/i });
    this.disconnectGoogleButton = page.getByRole('button', { name: /Desconectar/i });

    // Tabs
    this.professionalsTab = page.getByRole('tab', { name: /Profissionais/i })
      .or(page.getByText('Profissionais').first());
    this.categoriesTab = page.getByRole('tab', { name: /Categorias/i })
      .or(page.getByText('Categorias').first());

    // Professionals tab
    this.professionalsCardTitle = page.getByText('Profissionais').first();
    this.addProfessionalButton = page.locator('button:has(svg.lucide-plus)').first();
    this.scheduleDayTab = page.getByText('Agenda do dia');
    this.scheduleRecurringTab = page.getByText('Recorrentes');
    this.calendarDayButton = page.getByRole('button', { name: 'Dia' });
    this.calendarWeekButton = page.getByRole('button', { name: 'Semana' });
    this.calendarMonthButton = page.getByRole('button', { name: 'Mes' });
    this.dayAvailabilityTitle = page.getByText('Disponibilidade do dia');
    this.addSlotButton = page.getByRole('button', { name: /Adicionar horário/i });
    this.bulkSlotsButton = page.getByRole('button', { name: /Gerar lote de horários/i });
    this.saveDaySlotsButton = page.getByRole('button', { name: /Salvar horários do dia/i });
    this.noProfessionalsEmpty = page.getByText('Nenhum profissional');
    this.selectProfessionalEmpty = page.getByText('Selecione um profissional');
    this.noSlotsEmpty = page.getByText('Sem slots abertos neste dia');

    // Categories tab
    this.categoriesCardTitle = page.getByText('Categorias').first();
    this.addCategoryButton = page.locator('button:has(svg.lucide-plus)').first();
    this.noCategoriesEmpty = page.getByText('Nenhuma categoria');

    // Create Professional Sheet
    this.createProfessionalTitle = page.getByText('Novo profissional');
    this.professionalNameInput = page.locator('#professional-name');
    this.professionalPhoneInput = page.locator('#professional-phone');
    this.createProfessionalButton = page.getByRole('button', { name: /Criar profissional/i });
    this.cancelProfessionalButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Create Category Sheet
    this.createCategoryTitle = page.getByText('Nova categoria');
    this.categoryNameInput = page.locator('#category-name');
    this.categoryUnitSelect = page.locator('#category-unit');
    this.categoryDurationInput = page.locator('#category-duration');
    this.categoryPriceInput = page.locator('#category-base-price');
    this.createCategoryButton = page.getByRole('button', { name: /Criar categoria/i });
    this.cancelCategoryButton = page.getByRole('button', { name: /Cancelar/i }).first();

    // Bulk Slot Generator Sheet
    this.bulkSheetTitle = page.getByText('Gerar horários em lote');
    this.bulkStartDateInput = page.locator('#bulk-start-date');
    this.bulkEndDateInput = page.locator('#bulk-end-date');
    this.bulkDayStartInput = page.locator('#bulk-day-start');
    this.bulkDayEndInput = page.locator('#bulk-day-end');
    this.bulkSlotDurationInput = page.locator('#bulk-slot-duration');
    this.generateSlotsButton = page.getByRole('button', { name: /Gerar slots/i });

    // Reports Sheet
    this.reportsSheetTitle = page.getByText('Relatórios da agenda');
    this.reportsCsvButton = page.getByRole('button', { name: /Baixar CSV/i });
    this.reportsCloseButton = page.getByRole('button', { name: /Fechar/i });
  }

  // ─── NAVIGATION ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/app/scheduling');
    await this.page.waitForURL(/\/app\/scheduling/);
  }

  // ─── ASSERTIONS ─────────────────────────────────────────────────────────────

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  async switchToCategoriesTab() {
    await this.categoriesTab.click();
  }

  async openCreateProfessionalSheet() {
    await this.addProfessionalButton.click();
    await expect(this.createProfessionalTitle).toBeVisible({ timeout: 5_000 });
  }

  async openReportsSheet() {
    await this.reportsButton.click();
    await expect(this.reportsSheetTitle).toBeVisible({ timeout: 5_000 });
  }
}
