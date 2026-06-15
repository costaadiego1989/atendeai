import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Automations render regression — ADR-0026.
 *
 * Guards against the crash class where cleanup commits dropped imports,
 * producing `ReferenceError: <X> is not defined` at render time
 * (TriggerType, FileText, TRIGGER_LABELS, Search, Badge, Calendar,
 * Zap, X, ChevronDown, Button, ...). These surfaced as the ErrorBoundary
 * fallback ("Algo deu errado").
 *
 * Runs under the `bug-hunting` project: no real backend, auth + API mocked.
 */

async function mockAutomationsApi(page: import('@playwright/test').Page) {
  // Catch-all FIRST (lowest priority — Playwright matches last-registered first).
  // Prevents any unmocked /api/v1 call from 401-ing and triggering the global
  // session-expired logout redirect.
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  );

  await mockAuthMe(page);

  // react-query list (apiClient → /api/v1/tenants/:id/automations)
  await page.route('**/api/v1/tenants/*/automations**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  );
  // search-service raw fetch endpoints
  await page.route('**/api/automations/search', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ automations: [] }) }),
  );
  await page.route('**/api/automations/metrics', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, active: 0, inactive: 0 }),
    }),
  );
  await page.route('**/api/automations/tags', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

test.describe('Automations render (ADR-0026)', () => {
  // Serial: first navigation cold-compiles the Vite route chunk; parallel cold
  // compiles can exceed per-assertion timeouts.
  test.describe.configure({ mode: 'serial' });

  test('@smoke mounts /app/automations with no ReferenceError / ErrorBoundary', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await mockAutomationsApi(page);
    await page.goto('/app/automations');

    await expect(page).toHaveURL(/\/app\/automations/);
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: /automações/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /criar com wizard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /criar manual/i })).toBeVisible();

    const refErrors = pageErrors.filter((m) => /is not defined|ReferenceError/.test(m));
    expect(refErrors, `Unexpected runtime errors: ${refErrors.join(' | ')}`).toHaveLength(0);
  });

  test('filter bar renders (AutomationFilter — the crashing component)', async ({ page }) => {
    await mockAutomationsApi(page);
    await page.goto('/app/automations');

    await expect(
      page.getByPlaceholder(/buscar por nome, descrição, tags/i),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('advanced filters expand without crashing (Select/Calendar/MultiSelect)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await mockAutomationsApi(page);
    await page.goto('/app/automations');

    const advancedToggle = page.getByRole('button', { name: /avançado/i });
    await expect(advancedToggle).toBeVisible({ timeout: 20_000 });
    await advancedToggle.click();

    await expect(page.getByText(/tipos de gatilho/i)).toBeVisible();
    await expect(page.getByText(/período/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /limpar filtros/i })).toBeVisible();

    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
    const refErrors = pageErrors.filter((m) => /is not defined|ReferenceError/.test(m));
    expect(refErrors, `Unexpected runtime errors: ${refErrors.join(' | ')}`).toHaveLength(0);
  });
});
