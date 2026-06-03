import { test, expect } from '@playwright/test';

test.describe('Advanced Search E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to automations
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@atendeai.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    await page.click('[data-testid="automations-menu"]');
    await page.waitForSelector('[data-testid="automations-page"]');
  });

  test('should search by automation name', async ({ page }) => {
    const searchInput = page.locator('[data-testid="automation-search-input"]');
    
    // Search by partial name
    await searchInput.fill('Welcome');
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
    
    // Clear search
    await page.click('[data-testid="automation-search-clear"]');
    await expect(searchInput).toBeEmpty();
  });

  test('should search by automation description', async ({ page }) => {
    const searchInput = page.locator('[data-testid="automation-search-input"]');
    
    // Search by description keywords
    await searchInput.fill('new customer');
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should search by trigger type', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Filter by trigger type
    await page.selectOption('[data-testid="search-trigger-type"]', 'contact.new');
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should search by action type', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Filter by action type
    await page.selectOption('[data-testid="search-action-type"]', 'messaging.whatsapp');
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should search by status', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Filter by status
    await page.check('[data-testid="search-active-checkbox"]');
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should search by date range', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Set date range
    await page.fill('[data-testid="search-date-from"]', '2024-01-01');
    await page.fill('[data-testid="search-date-to"]', '2024-12-31');
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should combine multiple search criteria', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Combine multiple filters
    await page.fill('[data-testid="automation-name-input"]', 'Welcome');
    await page.selectOption('[data-testid="search-trigger-type"]', 'contact.new');
    await page.check('[data-testid="search-active-checkbox"]');
    await page.fill('[data-testid="search-date-from"]', '2024-01-01');
    
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should save and load search configurations', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Configure search
    await page.fill('[data-testid="automation-name-input"]', 'Test');
    await page.selectOption('[data-testid="search-trigger-type"]', 'contact.new');
    
    // Save search configuration
    await page.fill('[data-testid="save-search-name"]', 'Test Search');
    await page.click('[data-testid="save-search-button"]');
    
    // Verify saved search appears
    await expect(page.locator('[data-testid="saved-search-item"]')).toBeVisible();
    
    // Load saved search
    await page.click('[data-testid="saved-search-item"]');
    await page.click('[data-testid="apply-search-filters"]');
    
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should display search results count', async ({ page }) => {
    const searchInput = page.locator('[data-testid="automation-search-input"]');
    
    // Search and verify count
    await searchInput.fill('Welcome');
    await expect(page.locator('[data-testid="search-results-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-results-count"]')).toContainText('results');
  });

  test('should handle empty search results', async ({ page }) => {
    const searchInput = page.locator('[data-testid="automation-search-input"]');
    
    // Search for non-existent term
    await searchInput.fill('nonexistent123');
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-card"]')).not.toBeVisible();
  });

  test('should clear all search filters', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await page.waitForSelector('[data-testid="advanced-search-dialog"]');
    
    // Set multiple filters
    await page.fill('[data-testid="automation-name-input"]', 'Test');
    await page.selectOption('[data-testid="search-trigger-type"]', 'contact.new');
    await page.check('[data-testid="search-active-checkbox"]');
    
    // Clear all filters
    await page.click('[data-testid="clear-all-filters-button"]');
    
    // Verify all filters are cleared
    await expect(page.locator('[data-testid="automation-name-input"]')).toBeEmpty();
    await expect(page.locator('[data-testid="search-trigger-type"]')).toHaveValue('');
    await expect(page.locator('[data-testid="search-active-checkbox"]')).not.toBeChecked();
  });
});