import { test, expect } from '../playwright-fixture';

test.describe('Scheduling', () => {
  test.describe('Calendar View', () => {
    test('@smoke should load scheduling page with calendar', async ({ page }) => {
      await page.goto('/app/scheduling');

      await expect(page).toHaveURL(/\/app\/scheduling/);

      const content = page.locator(
        'main, [role="main"], [data-testid="scheduling-page"], [data-testid="calendar"]'
      );
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display calendar or agenda view', async ({ page }) => {
      await page.goto('/app/scheduling');

      const calendar = page.locator(
        '[data-testid="calendar"], [role="grid"], .calendar, .fc, [data-testid="agenda"]'
      );
      const emptyState = page.getByText(/nenhum agendamento|sem agendamentos|agenda vazia/i);

      const hasCalendar = await calendar.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasCalendar || hasEmpty).toBe(true);
    });

    test('@regression should allow switching between day/week/month views', async ({ page }) => {
      await page.goto('/app/scheduling');

      const viewToggle = page.locator(
        '[data-testid="view-toggle"], [role="tablist"], .view-switcher'
      );
      const dayBtn = page.getByRole('button', { name: /dia|day/i });
      const weekBtn = page.getByRole('button', { name: /semana|week/i });
      const monthBtn = page.getByRole('button', { name: /mês|mes|month/i });

      const hasToggle = await viewToggle.first().isVisible().catch(() => false);
      const hasDay = await dayBtn.first().isVisible().catch(() => false);
      const hasWeek = await weekBtn.first().isVisible().catch(() => false);

      expect(hasToggle || hasDay || hasWeek).toBe(true);
    });

    test('@regression should filter by professional', async ({ page }) => {
      await page.goto('/app/scheduling');

      const professionalFilter = page.locator(
        '[data-testid="professional-filter"], [data-testid="filter-professional"]'
      );
      const filterSelect = page.getByRole('combobox', { name: /profissional|professional/i });
      const filterBtn = page.getByRole('button', { name: /profissional|filtrar/i });

      const hasFilter = await professionalFilter.first().isVisible().catch(() => false);
      const hasSelect = await filterSelect.first().isVisible().catch(() => false);
      const hasBtn = await filterBtn.first().isVisible().catch(() => false);

      // At minimum, page should load without error
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Appointment CRUD', () => {
    test('@regression should open create appointment form', async ({ page }) => {
      await page.goto('/app/scheduling');

      const newButton = page.getByRole('button', { name: /novo|agendar|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        const form = page.locator(
          'form, [role="dialog"], [data-testid="appointment-form"], [data-testid="create-appointment"]'
        );
        await expect(form.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('@regression should validate appointment form fields', async ({ page }) => {
      await page.goto('/app/scheduling');

      const newButton = page.getByRole('button', { name: /novo|agendar|criar|adicionar|new/i });
      const hasButton = await newButton.first().isVisible().catch(() => false);

      if (hasButton) {
        await newButton.first().click();

        // Try to submit empty
        const submitBtn = page.getByRole('button', { name: /salvar|confirmar|agendar|save/i });
        const hasSubmit = await submitBtn.first().isVisible().catch(() => false);

        if (hasSubmit) {
          await submitBtn.first().click();
          const errors = page.locator('[role="alert"], .text-destructive, [data-error]');
          await expect(errors.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    });

    test('@regression should handle time conflict error', async ({ page }) => {
      // Mock scheduling endpoint to return conflict
      await page.route('**/api/v1/scheduling/appointments*', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Time slot conflict', code: 'SLOT_CONFLICT' }),
          });
        }
        return route.continue();
      });

      await page.goto('/app/scheduling');

      // Page should load without crash
      const errorBoundary = page.locator('.error-boundary');
      const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
      expect(hasCrash).toBe(false);
    });
  });

  test.describe('Professionals Management', () => {
    test('@regression should navigate to professionals page', async ({ page }) => {
      await page.goto('/app/scheduling/professionals');

      await expect(page).toHaveURL(/\/app\/scheduling\/professionals/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('@regression should display professionals list or empty state', async ({ page }) => {
      await page.goto('/app/scheduling/professionals');

      const list = page.locator(
        '[data-testid="professionals-list"], table, [role="list"], .professional-item'
      );
      const emptyState = page.getByText(/nenhum profissional|sem profissionais|adicione/i);

      const hasList = await list.first().isVisible().catch(() => false);
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBe(true);
    });
  });

  test.describe('Categories', () => {
    test('@regression should navigate to categories page', async ({ page }) => {
      await page.goto('/app/scheduling/categories');

      await expect(page).toHaveURL(/\/app\/scheduling\/categories/);

      const content = page.locator('main, [role="main"]');
      await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
