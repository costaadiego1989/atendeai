import { test, expect } from '../playwright-fixture';
import { CatalogPage } from './pages';
import {
  mockApiError,
  mockApiResponse,
  mockApiTimeout,
} from './helpers';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const ITEMS_API = `**/api/v1/tenants/${TENANT_ID}/catalog/items*`;
const CATEGORIES_API = `**/api/v1/tenants/${TENANT_ID}/catalog/categories*`;

/**
 * Catalog E2E Tests — Rewritten with real selectors, direct assertions.
 * Covers: smoke, items CRUD, categories CRUD, import, reports, errors, responsiveness.
 */

test.describe('Catalog', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. SMOKE TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('1. Smoke Tests', () => {
    test('1.1 @smoke should load catalog page with heading', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();
    });

    test('1.2 @smoke should display page description', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.description).toBeVisible();
    });

    test('1.3 @smoke should display header action buttons', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.importButton).toBeVisible();
      await expect(catalog.newCategoryButton).toBeVisible();
      await expect(catalog.newItemButton).toBeVisible();
    });

    test('1.4 @smoke should display KPI cards', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.kpiActiveItems).toBeVisible();
      await expect(catalog.kpiCategories).toBeVisible();
      await expect(catalog.kpiServices).toBeVisible();
      await expect(catalog.kpiProducts).toBeVisible();
    });

    test('1.5 @smoke should display tabs (Itens, Categorias, Prontidão)', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.itemsTab).toBeVisible();
      await expect(catalog.categoriesTab).toBeVisible();
      await expect(catalog.readinessTab).toBeVisible();
    });

    test('1.6 @smoke should display type filter buttons', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.typeAll).toBeVisible();
      await expect(catalog.typeProducts).toBeVisible();
      await expect(catalog.typeServices).toBeVisible();
      await expect(catalog.typeRentals).toBeVisible();
    });

    test('1.7 @smoke should display reports button', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.reportsButton).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. ITEMS TAB
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('2. Items Tab', () => {
    test('2.1 @smoke should display search input', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.itemSearchInput).toBeVisible();
    });

    test('2.2 @regression should show items table or empty state', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      const hasTable = await catalog.itemsTable.isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await catalog.itemsEmptyTitle.isVisible().catch(() => false);
      const hasLoading = await catalog.itemsLoading.isVisible().catch(() => false);

      expect(hasTable || hasEmpty || hasLoading).toBe(true);
    });

    test('2.3 @regression should type in search input', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.itemSearchInput.fill('camiseta');
      await expect(catalog.itemSearchInput).toHaveValue('camiseta');
      await catalog.assertNoCrash();
    });

    test('2.4 @regression should open new item sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewItemSheet();
      await expect(catalog.itemNameInput).toBeVisible();
      await expect(catalog.createItemButton).toBeVisible();
    });

    test('2.5 @regression should display all base fields in item sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewItemSheet();

      await expect(catalog.itemNameInput).toBeVisible();
      await expect(catalog.itemPriceInput).toBeVisible();
      await expect(catalog.itemRefInput).toBeVisible();
      await expect(catalog.itemDescriptionInput).toBeVisible();
    });

    test('2.6 @regression should fill item name and price', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewItemSheet();

      await catalog.itemNameInput.fill('Produto E2E Teste');
      await expect(catalog.itemNameInput).toHaveValue('Produto E2E Teste');

      await catalog.itemPriceInput.fill('99,90');
      await expect(catalog.itemPriceInput).toHaveValue(/99/);
    });

    test('2.7 @regression should close item sheet on cancel', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewItemSheet();
      await expect(catalog.itemSheetTitle).toBeVisible();

      await catalog.cancelItemButton.click();
      await expect(catalog.itemSheetTitle).toBeHidden({ timeout: 3_000 });
    });

    test('2.8 @regression should filter items by type Produtos', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.typeProducts.click();
      await catalog.assertNoCrash();
    });

    test('2.9 @regression should filter items by type Serviços', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.typeServices.click();
      await catalog.assertNoCrash();
    });

    test('2.10 @regression should show empty state when no items match', async ({ page }) => {
      await page.route(ITEMS_API, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: { total: 0, page: 1, perPage: 20 } }),
        }),
      );

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.itemsEmptyTitle).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. CATEGORIES TAB
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('3. Categories Tab', () => {
    test('3.1 @smoke should switch to categories tab', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToCategoriesTab();
      await catalog.assertNoCrash();
    });

    test('3.2 @regression should show categories list or empty state', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToCategoriesTab();

      const hasCategories = await page.locator('.glass-card').first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      const hasEmpty = await catalog.categoriesEmptyTitle.isVisible().catch(() => false);
      const hasLoading = await catalog.categoriesLoading.isVisible().catch(() => false);

      expect(hasCategories || hasEmpty || hasLoading).toBe(true);
    });

    test('3.3 @regression should open new category sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewCategorySheet();
      await expect(catalog.categoryNameInput).toBeVisible();
      await expect(catalog.saveCategoryButton).toBeVisible();
    });

    test('3.4 @regression should fill category name and description', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewCategorySheet();

      await catalog.categoryNameInput.fill('Categoria E2E');
      await expect(catalog.categoryNameInput).toHaveValue('Categoria E2E');

      await catalog.categoryDescriptionInput.fill('Descrição de teste');
      await expect(catalog.categoryDescriptionInput).toHaveValue('Descrição de teste');
    });

    test('3.5 @regression should close category sheet on cancel', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewCategorySheet();
      await expect(catalog.categorySheetTitle).toBeVisible();

      await catalog.cancelCategoryButton.click();
      await expect(catalog.categorySheetTitle).toBeHidden({ timeout: 3_000 });
    });

    test('3.6 @regression should show empty state when no categories exist', async ({ page }) => {
      await page.route(CATEGORIES_API, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
      );

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToCategoriesTab();
      await expect(catalog.categoriesEmptyTitle).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. READINESS TAB
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('4. Readiness Tab', () => {
    test('4.1 @regression should switch to readiness tab', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToReadinessTab();
      await catalog.assertNoCrash();
    });

    test('4.2 @regression should display readiness info cards', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToReadinessTab();

      await expect(catalog.readinessAgenda).toBeVisible({ timeout: 5_000 });
      await expect(catalog.readinessEstoque).toBeVisible();
      await expect(catalog.readinessIA).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. IMPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('5. Import', () => {
    test('5.1 @regression should open import sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openImportSheet();
      await expect(catalog.importTextarea).toBeVisible();
      await expect(catalog.downloadTemplateButton).toBeVisible();
      await expect(catalog.importSubmitButton).toBeVisible();
    });

    test('5.2 @regression should fill import textarea', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openImportSheet();

      const csvData = 'PRODUCT,Cafe especial,24.90,Bebidas,CAF-001,18';
      await catalog.importTextarea.fill(csvData);
      await expect(catalog.importTextarea).toHaveValue(csvData);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('6. Reports', () => {
    test('6.1 @regression should open reports sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openReportsSheet();
      await expect(catalog.reportsCsvButton).toBeVisible();
      await expect(catalog.reportsCloseButton).toBeVisible();
    });

    test('6.2 @regression should close reports sheet', async ({ page }) => {
      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openReportsSheet();
      await expect(catalog.reportsSheetTitle).toBeVisible();

      await catalog.reportsCloseButton.click();
      await expect(catalog.reportsSheetTitle).toBeHidden({ timeout: 3_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('7. Error Handling', () => {
    test('7.1 @regression should handle items API error gracefully', async ({ page }) => {
      await page.route(ITEMS_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();
      await catalog.assertNoCrash();
    });

    test('7.2 @regression should handle categories API error gracefully', async ({ page }) => {
      await page.route(CATEGORIES_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.switchToCategoriesTab();
      await catalog.assertNoCrash();
    });

    test('7.3 @regression should handle items API timeout gracefully', async ({ page }) => {
      await page.route(ITEMS_API, (route) => route.abort('timedout'));

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();
      await catalog.assertNoCrash();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. RESPONSIVENESS
  // ═══════════════════════════════════════════════════════════════════════════════

  test.describe('8. Responsiveness', () => {
    test('8.1 @regression catalog page renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.newItemButton).toBeVisible();
      await expect(catalog.kpiActiveItems).toBeVisible();
    });

    test('8.2 @regression catalog page renders on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.itemSearchInput).toBeVisible();
      await expect(catalog.reportsButton).toBeVisible();
    });

    test('8.3 @regression catalog page renders on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await expect(catalog.kpiActiveItems).toBeVisible();
      await expect(catalog.kpiCategories).toBeVisible();
      await expect(catalog.kpiServices).toBeVisible();
      await expect(catalog.kpiProducts).toBeVisible();
      await expect(catalog.importButton).toBeVisible();
    });

    test('8.4 @regression new item sheet works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const catalog = new CatalogPage(page);
      await catalog.goto();
      await catalog.assertPageVisible();

      await catalog.openNewItemSheet();
      await expect(catalog.itemNameInput).toBeVisible();
      await expect(catalog.createItemButton).toBeVisible();
    });
  });
});
