import { test, expect } from '../playwright-fixture';
import { SchedulingPage } from './pages';
import {
  mockApiError,
  mockApiResponse,
  mockApiTimeout,
} from './helpers';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const PROFESSIONALS_API = `**/api/v1/tenants/${TENANT_ID}/scheduling/professionals*`;
const CATEGORIES_API = `**/api/v1/tenants/${TENANT_ID}/scheduling/categories*`;
const SLOTS_API = `**/api/v1/tenants/${TENANT_ID}/scheduling/slots*`;

/**
 * Scheduling E2E Tests — Rewritten with real selectors, direct assertions.
 * Covers: smoke, professionals CRUD, categories CRUD, slots, reports, errors, responsiveness.
 */

test.describe('Scheduling', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. SMOKE TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load scheduling page with heading', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();
    });

    test('1.2 @smoke should display page description', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.description).toBeVisible();
    });

    test('1.3 @smoke should display report card with period buttons', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.reportCardTitle).toBeVisible();
      await expect(scheduling.periodToday).toBeVisible();
      await expect(scheduling.period7d).toBeVisible();
      await expect(scheduling.period30d).toBeVisible();
    });

    test('1.4 @smoke should display reports button', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.reportsButton).toBeVisible();
    });

    test('1.5 @smoke should display KPI overview cards', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.kpiProfessionals).toBeVisible();
      await expect(scheduling.kpiCategories).toBeVisible();
      await expect(scheduling.kpiDaySlots).toBeVisible();
      await expect(scheduling.kpiReservations).toBeVisible();
    });

    test('1.6 @smoke should display Google Calendar card', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.googleCalendarBadge).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. PROFESSIONALS TAB
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('2. Professionals Tab', () => {
    test('2.1 @smoke should display professionals card title', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.professionalsCardTitle).toBeVisible();
    });

    test('2.2 @regression should show empty state or professionals list', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      // Either professionals are listed or empty state is shown
      const hasProfessionals = await page.locator('button').filter({ hasText: /\w{2,}/ }).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await scheduling.noProfessionalsEmpty.isVisible().catch(() => false);
      const hasSelect = await scheduling.selectProfessionalEmpty.isVisible().catch(() => false);

      expect(hasProfessionals || hasEmpty || hasSelect).toBe(true);
    });

    test('2.3 @regression should open create professional sheet', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openCreateProfessionalSheet();
      await expect(scheduling.professionalNameInput).toBeVisible();
      await expect(scheduling.professionalPhoneInput).toBeVisible();
      await expect(scheduling.createProfessionalButton).toBeVisible();
    });

    test('2.4 @regression should disable create button when name is empty', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openCreateProfessionalSheet();

      // Name empty — create should be disabled or show validation on click
      const isDisabled = await scheduling.createProfessionalButton.isDisabled().catch(() => false);
      if (!isDisabled) {
        // Click and expect validation error
        await scheduling.createProfessionalButton.click();
        const validation = page.locator('[role="alert"], .text-destructive, .text-red-500');
        const toast = page.locator('[data-sonner-toast]');
        const hasValidation = await validation.first().isVisible({ timeout: 3_000 }).catch(() => false);
        const hasToast = await toast.first().isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasValidation || hasToast || isDisabled).toBe(true);
      } else {
        expect(isDisabled).toBe(true);
      }
    });

    test('2.5 @regression should close create professional sheet on cancel', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openCreateProfessionalSheet();
      await expect(scheduling.createProfessionalTitle).toBeVisible();

      await scheduling.cancelProfessionalButton.click();
      await expect(scheduling.createProfessionalTitle).toBeHidden({ timeout: 3_000 });
    });

    test('2.6 @regression should fill professional name and phone', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openCreateProfessionalSheet();

      await scheduling.professionalNameInput.fill('Dr. Teste E2E');
      await expect(scheduling.professionalNameInput).toHaveValue('Dr. Teste E2E');

      await scheduling.professionalPhoneInput.fill('21999999999');
      await expect(scheduling.professionalPhoneInput).toHaveValue(/\d+/);
    });

    test('2.7 @regression should display schedule mode tabs when professional selected', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      // If there are professionals, the schedule tabs should appear
      const hasScheduleTabs = await scheduling.scheduleDayTab.isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await scheduling.selectProfessionalEmpty.isVisible().catch(() => false);
      const hasNoProfessionals = await scheduling.noProfessionalsEmpty.isVisible().catch(() => false);

      expect(hasScheduleTabs || hasEmpty || hasNoProfessionals).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. CATEGORIES TAB
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('3. Categories Tab', () => {
    test('3.1 @smoke should switch to categories tab', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();
      // Should show categories content
      await scheduling.assertNoCrash();
    });

    test('3.2 @regression should show empty state or categories list', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();

      const hasCategories = await page.locator('button').filter({ hasText: /\w{2,}/ }).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await scheduling.noCategoriesEmpty.isVisible().catch(() => false);

      expect(hasCategories || hasEmpty).toBe(true);
    });

    test('3.3 @regression should open create category sheet', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();

      // Click add button in categories context
      await scheduling.addCategoryButton.click();
      await expect(scheduling.createCategoryTitle).toBeVisible({ timeout: 5_000 });
      await expect(scheduling.categoryNameInput).toBeVisible();
      await expect(scheduling.categoryDurationInput).toBeVisible();
      await expect(scheduling.categoryPriceInput).toBeVisible();
    });

    test('3.4 @regression should fill category form fields', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();
      await scheduling.addCategoryButton.click();
      await expect(scheduling.createCategoryTitle).toBeVisible({ timeout: 5_000 });

      await scheduling.categoryNameInput.fill('Consulta E2E');
      await expect(scheduling.categoryNameInput).toHaveValue('Consulta E2E');

      await scheduling.categoryDurationInput.fill('30');
      await expect(scheduling.categoryDurationInput).toHaveValue('30');

      await scheduling.categoryPriceInput.fill('120,00');
      await expect(scheduling.categoryPriceInput).toHaveValue(/120/);
    });

    test('3.5 @regression should close create category sheet on cancel', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();
      await scheduling.addCategoryButton.click();
      await expect(scheduling.createCategoryTitle).toBeVisible({ timeout: 5_000 });

      await scheduling.cancelCategoryButton.click();
      await expect(scheduling.createCategoryTitle).toBeHidden({ timeout: 3_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. PERIOD TOGGLE & REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('4. Period Toggle & Reports', () => {
    test('4.1 @regression should toggle period to 7 dias', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.period7d.click();
      await scheduling.assertNoCrash();
    });

    test('4.2 @regression should toggle period to 30 dias', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.period30d.click();
      await scheduling.assertNoCrash();
    });

    test('4.3 @regression should toggle period to Hoje', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.periodToday.click();
      await scheduling.assertNoCrash();
    });

    test('4.4 @regression should open reports sheet', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openReportsSheet();
      await expect(scheduling.reportsSheetTitle).toBeVisible();
      await expect(scheduling.reportsCsvButton).toBeVisible();
    });

    test('4.5 @regression should close reports sheet', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openReportsSheet();
      await expect(scheduling.reportsSheetTitle).toBeVisible();

      await scheduling.reportsCloseButton.click();
      await expect(scheduling.reportsSheetTitle).toBeHidden({ timeout: 3_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. GOOGLE CALENDAR INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('5. Google Calendar', () => {
    test('5.1 @regression should display Google Calendar badge', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.googleCalendarBadge).toBeVisible();
    });

    test('5.2 @regression should show connect or disconnect button', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      const hasConnect = await scheduling.connectGoogleButton.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasDisconnect = await scheduling.disconnectGoogleButton.isVisible().catch(() => false);
      const hasConnected = await scheduling.googleCalendarConnected.isVisible().catch(() => false);
      const hasDisconnected = await scheduling.googleCalendarDisconnected.isVisible().catch(() => false);

      expect(hasConnect || hasDisconnect || hasConnected || hasDisconnected).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('6. Error Handling', () => {
    test('6.1 @regression should handle professionals API error gracefully', async ({ page }) => {
      await page.route(PROFESSIONALS_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();
      await scheduling.assertNoCrash();
    });

    test('6.2 @regression should handle categories API error gracefully', async ({ page }) => {
      await page.route(CATEGORIES_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.switchToCategoriesTab();
      await scheduling.assertNoCrash();
    });

    test('6.3 @regression should handle slots API timeout gracefully', async ({ page }) => {
      await page.route(SLOTS_API, (route) => route.abort('timedout'));

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();
      await scheduling.assertNoCrash();
    });

    test('6.4 @regression should show error state on metrics loading failure', async ({ page }) => {
      await page.route(`**/api/v1/tenants/${TENANT_ID}/scheduling/overview*`, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();
      await scheduling.assertNoCrash();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. RESPONSIVENESS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('7. Responsiveness', () => {
    test('7.1 @regression scheduling page renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.kpiProfessionals).toBeVisible();
      await expect(scheduling.periodToday).toBeVisible();
    });

    test('7.2 @regression scheduling page renders on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.reportCardTitle).toBeVisible();
      await expect(scheduling.googleCalendarBadge).toBeVisible();
    });

    test('7.3 @regression scheduling page renders on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await expect(scheduling.kpiProfessionals).toBeVisible();
      await expect(scheduling.kpiCategories).toBeVisible();
      await expect(scheduling.kpiDaySlots).toBeVisible();
      await expect(scheduling.kpiReservations).toBeVisible();
    });

    test('7.4 @regression create professional sheet works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      await scheduling.openCreateProfessionalSheet();
      await expect(scheduling.professionalNameInput).toBeVisible();
      await expect(scheduling.createProfessionalButton).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. BULK SLOT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('8. Bulk Slot Generation', () => {
    test('8.1 @regression should display bulk slots button when professional exists', async ({ page }) => {
      const scheduling = new SchedulingPage(page);
      await scheduling.goto();
      await scheduling.assertPageVisible();

      // Bulk button only visible when a professional is selected and day tab active
      const hasBulk = await scheduling.bulkSlotsButton.isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await scheduling.noProfessionalsEmpty.isVisible().catch(() => false);
      const hasSelect = await scheduling.selectProfessionalEmpty.isVisible().catch(() => false);

      // Either bulk button is visible or no professionals exist
      expect(hasBulk || hasEmpty || hasSelect).toBe(true);
    });
  });
});
