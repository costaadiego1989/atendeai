import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object with common functionality shared across all pages.
 */
export class BasePage {
  readonly page: Page;
  readonly mainContent: Locator;
  readonly errorBoundary: Locator;
  readonly loadingSpinner: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('main, [role="main"]');
    this.errorBoundary = page.locator('.error-boundary, [data-testid="error-boundary"]');
    this.loadingSpinner = page.locator('[data-testid="loading"], .animate-spin, [role="progressbar"]');
    this.toast = page.locator('[data-sonner-toast]');
  }

  async assertPageLoaded(timeout = 10_000) {
    await expect(this.mainContent.first()).toBeVisible({ timeout });
  }

  async assertNoCrash() {
    const crashed = await this.errorBoundary.first().isVisible().catch(() => false);
    expect(crashed).toBe(false);
  }

  async assertToastSuccess(timeout = 5_000) {
    const successToast = this.page.locator(
      '[data-sonner-toast][data-type="success"], [data-sonner-toast]:not([data-type="error"])'
    );
    await expect(successToast.first()).toBeVisible({ timeout });
  }

  async assertToastError(timeout = 5_000) {
    const errorToast = this.page.locator(
      '[data-sonner-toast][data-type="error"], [role="alert"]'
    );
    await expect(errorToast.first()).toBeVisible({ timeout });
  }

  async waitForLoading(timeout = 10_000) {
    await this.loadingSpinner.first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  async getHeading(level?: number): Promise<Locator> {
    if (level) {
      return this.page.locator(`h${level}`);
    }
    return this.page.locator('h1, h2, h3');
  }
}
