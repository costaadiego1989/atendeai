import { test, expect } from '@playwright/test';

test.describe('Automations Module E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login to the application
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@atendeai.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Navigate to automations page
    await page.click('[data-testid="automations-menu"]');
    await page.waitForSelector('[data-testid="automations-page"]');
  });

  test('should display automations list with search functionality', async ({ page }) => {
    // Verify automations page is loaded
    await expect(page.locator('[data-testid="automations-page"]')).toBeVisible();
    
    // Verify search input is present
    const searchInput = page.locator('[data-testid="automation-search-input"]');
    await expect(searchInput).toBeVisible();
    
    // Verify automation cards are displayed
    const automationCards = page.locator('[data-testid="automation-card"]');
    await expect(automationCards.first()).toBeVisible();
    
    // Test search functionality
    await searchInput.fill('Welcome');
    await expect(automationCards.first()).toBeVisible();
    
    // Test clear search
    await searchInput.fill('');
    await expect(page.locator('[data-testid="automation-search-clear"]')).toBeVisible();
  });

  test('should create new automation using wizard', async ({ page }) => {
    // Click create automation button
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Verify wizard steps
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="wizard-step-2"]')).toBeVisible();
    
    // Step 1: Basic information
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    
    // Navigate to step 2
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    
    // Step 2: Trigger configuration
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    
    // Navigate to step 3
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    
    // Step 3: Action configuration
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Send Welcome Message');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    
    // Complete wizard
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    // Verify automation appears in list
    await expect(page.locator('[data-testid="automation-card"]')).toContainText('Test Automation');
  });

  test('should edit existing automation', async ({ page }) => {
    // Find first automation card
    const firstCard = page.locator('[data-testid="automation-card"]').first();
    await firstCard.waitFor();
    
    // Click edit button
    await firstCard.click('[data-testid="edit-automation-button"]');
    await page.waitForSelector('[data-testid="automation-form-sheet"]');
    
    // Update automation name
    await page.fill('[data-testid="automation-name-input"]', 'Updated Automation Name');
    
    // Save changes
    await page.click('[data-testid="save-automation-button"]');
    await page.waitForSelector('[data-testid="automation-updated-toast"]');
    
    // Verify changes are reflected
    await expect(firstCard).toContainText('Updated Automation Name');
  });

  test('should delete automation', async ({ page }) => {
    // Find first automation card
    const firstCard = page.locator('[data-testid="automation-card"]').first();
    await firstCard.waitFor();
    
    const automationName = await firstCard.textContent();
    
    // Click delete button
    await firstCard.click('[data-testid="delete-automation-button"]');
    await page.waitForSelector('[data-testid="delete-confirmation-dialog"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    await page.waitForSelector('[data-testid="automation-deleted-toast"]');
    
    // Verify automation is removed from list
    await expect(page.locator('[data-testid="automation-card"]')).not.toContainText(automationName || '');
  });

  test('should view automation details', async ({ page }) => {
    // Find first automation card
    const firstCard = page.locator('[data-testid="automation-card"]').first();
    await firstCard.waitFor();
    
    // Click view details button
    await firstCard.click('[data-testid="view-automation-button"]');
    await page.waitForSelector('[data-testid="automation-details-sheet"]');
    
    // Verify details are displayed
    await expect(page.locator('[data-testid="automation-details-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-details-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-details-triggers"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-details-actions"]')).toBeVisible();
  });

  test('should test automation before saving', async ({ page }) => {
    // Click create automation button
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Configure basic automation
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    
    // Add trigger
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    
    // Add action
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Send Welcome Message');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    
    // Test automation
    await page.click('[data-testid="test-automation-button"]');
    await page.waitForSelector('[data-testid="test-results-dialog"]');
    
    // Verify test results
    await expect(page.locator('[data-testid="test-results-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-results-details"]')).toBeVisible();
    
    // Close test results
    await page.click('[data-testid="close-test-results-button"]');
  });

  test('should handle validation errors in form', async ({ page }) => {
    // Click create automation button
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Try to save without required fields
    await page.click('[data-testid="wizard-finish-button"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="automation-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-description-error"]')).toBeVisible();
    
    // Fill required fields
    await page.fill('[data-testid="automation-name-input"]', 'Valid Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Valid description');
    
    // Save should now work
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
  });

  test('should export automation configuration', async ({ page }) => {
    // Find first automation card
    const firstCard = page.locator('[data-testid="automation-card"]').first();
    await firstCard.waitFor();
    
    // Click export button
    await firstCard.click('[data-testid="export-automation-button"]');
    await page.waitForSelector('[data-testid="export-dialog"]');
    
    // Select export format
    await page.selectOption('[data-testid="export-format-select"]', 'json');
    
    // Download export
    await page.click('[data-testid="download-export-button"]');
    
    // Verify download started
    await expect(page.locator('[data-testid="export-download-toast"]')).toBeVisible();
  });

  test('should import automation configuration', async ({ page }) => {
    // Click import button
    await page.click('[data-testid="import-automation-button"]');
    await page.waitForSelector('[data-testid="import-dialog"]');
    
    // Upload file (mock file upload)
    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles('tests/fixtures/sample-automation.json');
    
    // Import automation
    await page.click('[data-testid="import-automation-confirm-button"]');
    await page.waitForSelector('[data-testid="automation-imported-toast"]');
    
    // Verify imported automation appears in list
    await expect(page.locator('[data-testid="automation-card"]')).toContainText('Imported Automation');
  });

  test('should display loading states', async ({ page }) => {
    // Mock API delay
    await page.route('**/api/automations', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    // Navigate to automations page
    await page.click('[data-testid="automations-menu"]');
    
    // Verify loading spinner
    await expect(page.locator('[data-testid="automations-loading"]')).toBeVisible();
    
    // Wait for data to load
    await expect(page.locator('[data-testid="automation-card"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/automations', async (route) => {
      await route.abort('failed');
    });
    
    // Navigate to automations page
    await page.click('[data-testid="automations-menu"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="automations-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Retry should work
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="automations-loading"]')).toBeVisible();
  });

  test('should display accessibility features', async ({ page }) => {
    // Verify keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="automation-search-input"]')).toBeFocused();
    
    // Verify screen reader announcements
    await page.fill('[data-testid="automation-search-input"]', 'test');
    await expect(page.locator('[data-testid="search-results-count"]')).toBeVisible();
    
    // Verify high contrast mode support
    await page.click('[data-testid="accessibility-toggle"]');
    await expect(page.locator('[data-testid="high-contrast-mode"]')).toBeVisible();
  });

  test('should display performance metrics', async ({ page }) => {
    // Navigate to automations page
    await page.click('[data-testid="automations-menu"]');
    
    // Click metrics button
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dialog"]');
    
    // Verify metrics are displayed
    await expect(page.locator('[data-testid="automation-metrics-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-metrics-stats"]')).toBeVisible();
    
    // Verify export metrics functionality
    await page.click('[data-testid="export-metrics-button"]');
    await expect(page.locator('[data-testid="metrics-export-toast"]')).toBeVisible();
  });

  test('should display help and documentation', async ({ page }) => {
    // Click help button
    await page.click('[data-testid="automation-help-button"]');
    await page.waitForSelector('[data-testid="automation-help-dialog"]');
    
    // Verify help content
    await expect(page.locator('[data-testid="help-getting-started"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-examples"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-api-reference"]')).toBeVisible();
    
    // Verify video tutorial link
    await expect(page.locator('[data-testid="video-tutorial-link"]')).toBeVisible();
    
    // Close help
    await page.click('[data-testid="close-help-button"]');
  });
});