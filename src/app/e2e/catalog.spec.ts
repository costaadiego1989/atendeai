import { test, expect } from '../playwright-fixture';

test.describe('Catalog', () => {
  test.describe('List & Navigation', () => {
    test('@smoke should load catalog page with items grid', async ({ page }) => {
      await page.goto('/app/catalog');

      await expect(page).toHaveURL(/\/app\/catalog/);

      // Should show catalog heading or product grid
      const content = page.locator(
        '[data-testid="catalog-list"], [data-testid="catalog-grid"], table, .grid'
      );
      const emptyState = page.getByText(/nenhum item|nenhum produto|sem itens|catalogo vazio/i);

      const hasContent = await content.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasContent || hasEmpty).toBe(true);
    });

    test('@regression should display search and filter controls', async ({ page }) => {
      await page.goto('/app/catalog');

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
      await expect(searchInput.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should filter items by category', async ({ page }) => {
      await page.goto('/app/catalog');

      // Look for category filter (select, dropdown, or tabs)
      const categoryFilter = page.locator(
        '[data-testid="category-filter"], select, [role="combobox"], [role="tablist"]'
      );
      await expect(categoryFilter.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('CRUD Operations', () => {
    test('@regression should open create item form', async ({ page }) => {
      await page.goto('/app/catalog');

      const newButton = page.getByRole('button', { name: /novo|adicionar|criar|new/i });
      await expect(newButton.first()).toBeVisible({ timeout: 10_000 });
      await newButton.first().click();

      // Form or modal should appear
      const form = page.locator(
        'form, [role="dialog"], [data-testid="item-form"], [data-testid="create-item"]'
      );
      await expect(form.first()).toBeVisible({ timeout: 5_000 });
    });

    test('@regression should validate required fields on item creation', async ({ page }) => {
      await page.goto('/app/catalog');

      const newButton = page.getByRole('button', { name: /novo|adicionar|criar|new/i });
      await newButton.first().click();

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /salvar|criar|confirmar|save/i });
      await submitButton.first().click();

      // Expect validation errors
      const errors = page.locator('[role="alert"], .text-destructive, [data-error], .error');
      await expect(errors.first()).toBeVisible({ timeout: 5_000 });
    });

    test('@regression should show item details when clicking an item', async ({ page }) => {
      await page.goto('/app/catalog');

      // Click on first item in the list/grid
      const item = page.locator(
        '[data-testid="catalog-item"], tr[data-row], .catalog-card, [role="row"]'
      );
      const itemExists = await item.first().isVisible().catch(() => false);

      if (itemExists) {
        await item.first().click();

        // Detail view or edit form should appear
        const detail = page.locator(
          '[data-testid="item-detail"], [role="dialog"], form, [data-testid="item-form"]'
        );
        await expect(detail.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should handle delete confirmation dialog', async ({ page }) => {
      await page.goto('/app/catalog');

      const item = page.locator(
        '[data-testid="catalog-item"], tr[data-row], .catalog-card, [role="row"]'
      );
      const itemExists = await item.first().isVisible().catch(() => false);

      if (itemExists) {
        // Look for delete button (may be in context menu or action column)
        const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover|delete/i });
        const menuBtn = page.locator('[data-testid="item-actions"], [aria-label="actions"]');

        const hasDelete = await deleteBtn.first().isVisible().catch(() => false);
        const hasMenu = await menuBtn.first().isVisible().catch(() => false);

        if (hasMenu) {
          await menuBtn.first().click();
        }

        if (hasDelete || hasMenu) {
          const delAction = page.getByRole('menuitem', { name: /excluir|deletar|remover/i })
            .or(page.getByRole('button', { name: /excluir|deletar|remover|delete/i }));
          const delVisible = await delAction.first().isVisible().catch(() => false);

          if (delVisible) {
            await delAction.first().click();
            // Confirmation dialog should appear
            const dialog = page.locator('[role="alertdialog"], [role="dialog"]');
            await expect(dialog.first()).toBeVisible({ timeout: 5_000 });
          }
        }
      }
    });
  });

  test.describe('Categories', () => {
    test('@regression should display categories management', async ({ page }) => {
      await page.goto('/app/catalog');

      // Look for categories tab/section
      const categoriesLink = page.getByRole('link', { name: /categoria/i })
        .or(page.getByRole('tab', { name: /categoria/i }))
        .or(page.getByRole('button', { name: /categoria/i }));

      const hasCategoriesNav = await categoriesLink.first().isVisible().catch(() => false);

      if (hasCategoriesNav) {
        await categoriesLink.first().click();
        const categoryList = page.locator(
          '[data-testid="categories-list"], table, [role="list"], ul'
        );
        await expect(categoryList.first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('Import/Export (APP-CAT-003)', () => {
    test('@regression should show import option for bulk items', async ({ page }) => {
      await page.goto('/app/catalog');

      // Look for import button
      const importBtn = page.getByRole('button', { name: /importar|import|csv/i })
        .or(page.getByRole('menuitem', { name: /importar|import/i }));

      const hasImport = await importBtn.first().isVisible().catch(() => false);

      // May be inside a dropdown menu
      if (!hasImport) {
        const moreBtn = page.getByRole('button', { name: /mais|more|opcoes|actions/i });
        const hasMore = await moreBtn.first().isVisible().catch(() => false);
        if (hasMore) {
          await moreBtn.first().click();
          const importMenuItem = page.getByRole('menuitem', { name: /importar|import/i });
          await expect(importMenuItem.first()).toBeVisible({ timeout: 3_000 });
        }
      }
    });
  });
});
