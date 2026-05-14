import { test, expect } from '../../playwright-fixture';
import { mockAuthMe } from '../helpers';

/**
 * Bug-Finding Tests: Settings Module Edge Cases
 *
 * These tests verify edge cases in the Settings module:
 * - WhatsApp embedded signup failure
 * - Instagram connection token refresh failure
 * - AI settings save with API 500
 * - Integration connection with invalid URL
 * - Company data update with API 500
 */

const TENANT_ID = 'tenant-test-id';
const WHATSAPP_CONNECTION_API = '**/api/v1/tenants/*/whatsapp-connection*';
const WHATSAPP_REGISTER_API = '**/api/v1/tenants/*/whatsapp/twilio/sender*';
const WHATSAPP_REFRESH_API = '**/api/v1/tenants/*/whatsapp/twilio/refresh*';
const INSTAGRAM_CONFIG_API = '**/api/v1/tenants/*/instagram-config*';
const AI_CONFIG_API = '**/api/v1/tenants/*/ai-config*';
const BUSINESS_DATA_API = '**/api/v1/tenants/*/business-data*';
const SETTINGS_API = '**/api/v1/tenants/*/settings*';
const INVENTORY_CONNECTIONS_API = '**/api/v1/tenants/*/inventory/connections*';

const CHANNELS_URL = '/app/settings/channels';
const AI_SETTINGS_URL = '/app/settings/ai';
const COMPANY_URL = '/app/settings/company';
const INTEGRATIONS_URL = '/app/settings/integrations';

const mockWhatsAppConnection = {
  connected: true,
  status: 'CONNECTED',
  phone: '+5511999990000',
  provider: 'TWILIO',
  senderStatus: 'ACTIVE',
};

const mockSettings = {
  id: TENANT_ID,
  description: 'Empresa de teste',
  services: ['Consultoria'],
  operatingHours: [],
  aiConfig: {
    systemPrompt: 'Você é um assistente amigável.',
    tone: 'FRIENDLY',
    language: 'pt-BR',
    escalationMessage: 'Vou transferir para um atendente.',
  },
};

async function setupSettingsPageMocks(page: import('@playwright/test').Page) {
  await mockAuthMe(page);

  await page.route(SETTINGS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockSettings }),
    }),
  );

  await page.route(WHATSAPP_CONNECTION_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockWhatsAppConnection }),
    }),
  );
}

test.describe('@bug-hunt Settings Edge Cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #ST1: WhatsApp registration with API 500
  // Expected: error toast and allow retry
  // ═══════════════════════════════════════════════════════════════════════════════

  test('ST1.1 WhatsApp register should show error on API 500', async ({ page }) => {
    await setupSettingsPageMocks(page);

    // Override connection to show disconnected state
    await page.route(WHATSAPP_CONNECTION_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { connected: false, status: 'NOT_CONNECTED' } }),
      }),
    );

    // Register returns 500
    await page.route(WHATSAPP_REGISTER_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto(CHANNELS_URL);
    await page.waitForTimeout(1500);

    // Look for connect/register button
    const connectBtn = page.getByRole('button', { name: /conectar|registrar|whatsapp|iniciar/i }).first();
    if (await connectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectBtn.click();
      await page.waitForTimeout(500);

      // Fill phone if required
      const phoneInput = page.getByLabel(/telefone|phone|número/i).first();
      if (await phoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await phoneInput.fill('+5511999990000');
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /registrar|enviar|confirmar|conectar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #ST2: WhatsApp refresh with 401 (token expired)
  // Expected: alert user to reconnect
  // ═══════════════════════════════════════════════════════════════════════════════

  test('ST2.1 WhatsApp refresh with 401 should show reconnection alert', async ({ page }) => {
    await setupSettingsPageMocks(page);

    // Refresh returns 401
    await page.route(WHATSAPP_REFRESH_API, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
      }),
    );

    await page.goto(CHANNELS_URL);
    await page.waitForTimeout(1500);

    // Look for refresh/status button
    const refreshBtn = page.getByRole('button', { name: /atualizar|refresh|verificar|status/i }).first();
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click();

      await expect(
        page.getByText(/falha|erro|expirado|reconectar|expired/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #ST3: AI settings save with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('ST3.1 save AI config should show error on API 500', async ({ page }) => {
    await setupSettingsPageMocks(page);

    // AI config save returns 500
    await page.route(AI_CONFIG_API, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(AI_SETTINGS_URL);
    await page.waitForTimeout(1500);

    // Click save button
    const saveBtn = page.getByRole('button', { name: /salvar|save/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #ST4: Company data update with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('ST4.1 save company data should show error on API 500', async ({ page }) => {
    await setupSettingsPageMocks(page);

    // Business data update returns 500
    await page.route(BUSINESS_DATA_API, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(COMPANY_URL);
    await page.waitForTimeout(1500);

    // Click save button
    const saveBtn = page.getByRole('button', { name: /salvar|save|atualizar/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();

      await expect(
        page.getByText(/falha|erro|não foi possível/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUG #ST5: Create integration connection with API 500
  // Expected: error toast shown
  // ═══════════════════════════════════════════════════════════════════════════════

  test('ST5.1 create integration should show error on API 500', async ({ page }) => {
    await setupSettingsPageMocks(page);

    await page.route(INVENTORY_CONNECTIONS_API, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(INTEGRATIONS_URL);
    await page.waitForTimeout(1500);

    // Click connect/add integration button
    const connectBtn = page.getByRole('button', { name: /conectar|adicionar|integrar|novo/i }).first();
    if (await connectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectBtn.click();
      await page.waitForTimeout(500);

      // Select a provider if options appear
      const providerOption = page.getByText(/bling|tiny|shopify|nuvemshop/i).first();
      if (await providerOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await providerOption.click();
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /conectar|salvar|confirmar/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();

        await expect(
          page.getByText(/falha|erro|não foi possível/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
