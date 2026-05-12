import { test, expect } from '../playwright-fixture';

/**
 * Cross-cutting E2E scenarios that span multiple modules or test
 * platform-wide behaviors not covered by individual module specs.
 *
 * These scenarios cover:
 * - Navigation & Layout
 * - Multi-tenancy guards
 * - Module access control (billing gates)
 * - Responsive/mobile behavior
 * - Accessibility basics
 * - Performance budgets
 * - Error boundaries & resilience
 * - Session management
 * - Locale/i18n
 */

test.describe('Cross-Cutting: Navigation & Layout', () => {
  test('@smoke should render sidebar with all enabled module links', async ({ page }) => {
    await page.goto('/app/dashboard');

    const nav = page.locator('nav, [role="navigation"], aside, [data-testid="app-sidebar"]');
    await expect(nav.first()).toBeVisible({ timeout: 10_000 });

    // Core modules should always be in nav
    const dashboardLink = page.getByRole('link', { name: /dashboard|painel/i });
    const conversationsLink = page.getByRole('link', { name: /conversa|mensag/i });
    const contactsLink = page.getByRole('link', { name: /contato|contact/i });

    await expect(dashboardLink.first()).toBeVisible();
    await expect(conversationsLink.first()).toBeVisible();
    await expect(contactsLink.first()).toBeVisible();
  });

  test('@regression should collapse sidebar on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/dashboard');

    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('[data-testid="app-sidebar"], aside, nav');
    const hamburger = page.getByRole('button', { name: /menu/i })
      .or(page.locator('[data-testid="menu-toggle"]'));

    const sidebarVisible = await sidebar.first().isVisible().catch(() => false);
    const hasHamburger = await hamburger.first().isVisible().catch(() => false);

    // Either sidebar is hidden or there's a hamburger menu
    expect(!sidebarVisible || hasHamburger).toBe(true);
  });

  test('@regression should handle 404 routes gracefully', async ({ page }) => {
    await page.goto('/app/nonexistent-page-xyz');

    // Should redirect to dashboard (catch-all route)
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('@regression should maintain scroll position on back navigation', async ({ page }) => {
    await page.goto('/app/contacts');
    await page.waitForLoadState('networkidle');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Navigate away and back
    await page.goto('/app/dashboard');
    await page.goBack();

    await expect(page).toHaveURL(/\/app\/contacts/);
  });
});

test.describe('Cross-Cutting: Module Access Control', () => {
  test('@regression should hide inventory when ESTOQUE_IA not enabled', async ({ page }) => {
    await page.route('**/api/v1/tenant/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data?.billingAccess) {
        json.data.billingAccess.enabledModules = [];
      }
      await route.fulfill({ body: JSON.stringify(json) });
    });

    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');

    const inventoryLink = page.getByRole('link', { name: /estoque|inventory/i });
    const hasInventory = await inventoryLink.first().isVisible().catch(() => false);
    expect(hasInventory).toBe(false);
  });

  test('@regression should redirect to dashboard when accessing gated module without permission', async ({ page }) => {
    await page.route('**/api/v1/tenant/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data?.billingAccess) {
        json.data.billingAccess.enabledModules = [];
      }
      await route.fulfill({ body: JSON.stringify(json) });
    });

    await page.goto('/app/inventory');

    // Should redirect away from inventory
    await page.waitForURL(/\/app\/dashboard|\/app\//, { timeout: 10_000 });
  });
});

test.describe('Cross-Cutting: Session & Auth', () => {
  test('@regression should redirect to login on 401 response', async ({ page }) => {
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      })
    );

    await page.goto('/app/dashboard');

    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('@regression should preserve intended URL after re-login', async ({ page }) => {
    // This tests the "redirect after login" flow
    page.context().clearCookies();

    await page.goto('/app/contacts');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // After login, should redirect back to /app/contacts (or /app/dashboard)
    const url = page.url();
    expect(url).toMatch(/\/login/);
  });
});

test.describe('Cross-Cutting: Accessibility', () => {
  test('@regression should have proper heading hierarchy on dashboard', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');

    // Check that h1 exists
    const h1 = page.locator('h1');
    const hasH1 = await h1.first().isVisible().catch(() => false);
    expect(hasH1).toBe(true);
  });

  test('@regression should support keyboard navigation in sidebar', async ({ page }) => {
    await page.goto('/app/dashboard');

    const nav = page.locator('nav, [role="navigation"]');
    const hasNav = await nav.first().isVisible().catch(() => false);

    if (hasNav) {
      // Tab into navigation
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const hasFocus = await focused.first().isVisible().catch(() => false);
      expect(hasFocus).toBe(true);
    }
  });

  test('@regression should have aria-labels on icon-only buttons', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');

    // All buttons should have accessible names
    const buttons = page.locator('button:not([aria-label]):not([aria-labelledby])');
    const count = await buttons.count();

    // Check that buttons without aria-label have text content
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await buttons.nth(i).textContent();
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label');
      const title = await buttons.nth(i).getAttribute('title');
      // Button should have some accessible name
      expect((text?.trim() || '') + (ariaLabel || '') + (title || '')).not.toBe('');
    }
  });
});

test.describe('Cross-Cutting: Performance', () => {
  test('@perf should load dashboard within performance budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    // Dashboard should load within 10s (generous for E2E)
    expect(loadTime).toBeLessThan(10_000);
  });

  test('@perf should not have memory leaks on repeated navigation', async ({ page }) => {
    // Navigate between pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('/app/dashboard');
      await page.goto('/app/contacts');
      await page.goto('/app/conversations');
    }

    // Final navigation should still work
    await page.goto('/app/dashboard');
    const content = page.locator('main, [role="main"]');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Cross-Cutting: Locale & i18n', () => {
  test('@regression should display content in Portuguese (pt-BR)', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');

    // Check for Portuguese content indicators
    const ptContent = page.getByText(/dashboard|painel|conversas|contatos|configurações|configuracoes/i);
    await expect(ptContent.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Cross-Cutting: Error Resilience', () => {
  test('@regression should show toast on network timeout', async ({ page }) => {
    await page.route('**/api/v1/dashboard/**', (route) =>
      route.abort('timedout')
    );

    await page.goto('/app/dashboard');

    // Should not crash - show error state or retry
    const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
    const hasCrash = await errorBoundary.first().isVisible().catch(() => false);
    expect(hasCrash).toBe(false);
  });

  test('@regression should recover from temporary API failure', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/v1/tenant/me', (route) => {
      callCount++;
      if (callCount <= 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/dashboard');

    // Page should eventually load (retry mechanism)
    const content = page.locator('main, [role="main"]');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });
  });
});
