import { test as base, expect } from '@playwright/test';

const ADMIN_KEY = process.env.ADMIN_KEY || 'UeUf900@admin-atende-ai-2026';
const BASE_URL = 'http://localhost:8080';

export const test = base.extend({});

export { expect };

export const SCREENSHOTS_DIR = 'tests/e2e/screenshots';

export async function adminLogin(page: any) {
  // Set localStorage to simulate authenticated state
  await page.goto(`${BASE_URL}/admin`);
  await page.evaluate((key: string) => {
    localStorage.setItem('platform_admin_key', key);
  }, ADMIN_KEY);
}

export async function navigateAsAdmin(page: any, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  // Check if redirected to login (not authenticated)
  if (page.url().endsWith('/admin') && path !== '/admin') {
    // Set key and retry
    await page.evaluate((key: string) => {
      localStorage.setItem('platform_admin_key', key);
    }, ADMIN_KEY);
    await page.goto(`${BASE_URL}${path}`);
  }
  await page.waitForLoadState('networkidle');
}

export async function takeScreenshot(page: any, name: string) {
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/${name}.png`, fullPage: true });
}

export async function testPeriodSelector(page: any) {
  const periods = ['1d', '7d', '30d', '90d'];
  for (const p of periods) {
    const btn = page.locator(`button:has-text("${p}")`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }
}

export async function testPagination(page: any) {
  const nextBtn = page.locator('button:has-text("Próx"), button:has-text("Next"), button:has-text("›"), button:has-text("»")').first();
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }
  const prevBtn = page.locator('button:has-text("Anterior"), button:has-text("Prev"), button:has-text("‹"), button:has-text("«")').first();
  if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    if (await prevBtn.isEnabled()) {
      await prevBtn.click();
      await page.waitForTimeout(500);
    }
  }
}
