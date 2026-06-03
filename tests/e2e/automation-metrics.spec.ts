import { test, expect } from '@playwright/test';

test.describe('Automation Metrics E2E Tests', () => {
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

  test('should display automation metrics dashboard', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Verify main metrics are displayed
    await expect(page.locator('[data-testid="total-automations-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-automations-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-execution-time-metric"]')).toBeVisible();
    
    // Verify charts are visible
    await expect(page.locator('[data-testid="execution-trend-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-performance-chart"]')).toBeVisible();
  });

  test('should filter metrics by time range', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Test different time ranges
    const timeRanges = ['7d', '30d', '90d', '1y'];
    
    for (const range of timeRanges) {
      await page.click(`[data-testid="time-range-${range}"]`);
      await expect(page.locator('[data-testid="time-range-indicator"]')).toHaveText(range);
      
      // Verify charts update
      await expect(page.locator('[data-testid="execution-trend-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-rate-chart"]')).toBeVisible();
    }
  });

  test('should filter metrics by automation status', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Test status filters
    await page.click('[data-testid="status-active-filter"]');
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).toBeVisible();
    
    await page.click('[data-testid="status-paused-filter"]');
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).toBeVisible();
    
    await page.click('[data-testid="status-error-filter"]');
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).toBeVisible();
    
    // Test multiple filters
    await page.click('[data-testid="status-active-filter"]');
    await page.click('[data-testid="status-paused-filter"]');
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).toBeVisible();
  });

  test('should export metrics data', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Export as CSV
    await page.click('[data-testid="export-csv-button"]');
    await expect(page.locator('[data-testid="export-download-toast"]')).toBeVisible();
    
    // Export as JSON
    await page.click('[data-testid="export-json-button"]');
    await expect(page.locator('[data-testid="export-download-toast"]')).toBeVisible();
    
    // Export as PDF
    await page.click('[data-testid="export-pdf-button"]');
    await expect(page.locator('[data-testid="export-download-toast"]')).toBeVisible();
  });

  test('should display detailed execution logs', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on execution logs tab
    await page.click('[data-testid="execution-logs-tab"]');
    await expect(page.locator('[data-testid="execution-logs-table"]')).toBeVisible();
    
    // Verify log entries are displayed
    await expect(page.locator('[data-testid="log-entry"]')).toBeVisible();
    
    // Test log filtering
    await page.fill('[data-testid="log-search-input"]', 'success');
    await expect(page.locator('[data-testid="log-entry"]')).toBeVisible();
    
    // Test log sorting
    await page.click('[data-testid="sort-timestamp-button"]');
    await expect(page.locator('[data-testid="execution-logs-table"]')).toBeVisible();
  });

  test('should display error analysis', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on error analysis tab
    await page.click('[data-testid="error-analysis-tab"]');
    await expect(page.locator('[data-testid="error-analysis-chart"]')).toBeVisible();
    
    // Verify error categories are displayed
    await expect(page.locator('[data-testid="error-category-trigger"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-category-action"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-category-connection"]')).toBeVisible();
    
    // Test error filtering
    await page.click('[data-testid="filter-trigger-errors"]');
    await expect(page.locator('[data-testid="error-analysis-chart"]')).toBeVisible();
  });

  test('should display performance insights', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on performance insights tab
    await page.click('[data-testid="performance-insights-tab"]');
    await expect(page.locator('[data-testid="performance-insights-list"]')).toBeVisible();
    
    // Verify insights are displayed
    await expect(page.locator('[data-testid="performance-insight-item"]')).toBeVisible();
    
    // Test insights filtering
    await page.click('[data-testid="filter-optimization-insights"]');
    await expect(page.locator('[data-testid="performance-insights-list"]')).toBeVisible();
  });

  test('should display automation comparison', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on comparison tab
    await page.click('[data-testid="comparison-tab"]');
    await expect(page.locator('[data-testid="automation-comparison-chart"]')).toBeVisible();
    
    // Verify comparison metrics are displayed
    await expect(page.locator('[data-testid="comparison-metric-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-metric-execution-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-metric-trigger-rate"]')).toBeVisible();
  });

  test('should display real-time metrics', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Enable real-time mode
    await page.click('[data-testid="real-time-toggle"]');
    await expect(page.locator('[data-testid="real-time-indicator"]')).toBeVisible();
    
    // Verify real-time updates
    await expect(page.locator('[data-testid="live-execution-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="live-success-rate"]')).toBeVisible();
  });

  test('should display automation health score', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Verify health score is displayed
    await expect(page.locator('[data-testid="health-score-meter"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-score-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-score-status"]')).toBeVisible();
    
    // Test health score breakdown
    await expect(page.locator('[data-testid="health-score-breakdown"]')).toBeVisible();
  });

  test('should display cost analysis', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on cost analysis tab
    await page.click('[data-testid="cost-analysis-tab"]');
    await expect(page.locator('[data-testid="cost-analysis-chart"]')).toBeVisible();
    
    // Verify cost metrics are displayed
    await expect(page.locator('[data-testid="total-cost-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-per-execution-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-trend-metric"]')).toBeVisible();
  });

  test('should display predictive analytics', async ({ page }) => {
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    await page.waitForSelector('[data-testid="automation-metrics-dashboard"]');
    
    // Click on predictive analytics tab
    await page.click('[data-testid="predictive-analytics-tab"]');
    await expect(page.locator('[data-testid="predictive-chart"]')).toBeVisible();
    
    // Verify predictions are displayed
    await expect(page.locator('[data-testid="prediction-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-execution-volume"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-error-trend"]')).toBeVisible();
  });

  test('should handle loading states for metrics', async ({ page }) => {
    // Mock API delay
    await page.route('**/api/automations/metrics', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    
    // Verify loading state
    await expect(page.locator('[data-testid="metrics-loading-spinner"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).not.toBeVisible();
    
    // Wait for data to load
    await expect(page.locator('[data-testid="automation-metrics-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="metrics-loading-spinner"]')).not.toBeVisible();
  });

  test('should handle error states for metrics', async ({ page }) => {
    // Mock API error
    await page.route('**/api/automations/metrics', async (route) => {
      await route.abort('failed');
    });
    
    // Navigate to metrics dashboard
    await page.click('[data-testid="automation-metrics-button"]');
    
    // Verify error state
    await expect(page.locator('[data-testid="metrics-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-metrics-button"]')).toBeVisible();
    
    // Retry should work
    await page.click('[data-testid="retry-metrics-button"]');
    await expect(page.locator('[data-testid="metrics-loading-spinner"]')).toBeVisible();
  });
});