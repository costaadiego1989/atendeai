import { Page, expect } from '@playwright/test';

/**
 * Shared test utilities for AtendeAi E2E tests.
 */

/**
 * Wait for page to be fully loaded (no pending network requests).
 */
export async function waitForPageReady(page: Page, timeout = 10_000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Check if an element is visible without throwing.
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

/**
 * Check if page has crashed (error boundary visible).
 */
export async function hasPageCrashed(page: Page): Promise<boolean> {
  const errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
  return errorBoundary.first().isVisible().catch(() => false);
}

/**
 * Assert page did not crash.
 */
export async function assertNoCrash(page: Page) {
  const crashed = await hasPageCrashed(page);
  expect(crashed).toBe(false);
}

/**
 * Assert a toast notification appeared.
 */
export async function assertToastVisible(
  page: Page,
  type: 'success' | 'error' | 'info' = 'success',
  timeout = 5_000,
) {
  const toastSelector = type === 'error'
    ? '[data-sonner-toast][data-type="error"], [role="alert"]'
    : type === 'success'
      ? '[data-sonner-toast][data-type="success"], [data-sonner-toast]:not([data-type="error"])'
      : '[data-sonner-toast]';

  const toast = page.locator(toastSelector);
  await expect(toast.first()).toBeVisible({ timeout });
}

/**
 * Assert validation errors are visible on the page.
 */
export async function assertValidationErrors(page: Page, timeout = 5_000) {
  const errors = page.locator('[role="alert"], .text-destructive, [data-error], .error-message');
  await expect(errors.first()).toBeVisible({ timeout });
}

/**
 * Fill a form field by label (case-insensitive regex).
 */
export async function fillByLabel(page: Page, labelPattern: RegExp, value: string) {
  const input = page.getByLabel(labelPattern);
  await input.first().fill(value);
}

/**
 * Click a button by name (case-insensitive regex).
 */
export async function clickButton(page: Page, namePattern: RegExp) {
  const button = page.getByRole('button', { name: namePattern });
  await button.first().click();
}

/**
 * Assert button is disabled.
 */
export async function assertButtonDisabled(page: Page, namePattern: RegExp) {
  const button = page.getByRole('button', { name: namePattern });
  await expect(button.first()).toBeDisabled();
}

/**
 * Assert button is enabled.
 */
export async function assertButtonEnabled(page: Page, namePattern: RegExp) {
  const button = page.getByRole('button', { name: namePattern });
  await expect(button.first()).toBeEnabled();
}

/**
 * Check viewport responsiveness.
 */
export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 });
}

export async function setTabletViewport(page: Page) {
  await page.setViewportSize({ width: 768, height: 1024 });
}

export async function setDesktopViewport(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}

/**
 * Generate a unique email for test isolation.
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}+${timestamp}${random}@atendeai-test.com`;
}

/**
 * Generate a strong test password.
 */
export function generateTestPassword(): string {
  return `Test@${Date.now().toString(36)}!`;
}

/**
 * Wait for navigation to complete after an action.
 */
export async function waitForNavigation(page: Page, urlPattern: RegExp, timeout = 10_000) {
  await page.waitForURL(urlPattern, { timeout });
}

/**
 * Clear all auth state (cookies + localStorage).
 */
export async function clearAuthState(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Assert that a list or empty state is visible.
 */
export async function assertListOrEmptyState(
  page: Page,
  listSelector: string,
  emptyTextPattern: RegExp,
) {
  const list = page.locator(listSelector);
  const emptyState = page.getByText(emptyTextPattern);

  const hasList = await list.first().isVisible().catch(() => false);
  const hasEmpty = await emptyState.first().isVisible().catch(() => false);

  expect(hasList || hasEmpty).toBe(true);
}

/**
 * Assert form dialog opened after clicking a button.
 */
export async function assertFormOpened(page: Page, timeout = 5_000) {
  const form = page.locator('form, [role="dialog"]');
  await expect(form.first()).toBeVisible({ timeout });
}
