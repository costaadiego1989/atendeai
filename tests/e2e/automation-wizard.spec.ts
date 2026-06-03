import { test, expect } from '@playwright/test';

test.describe('Automation Wizard E2E Tests', () => {
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

  test('should navigate through wizard steps', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Verify step indicators
    await expect(page.locator('[data-testid="wizard-step-indicator-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="wizard-step-indicator-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="wizard-step-indicator-3"]')).toBeVisible();
    
    // Navigate to step 2
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await expect(page.locator('[data-testid="wizard-step-indicator-2"]')).toHaveClass(/active/);
    
    // Navigate to step 3
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await expect(page.locator('[data-testid="wizard-step-indicator-3"]')).toHaveClass(/active/);
    
    // Navigate back to step 1
    await page.click('[data-testid="wizard-prev-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await expect(page.locator('[data-testid="wizard-step-indicator-2"]')).toHaveClass(/active/);
  });

  test('should complete basic information step', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Fill basic information
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    await page.selectOption('[data-testid="automation-category-select"]', 'marketing');
    
    // Verify next button is enabled
    await expect(page.locator('[data-testid="wizard-next-button"]')).not.toBeDisabled();
    
    // Navigate to next step
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
  });

  test('should configure trigger in step 2', async ({ page }) => {
    // Start new automation and navigate to step 2
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    
    // Add trigger
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    
    // Configure trigger parameters
    await page.fill('[data-testid="trigger-condition-input"]', 'contact.tags.includes("new")');
    await page.fill('[data-testid="trigger-delay-input"]', '5');
    
    // Verify next button is enabled
    await expect(page.locator('[data-testid="wizard-next-button"]')).not.toBeDisabled();
    
    // Navigate to next step
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
  });

  test('should configure action in step 3', async ({ page }) => {
    // Start new automation and navigate to step 3
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    
    // Add action
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Send Welcome Message');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    
    // Configure action parameters
    await page.fill('[data-testid="action-template-input"]', 'Welcome! Thanks for joining us.');
    await page.fill('[data-testid="action-delay-input"]', '10');
    
    // Verify finish button is enabled
    await expect(page.locator('[data-testid="wizard-finish-button"]')).not.toBeDisabled();
  });

  test('should test automation before finishing', async ({ page }) => {
    // Complete automation setup
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation description');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Send Welcome Message');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.fill('[data-testid="action-template-input"]', 'Welcome! Thanks for joining us.');
    
    // Test automation
    await page.click('[data-testid="test-automation-button"]');
    await page.waitForSelector('[data-testid="test-results-dialog"]');
    
    // Verify test results
    await expect(page.locator('[data-testid="test-results-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-results-details"]')).toBeVisible();
    
    // Close test results and finish
    await page.click('[data-testid="close-test-results-button"]');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
  });

  test('should handle validation errors in wizard', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Try to navigate without required fields
    await page.click('[data-testid="wizard-next-button"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="automation-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-description-error"]')).toBeVisible();
    
    // Fill required fields
    await page.fill('[data-testid="automation-name-input"]', 'Valid Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Valid description');
    
    // Navigate to step 2
    await page.click('[data-testid="wizard-next-button"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    
    // Try to navigate without trigger
    await page.click('[data-testid="wizard-next-button"]');
    
    // Verify trigger validation error
    await expect(page.locator('[data-testid="trigger-validation-error"]')).toBeVisible();
    
    // Add trigger and continue
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Valid Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    
    // Try to navigate without action
    await page.click('[data-testid="wizard-finish-button"]');
    
    // Verify action validation error
    await expect(page.locator('[data-testid="action-validation-error"]')).toBeVisible();
  });

  test('should save automation as draft', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Fill partial information
    await page.fill('[data-testid="automation-name-input"]', 'Draft Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Draft description');
    
    // Save as draft
    await page.click('[data-testid="save-draft-button"]');
    await page.waitForSelector('[data-testid="draft-saved-toast"]');
    
    // Verify automation appears in drafts
    await expect(page.locator('[data-testid="draft-automation-card"]')).toBeVisible();
  });

  test('should load and edit draft automation', async ({ page }) => {
    // First save a draft
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Draft Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Draft description');
    await page.click('[data-testid="save-draft-button"]');
    await page.waitForSelector('[data-testid="draft-saved-toast"]');
    
    // Load draft
    await page.click('[data-testid="draft-automation-card"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Edit draft
    await page.fill('[data-testid="automation-name-input"]', 'Updated Draft Automation');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    // Verify automation is no longer in drafts
    await expect(page.locator('[data-testid="draft-automation-card"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="automation-card"]')).toContainText('Updated Draft Automation');
  });

  test('should cancel wizard without saving', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Fill some information
    await page.fill('[data-testid="automation-name-input"]', 'Cancelled Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Cancelled description');
    
    // Cancel wizard
    await page.click('[data-testid="cancel-wizard-button"]');
    await page.waitForSelector('[data-testid="cancel-confirmation-dialog"]');
    
    // Confirm cancellation
    await page.click('[data-testid="confirm-cancel-button"]');
    
    // Verify wizard is closed
    await expect(page.locator('[data-testid="automation-wizard"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="automations-page"]')).toBeVisible();
  });

  test('should display contextual help in wizard', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Click help button
    await page.click('[data-testid="wizard-help-button"]');
    await page.waitForSelector('[data-testid="wizard-help-dialog"]');
    
    // Verify help content
    await expect(page.locator('[data-testid="help-basic-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-triggers"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-actions"]')).toBeVisible();
    
    // Close help
    await page.click('[data-testid="close-help-button"]');
  });

  test('should handle template selection in wizard', async ({ page }) => {
    // Start new automation
    await page.click('[data-testid="create-automation-button"]');
    await page.waitForSelector('[data-testid="automation-wizard"]');
    
    // Select template
    await page.click('[data-testid="select-template-button"]');
    await page.waitForSelector('[data-testid="template-selection-dialog"]');
    
    // Choose welcome template
    await page.click('[data-testid="welcome-template-option"]');
    await page.click('[data-testid="use-template-button"]');
    
    // Verify template is applied
    await expect(page.locator('[data-testid="automation-name-input"]')).toHaveValue('Welcome Automation');
    await expect(page.locator('[data-testid="automation-description-input"]')).toHaveValue('Automatically welcome new contacts');
  });
});