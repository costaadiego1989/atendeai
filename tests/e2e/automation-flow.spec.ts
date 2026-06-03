import { test, expect } from '@playwright/test';

test.describe('Automation Flow Diagram E2E Tests', () => {
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

  test('should display automation flow diagram', async ({ page }) => {
    // Create a test automation first
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Flow Test Automation');
    await page.fill('[data-testid="automation-description-input"]', 'Test automation for flow diagram');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'New Contact');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Send Message');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    // View automation details
    await page.click('[data-testid="view-automation-button"]');
    await page.waitForSelector('[data-testid="automation-details-sheet"]');
    
    // Open flow diagram
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Verify diagram is displayed
    await expect(page.locator('[data-testid="flow-diagram-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="trigger-node"]')).toBeVisible();
    await expect(page.locator('[data-testid="action-node"]')).toBeVisible();
    await expect(page.locator('[data-testid="flow-connection"]')).toBeVisible();
  });

  test('should navigate flow diagram with keyboard', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Keyboard Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test keyboard navigation');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Test Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Test Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="trigger-node"]')).toBeFocused();
    
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="action-node"]')).toBeFocused();
    
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="flow-diagram-dialog"]')).not.toBeVisible();
  });

  test('should zoom flow diagram', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Zoom Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test zoom functionality');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Test Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Test Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Test zoom controls
    await page.click('[data-testid="zoom-in-button"]');
    await expect(page.locator('[data-testid="flow-diagram-canvas"]')).toHaveAttribute('data-zoom', '1.2');
    
    await page.click('[data-testid="zoom-out-button"]');
    await expect(page.locator('[data-testid="flow-diagram-canvas"]')).toHaveAttribute('data-zoom', '1.0');
    
    await page.click('[data-testid="zoom-reset-button"]');
    await expect(page.locator('[data-testid="flow-diagram-canvas"]')).toHaveAttribute('data-zoom', '1.0');
  });

  test('should pan flow diagram', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Pan Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test pan functionality');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Test Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Test Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Test pan functionality
    const canvas = page.locator('[data-testid="flow-diagram-canvas"]');
    await canvas.dragTo(canvas, { 
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 200, y: 200 }
    });
    
    // Verify canvas has been panned
    await expect(canvas).toHaveAttribute('data-pan-x', '100');
    await expect(canvas).toHaveAttribute('data-pan-y', '100');
  });

  test('should export flow diagram', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Export Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test export functionality');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Test Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Test Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Export diagram
    await page.click('[data-testid="export-diagram-button"]');
    await page.waitForSelector('[data-testid="export-format-dialog"]');
    
    // Select PNG format
    await page.click('[data-testid="export-png-option"]');
    await page.click('[data-testid="confirm-export-button"]');
    
    // Verify download started
    await expect(page.locator('[data-testid="export-download-toast"]')).toBeVisible();
  });

  test('should display node details on click', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Node Details Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test node details');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Test Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Test Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Click on trigger node
    await page.click('[data-testid="trigger-node"]');
    await expect(page.locator('[data-testid="node-details-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-details-name"]')).toHaveText('Test Trigger');
    await expect(page.locator('[data-testid="node-details-type"]')).toHaveText('Trigger');
    
    // Close node details
    await page.click('[data-testid="close-node-details"]');
    await expect(page.locator('[data-testid="node-details-panel"]')).not.toBeVisible();
  });

  test('should handle complex flow diagrams', async ({ page }) => {
    // Create automation with multiple triggers and actions
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Complex Flow Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test complex flow with multiple nodes');
    await page.click('[data-testid="wizard-next-button"]');
    
    // Add multiple triggers
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Trigger 1');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Trigger 2');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.update');
    
    await page.click('[data-testid="wizard-next-button"]');
    
    // Add multiple actions
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Action 1');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Action 2');
    await page.selectOption('[data-testid="action-type-select"]', 'email.send');
    
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    // View flow diagram
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Verify all nodes are displayed
    await expect(page.locator('[data-testid="trigger-node"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="action-node"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="flow-connection"]')).toHaveCount(4);
  });

  test('should handle conditional flows', async ({ page }) => {
    // Create automation with conditional logic
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Conditional Flow Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test conditional flow logic');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Conditional Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    
    // Add conditional branch
    await page.click('[data-testid="add-condition-button"]');
    await page.fill('[data-testid="condition-name-input"]', 'Check Contact Type');
    await page.fill('[data-testid="condition-expression-input"]', 'contact.type === "premium"');
    
    await page.click('[data-testid="wizard-next-button"]');
    
    // Add actions for different branches
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Premium Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Regular Action');
    await page.selectOption('[data-testid="action-type-select"]', 'email.send');
    
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    // View flow diagram
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Verify conditional nodes
    await expect(page.locator('[data-testid="condition-node"]')).toBeVisible();
    await expect(page.locator('[data-testid="branch-connection"]')).toHaveCount(2);
  });

  test('should display performance metrics for flow', async ({ page }) => {
    // Create and view automation with flow diagram
    await page.click('[data-testid="create-automation-button"]');
    await page.fill('[data-testid="automation-name-input"]', 'Performance Test');
    await page.fill('[data-testid="automation-description-input"]', 'Test performance metrics');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-trigger-button"]');
    await page.fill('[data-testid="trigger-name-input"]', 'Performance Trigger');
    await page.selectOption('[data-testid="trigger-type-select"]', 'contact.new');
    await page.click('[data-testid="wizard-next-button"]');
    
    await page.click('[data-testid="add-action-button"]');
    await page.fill('[data-testid="action-name-input"]', 'Performance Action');
    await page.selectOption('[data-testid="action-type-select"]', 'messaging.whatsapp');
    await page.click('[data-testid="wizard-finish-button"]');
    await page.waitForSelector('[data-testid="automation-created-toast"]');
    
    await page.click('[data-testid="view-automation-button"]');
    await page.click('[data-testid="flow-diagram-button"]');
    await page.waitForSelector('[data-testid="flow-diagram-dialog"]');
    
    // Show performance metrics
    await page.click('[data-testid="show-metrics-button"]');
    await expect(page.locator('[data-testid="performance-metrics-panel"]')).toBeVisible();
    
    // Verify metrics are displayed
    await expect(page.locator('[data-testid="execution-time-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-delay-metric"]')).toBeVisible();
  });
});