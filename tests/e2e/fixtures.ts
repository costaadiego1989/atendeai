import { test as base, Page, BrowserContext, Browser } from '@playwright/test';

export type TestFixtures = {
  login: (email: string, password: string) => Promise<void>;
  createAutomation: (automationData: any) => Promise<void>;
  navigateToAutomations: () => Promise<void>;
  waitForPageLoad: (page: Page) => Promise<void>;
};

export const test = base.extend<TestFixtures>({
  login: async ({ page }, use) => {
    const login = async (email: string, password: string) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', email);
      await page.fill('[data-testid="password-input"]', password);
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="dashboard-container"]');
    };
    
    await use(login);
  },

  createAutomation: async ({ page }, use) => {
    const createAutomation = async (automationData: any) => {
      // Navigate to automations
      await page.click('[data-testid="automations-menu"]');
      await page.waitForSelector('[data-testid="automations-page"]');
      
      // Click create automation button
      await page.click('[data-testid="create-automation-button"]');
      await page.waitForSelector('[data-testid="automation-wizard"]');
      
      // Step 1: Basic information
      await page.fill('[data-testid="automation-name-input"]', automationData.name);
      await page.fill('[data-testid="automation-description-input"]', automationData.description);
      
      // Navigate to step 2
      await page.click('[data-testid="wizard-next-button"]');
      await page.waitForSelector('[data-testid="wizard-step-2"]');
      
      // Step 2: Trigger configuration
      await page.click('[data-testid="add-trigger-button"]');
      await page.fill('[data-testid="trigger-name-input"]', automationData.trigger.name);
      await page.selectOption('[data-testid="trigger-type-select"]', automationData.trigger.type);
      
      // Navigate to step 3
      await page.click('[data-testid="wizard-next-button"]');
      await page.waitForSelector('[data-testid="wizard-step-3"]');
      
      // Step 3: Action configuration
      await page.click('[data-testid="add-action-button"]');
      await page.fill('[data-testid="action-name-input"]', automationData.action.name);
      await page.selectOption('[data-testid="action-type-select"]', automationData.action.type);
      
      // Complete wizard
      await page.click('[data-testid="wizard-finish-button"]');
      await page.waitForSelector('[data-testid="automation-created-toast"]');
    };
    
    await use(createAutomation);
  },

  navigateToAutomations: async ({ page }, use) => {
    const navigateToAutomations = async () => {
      await page.click('[data-testid="automations-menu"]');
      await page.waitForSelector('[data-testid="automations-page"]');
    };
    
    await use(navigateToAutomations);
  },

  waitForPageLoad: async ({ page }, use) => {
    const waitForPageLoad = async (page: Page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="automations-page"]');
    };
    
    await use(waitForPageLoad);
  },

  page: async ({}, use) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });
    
    const page = await context.newPage();
    await use(page);
    
    await page.close();
    await context.close();
  },

  browserContext: async ({}, use) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });
    await use(context);
  },

  browser: async ({}, use) => {
    const browser = await chromium.launch();
    await use(browser);
    await browser.close();
  },
});

export { expect };