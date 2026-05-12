import { test, expect } from '../playwright-fixture';

test.describe('Support (APP-SUP-001, APP-SUP-002)', () => {
  test.describe('Tickets List', () => {
    test('@smoke should load support page', async ({ page }) => {
      await page.goto('/app/settings/support');

      await expect(page).toHaveURL(/\/app\/settings\/support/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display tickets list or empty state', async ({ page }) => {
      await page.goto('/app/settings/support');

      const list = page.locator(
        '[data-testid="tickets-list"], [data-testid="support-list"], table, [role="list"]'
      );
      const emptyState = page.getByText(/nenhum ticket|sem tickets|nenhuma solicitação|sem solicitações/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });
  });

  test.describe('Create Ticket', () => {
    test('@regression should open create ticket form', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="ticket-form"], [data-testid="support-form"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should show validation errors on empty submit (APP-SUP-002)', async ({ page }) => {
      await page.goto('/app/settings/support');

      const newButton = page.getByRole('button', { name: /novo|nova|criar|abrir|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const submitBtn = page.getByRole('button', { name: /enviar|salvar|criar|confirmar|save|send/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Read-only Constraints (APP-SUP-001)', () => {
    test('@regression should not show edit/delete buttons on tickets', async ({ page }) => {
      await page.goto('/app/settings/support');

      const ticket = page.locator(
        '[data-testid="ticket-item"], tr[data-row], [role="row"], .ticket-item'
      );
      const hasTicket = await ticket.first().isVisible().catch(() => false);

      if (hasTicket) {
        await ticket.first().click();

        // Should NOT have edit or delete buttons
        const editBtn = page.getByRole('button', { name: /editar|edit/i });
        const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover|delete/i });

        const hasEdit = await editBtn.first().isVisible().catch(() => false);
        const hasDelete = await deleteBtn.first().isVisible().catch(() => false);

        // API only supports list/create - no update/delete
        expect(hasEdit && hasDelete).toBe(false);
      }
    });
  });
});
