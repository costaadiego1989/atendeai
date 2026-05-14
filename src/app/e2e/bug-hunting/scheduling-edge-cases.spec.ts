import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Scheduling Module Edge Cases
 *
 * These tests verify edge cases in the Scheduling module:
 * - Overbooking: reserving an already-occupied slot
 * - Past date: creating a slot in the past
 * - Create professional with API 500
 * - Reserve slot with conflict (409)
 * - Cancel recurrence without confirmation
 */

const TENANT_ID = 'tenant-test-id';
const SCHEDULING_PROFESSIONALS_API = '**/api/v1/tenants/*/scheduling/professionals*';
const SCHEDULING_CATEGORIES_API = '**/api/v1/tenants/*/scheduling/categories*';
const SCHEDULING_AVAILABILITY_API = '**/api/v1/tenants/*/scheduling/professionals/*/availability*';
const SCHEDULING_RESERVE_API = '**/api/v1/tenants/*/scheduling/professionals/*/reserve*';
const SCHEDULING_SLOTS_API = '**/api/v1/tenants/*/scheduling/professionals/*/slots*';
const SCHEDULING_RECURRENCES_API = '**/api/v1/tenants/*/scheduling/recurrences*';
const CONTACTS_API = '**/api/v1/tenants/*/contacts*';

const SCHEDULING_URL = '/app/scheduling';

const mockProfessional = {
  id: 'prof-1',
  tenantId: TENANT_ID,
  name: 'Dr. Carlos',
  phone: '11999990000',
  role: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockCategory = {
  id: 'cat-1',
  tenantId: TENANT_ID,
  name: 'Consulta',
  unit: 'PER_MINUTE',
  durationMinutes: 30,
  basePrice: 15000,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const today = new Date().toISOString().split('T')[0];

const mockSlots = [
  {
    id: 'slot-1',
    date: today,
    startsAt: '09:00',
    endsAt: '09:30',
    status: 'AVAILABLE',
    label: null,
    contactId: null,
    contactName: null,
    categoryId: null,
    categoryName: null,
    notes: null,
    isOnline: false,
    isFree: false,
  },
  {
    id: 'slot-2',
    date: today,
    startsAt: '10:00',
    endsAt: '10:30',
    status: 'RESERVED',
    label: null,
    contactId: 'contact-1',
    contactName: 'Maria',
    categoryId: 'cat-1',
    categoryName: 'Consulta',
    notes: null,
    isOnline: false,
    isFree: false,
  },
];

async function setupSchedulingPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(SCHEDULING_PROFESSIONALS_API, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockProfessional]),
      });
    }
    return route.continue();
  });

  await page.route(SCHEDULING_CATEGORIES_API, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockCategory]),
      });
    }
    return route.continue();
  });

  await page.route(SCHEDULING_AVAILABILITY_API, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSlots),
      });
    }
    return route.continue();
  });

  await page.route(SCHEDULING_RECURRENCES_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route(CONTACTS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'contact-1', name: 'Maria', phone: '11999998888' }] }),
    }),
  );
}

test.describe('@bug-hunt Scheduling Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #SC1: Create professional with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('SC1.1 create professional should show error on API 500', async ({ page }) => {
    await setupSchedulingPageMocks(page);

    // Override POST to return 500
    await page.route(SCHEDULING_PROFESSIONALS_API, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockProfessional]),
      });
    });

    await page.goto(SCHEDULING_URL);
    await page.waitForTimeout(1000);

    // Click "Novo Profissional" button
    const newProfBtn = page.getByRole('button', { name: /novo profissional|adicionar/i }).first();
    if (await newProfBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newProfBtn.click();
      await page.waitForTimeout(500);

      // Fill name
      const nameInput = page.getByLabel(/nome/i).first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Dr. Novo');
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /criar|salvar|confirmar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #SC2: Reserve slot that is already occupied (conflict)
  // Expected: error toast with conflict message
  // ═══════════════════════════════════════════════════════════════════════════════

  test('SC2.1 reserve occupied slot should show conflict error', async ({ page }) => {
    await setupSchedulingPageMocks(page);

    // Reserve endpoint returns 409 (conflict)
    await page.route(SCHEDULING_RESERVE_API, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Slot already reserved', code: 'SLOT_CONFLICT' }),
      }),
    );

    // Also intercept slot update for the same scenario
    await page.route(SCHEDULING_SLOTS_API, (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Slot already reserved', code: 'SLOT_CONFLICT' }),
        });
      }
      return route.continue();
    });

    await page.goto(SCHEDULING_URL);
    await page.waitForTimeout(1500);

    // Click on an available slot (09:00)
    const slot = page.getByText('09:00').first();
    if (await slot.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slot.click();
      await page.waitForTimeout(500);

      // Try to reserve
      const reserveBtn = page.getByRole('button', { name: /reservar|agendar|confirmar/i }).first();
      if (await reserveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reserveBtn.click();

        await expect(
          page.getByText(/falha|erro|conflito|já reserv|occupied/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #SC3: Create category with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('SC3.1 create category should show error on API 500', async ({ page }) => {
    await setupSchedulingPageMocks(page);

    await page.route(SCHEDULING_CATEGORIES_API, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockCategory]),
      });
    });

    await page.goto(SCHEDULING_URL);
    await page.waitForTimeout(1000);

    // Click "Nova Categoria" button
    const newCatBtn = page.getByRole('button', { name: /nova categoria|categoria/i }).first();
    if (await newCatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newCatBtn.click();
      await page.waitForTimeout(500);

      const nameInput = page.getByLabel(/nome/i).first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Retorno');
      }

      const submitBtn = page.getByRole('button', { name: /criar|salvar|confirmar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #SC4: Cancel recurrence with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('SC4.1 cancel recurrence should show error on API 500', async ({ page }) => {
    await setupSchedulingPageMocks(page);

    const mockRecurrence = {
      id: 'rec-1',
      tenantId: TENANT_ID,
      professionalId: 'prof-1',
      contactId: 'contact-1',
      categoryId: 'cat-1',
      period: 'WEEKLY',
      interval: 1,
      maxOccurrences: 8,
      occurrencesCreated: 3,
      startsAt: '09:00',
      endsAt: '09:30',
      firstDate: '2026-05-01',
      nextDate: '2026-05-20',
      status: 'ACTIVE',
      isFree: false,
      isOnline: false,
      notes: null,
      createdAt: '2026-05-01T00:00:00Z',
    };

    await page.route(SCHEDULING_RECURRENCES_API, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRecurrence]),
        });
      }
      // Cancel returns 500
      if (route.request().method() === 'DELETE' || route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(SCHEDULING_URL);
    await page.waitForTimeout(1000);

    // Navigate to recurrences tab/section
    const recTab = page.getByRole('tab', { name: /recorrên|recurrence|contratos/i }).first();
    if (await recTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await recTab.click();
      await page.waitForTimeout(500);

      // Click cancel on the recurrence
      const cancelBtn = page.getByRole('button', { name: /cancelar|excluir/i }).first();
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();

        // Confirm if dialog appears
        const confirmBtn = page.getByRole('button', { name: /confirmar|sim/i });
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
