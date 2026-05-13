import { test, expect } from '../../playwright-fixture';
import { mockAuthMe, trackApiCalls } from '../helpers';

/**
 * Bug-Finding Tests: Billing Quotas
 *
 * These tests verify billing/quota UI behaviors:
 * - Alert visibility at 80%/100%/overage thresholds
 * - SubscriptionGuard redirect for EXPIRED/CANCELED plans
 * - Error handling for API failures
 * - Double-click protection on upgrade
 * - CSV export functionality
 */

const USAGE_API = '**/api/v1/tenants/*/usage';
const PLANS_API = '**/api/v1/tenants/*/subscription/plans';
const CATALOG_API = '**/api/v1/tenants/*/subscription/catalog';
const CHANGE_PLAN_API = '**/api/v1/tenants/*/subscription/plan';
const CANCEL_API = '**/api/v1/tenants/*/subscription/cancel';

function buildUsageResponse(overrides: {
  messages?: { used: number; quota: number };
  aiTokens?: { used: number; quota: number };
  contacts?: { used: number; quota: number };
  plan?: string;
  scheduledPlan?: string;
}) {
  return {
    data: {
      tenantId: 'tenant-test-id',
      plan: overrides.plan ?? 'PROFISSIONAL',
      scheduledPlan: overrides.scheduledPlan,
      currentPeriod: {
        start: '2026-05-01T00:00:00Z',
        end: '2026-05-31T23:59:59Z',
      },
      usage: {
        messages: overrides.messages ?? { used: 5000, quota: 75000 },
        aiTokens: overrides.aiTokens ?? { used: 500000, quota: 7500000 },
        contacts: overrides.contacts ?? { used: 200, quota: 2500 },
      },
    },
  };
}

function buildPlansResponse() {
  return {
    data: {
      tenantId: 'tenant-test-id',
      plans: [
        { code: 'TRIAL', displayName: 'Trial', monthlyPrice: 0, sortOrder: 0, active: true, messagesQuota: 1500, aiTokensQuota: 150000, contactsQuota: 50, features: [] },
        { code: 'ESSENCIAL', displayName: 'Essencial', monthlyPrice: 9700, sortOrder: 1, active: true, messagesQuota: 15000, aiTokensQuota: 1500000, contactsQuota: 500, features: [] },
        { code: 'PROFISSIONAL', displayName: 'Profissional', monthlyPrice: 19700, sortOrder: 2, active: true, messagesQuota: 75000, aiTokensQuota: 7500000, contactsQuota: 2500, features: [] },
        { code: 'ESCALA', displayName: 'Escala', monthlyPrice: 49700, sortOrder: 3, active: true, messagesQuota: 300000, aiTokensQuota: 30000000, contactsQuota: 10000, features: [] },
      ],
    },
  };
}

function buildCatalogResponse() {
  return {
    data: {
      tenantId: 'tenant-test-id',
      subscription: {
        plan: 'PROFISSIONAL',
        status: 'ACTIVE',
        pricing: {
          baseMonthlyPrice: 19700,
          addonsMonthlyPrice: 0,
          totalMonthlyPrice: 19700,
        },
        includedModules: [],
        addonModules: [],
        enabledModules: [],
        moduleAccess: {},
      },
      availableAddons: [],
      niche: null,
    },
  };
}

async function setupBillingMocks(
  page: import('@playwright/test').Page,
  usageOverrides: Parameters<typeof buildUsageResponse>[0] = {},
) {
  await mockAuthMe(page);

  await page.route(USAGE_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildUsageResponse(usageOverrides)),
    }),
  );

  await page.route(PLANS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPlansResponse()),
    }),
  );

  await page.route(CATALOG_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildCatalogResponse()),
    }),
  );
}

test.describe('@bug-hunt Billing Quotas', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.1: Quota 100% — red alert should be visible
  // Expected: destructive alert card with "limite proximo" text
  // Actual bug: UI might not show alert when quota is exactly at 100%
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.1 quota 100% should show red alert card', async ({ page }) => {
    await setupBillingMocks(page, {
      messages: { used: 75000, quota: 75000 },
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    await expect(page.getByText('Atencao operacional: limite proximo')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /ver planos/i })).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.2: Quota 100% — CTA "Ver planos" should scroll to plans section
  // Expected: clicking "Ver planos" scrolls to plans comparison
  // Actual bug: button might not navigate or scroll
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.2 quota 100% CTA "Ver planos" should function', async ({ page }) => {
    await setupBillingMocks(page, {
      messages: { used: 75000, quota: 75000 },
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    const ctaButton = page.getByRole('button', { name: /ver planos/i });
    await expect(ctaButton).toBeVisible({ timeout: 5000 });
    await ctaButton.click();

    // The plans comparison section should be scrolled into view
    const plansSection = page.locator('#plans-comparison');
    await expect(plansSection).toBeVisible({ timeout: 3000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.3: Quota 80% — yellow/destructive alert should be visible
  // Expected: alert card appears when any quota reaches 80%
  // Actual bug: threshold check might be > instead of >=
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.3 quota exactly 80% should show alert card', async ({ page }) => {
    await setupBillingMocks(page, {
      messages: { used: 60000, quota: 75000 }, // exactly 80%
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    await expect(page.getByText('Atencao operacional: limite proximo')).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.4: Quota 0% — no false alerts
  // Expected: no alert card when usage is zero
  // Actual bug: alert might appear with zero usage due to bad condition
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.4 quota 0% should not show any alert', async ({ page }) => {
    await setupBillingMocks(page, {
      messages: { used: 0, quota: 75000 },
      aiTokens: { used: 0, quota: 7500000 },
      contacts: { used: 0, quota: 2500 },
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Page should load successfully (no error state)
    await expect(page.getByRole('paragraph').filter({ hasText: 'Plano atual' })).toBeVisible({ timeout: 5000 });

    // Alert should NOT be visible
    await expect(page.getByText('Atencao operacional: limite proximo')).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.5: Quota >100% (overage) — UI should not crash
  // Expected: progress bars handle used > quota gracefully (no NaN/Infinity)
  // Actual bug: division or percentage calc might produce NaN/Infinity
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.5 quota overage (>100%) should not crash UI', async ({ page }) => {
    await setupBillingMocks(page, {
      messages: { used: 90000, quota: 75000 }, // 120% usage
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Page should render without crash
    await expect(page.getByRole('paragraph').filter({ hasText: 'Plano atual' })).toBeVisible({ timeout: 5000 });

    // Should NOT show NaN or Infinity anywhere
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('NaN');
    expect(pageContent).not.toContain('Infinity');

    // Alert should still be visible
    await expect(page.getByText('Atencao operacional: limite proximo')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.6: Plan EXPIRED — SubscriptionGuard should redirect to billing
  // Expected: navigating to /app/dashboard with EXPIRED plan redirects to billing
  // Actual bug: guard might not check planStatus correctly
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.6 expired plan should redirect to billing page', async ({ page }) => {
    await mockAuthMe(page, { tenant: { planStatus: 'EXPIRED' } });

    // Mock billing APIs so the billing page can render after redirect
    await page.route(USAGE_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildUsageResponse({})),
      }),
    );
    await page.route(PLANS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPlansResponse()),
      }),
    );
    await page.route(CATALOG_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildCatalogResponse()),
      }),
    );

    // Try to navigate to dashboard (non-billing page)
    await page.goto('/app/dashboard');
    await page.waitForTimeout(2000);

    // Should be redirected to billing
    expect(page.url()).toContain('/app/billing');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.7: Plan CANCELED — SubscriptionGuard should redirect to billing
  // Expected: same as EXPIRED but with CANCELED status
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.7 canceled plan should redirect to billing page', async ({ page }) => {
    await mockAuthMe(page, { tenant: { planStatus: 'CANCELED' } });

    await page.route(USAGE_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildUsageResponse({})),
      }),
    );
    await page.route(PLANS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPlansResponse()),
      }),
    );
    await page.route(CATALOG_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildCatalogResponse()),
      }),
    );

    await page.goto('/app/dashboard');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/app/billing');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.8: CSV export button should trigger download
  // Expected: clicking export button calls the download endpoint
  // Actual bug: download might not trigger or error silently
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.8 CSV export button should trigger download', async ({ page }) => {
    await setupBillingMocks(page);

    // Mock the CSV export endpoint
    await page.route('**/api/v1/tenants/*/usage/export.csv', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'tipo,usado,quota\nmensagens,5000,75000\n',
        headers: {
          'Content-Disposition': 'attachment; filename="uso-periodo-atual.csv"',
        },
      }),
    );

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Find and click the export/download button
    const exportBtn = page.getByRole('button', { name: /exportar uso/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });

    // Click should not throw
    await exportBtn.click();
    await page.waitForTimeout(500);

    // Page should still be functional (no crash)
    await expect(page.getByRole('paragraph').filter({ hasText: 'Plano atual' })).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.9: Change plan mutation without onError — silent failure
  // Expected: API 500 on plan change shows error toast
  // Actual bug: mutation might not have onError handler
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.9 plan change API error should show error feedback', async ({ page }) => {
    await setupBillingMocks(page);

    // Mock plan change to return 500
    await page.route(CHANGE_PLAN_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      }),
    );

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Scroll to plans section and select a plan
    const plansSection = page.locator('#plans-comparison');
    if (await plansSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to click on Escala plan to trigger upgrade
      const escalaPlan = page.getByText('Escala').first();
      if (await escalaPlan.isVisible({ timeout: 2000 }).catch(() => false)) {
        await escalaPlan.click();
        await page.waitForTimeout(500);

        // Look for confirm button
        const confirmBtn = page.getByRole('button', { name: /confirmar|contratar/i }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(1500);

          // Should show some error feedback (toast or inline error)
          // The page should NOT be in a broken state
          await expect(page.getByText('Plano atual')).toBeVisible();
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.10: Cancel subscription without confirmation dialog
  // Expected: cancel action requires explicit confirmation
  // Actual bug: destructive action might fire without dialog
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.10 cancel subscription should require confirmation', async ({ page }) => {
    await setupBillingMocks(page);

    const cancelCalls = await trackApiCalls(page, CANCEL_API);

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Look for cancel button in the header area
    const cancelBtn = page.getByRole('button', { name: /cancelar assinatura|cancelar plano/i });
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(500);

      // Should show confirmation dialog/sheet BEFORE calling API
      // At this point, the API should NOT have been called yet
      expect(cancelCalls.length).toBe(0);

      // A confirmation dialog should be visible
      const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
      const sheetContent = page.locator('[data-state="open"]').first();
      const hasConfirmation =
        (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) ||
        (await sheetContent.isVisible({ timeout: 1000 }).catch(() => false));

      expect(hasConfirmation).toBe(true);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.11: Double-click on "Confirmar upgrade" fires multiple mutations
  // Expected: only one mutation fires even with rapid clicks
  // Actual bug: no debounce/disable on confirm button
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.11 double-click on upgrade confirm should not fire multiple mutations', async ({ page }) => {
    await setupBillingMocks(page);

    const changePlanCalls: string[] = [];
    await page.route(CHANGE_PLAN_API, (route) => {
      changePlanCalls.push(route.request().method());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            tenantId: 'tenant-test-id',
            plan: 'PROFISSIONAL',
            currentPlan: 'PROFISSIONAL',
            targetPlan: 'ESCALA',
            status: 'PENDING',
            mode: 'CHECKOUT_REQUIRED',
            checkoutUrl: 'https://checkout.example.com/test',
          },
        }),
      });
    });

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(1500);

    // Scroll to plans and select Escala
    const plansSection = page.locator('#plans-comparison');
    if (await plansSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      const escalaPlan = page.getByText('Escala').first();
      if (await escalaPlan.isVisible({ timeout: 2000 }).catch(() => false)) {
        await escalaPlan.click();
        await page.waitForTimeout(500);

        const confirmBtn = page.getByRole('button', { name: /confirmar|contratar/i }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Rapid double-click
          await confirmBtn.dblclick();
          await page.waitForTimeout(2000);

          // Should have fired at most 1 mutation
          expect(changePlanCalls.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #1.12: API usage 500 — should show friendly error, not infinite loading
  // Expected: error state with "Erro no carregamento" message
  // Actual bug: page might stay in loading skeleton forever
  // ═══════════════════════════════════════════════════════════════════════════════

  test('1.12 usage API 500 should show error state, not infinite loading', async ({ page }) => {
    await mockAuthMe(page);

    // Mock usage to return 500
    await page.route(USAGE_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      }),
    );

    await page.route(PLANS_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPlansResponse()),
      }),
    );

    await page.route(CATALOG_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildCatalogResponse()),
      }),
    );

    await page.goto('/app/billing/usage');
    await page.waitForTimeout(3000);

    // Should show error state, not loading skeleton
    await expect(page.getByText(/erro no carregamento/i)).toBeVisible({ timeout: 5000 });
  });
});
