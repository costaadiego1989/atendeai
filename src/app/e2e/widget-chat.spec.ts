/**
 * Playwright E2E tests for the AtendeAI Chat Widget SDK.
 *
 * Uses page.route() to mock all API calls — no real backend or Redis required.
 * Runs under the 'bug-hunting' Playwright project (no auth state).
 *
 * Each test builds a minimal HTML page with the compiled widget SDK embedded,
 * then exercises the full UX flow via browser interactions.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

const PUBLIC_TOKEN = 'test-widget-token-e2e';
const SESSION_ID = 'session-e2e-001';
const VISITOR_ID_KEY = 'atendeai_visitor_id';
const SESSION_KEY = `atendeai_session_${PUBLIC_TOKEN}`;

const WIDGET_CONFIG = {
  id: 'cfg-001',
  name: 'Suporte AtendeAI',
  greeting: 'Olá! Como posso ajudar?',
  color: '#007bff',
  position: 'bottom-right',
  avatarUrl: null,
  collectName: false,
  collectPhone: false,
  proactiveDelay: null,
  proactiveMsg: null,
};

const AI_REPLY = {
  id: 'msg-ai-001',
  direction: 'OUTBOUND',
  contentType: 'TEXT',
  content: { text: 'Olá! Sou o assistente virtual. Em que posso ajudar?' },
  sentBy: 'AI',
  createdAt: new Date().toISOString(),
};

async function mockWidgetAPIs(
  page: Page,
  options: {
    sessionResumed?: boolean;
    messagesOnFirstCall?: any[];
    messagesOnSecondCall?: any[];
    sessionId?: string;
  } = {},
) {
  const sid = options.sessionId ?? SESSION_ID;

  await page.route(`**/widget/${PUBLIC_TOKEN}/config`, (route) => {
    route.fulfill({ json: WIDGET_CONFIG });
  });

  await page.route(`**/widget/${PUBLIC_TOKEN}/sessions`, (route) => {
    route.fulfill({
      json: {
        sessionId: sid,
        conversationId: 'conv-e2e-001',
        resumed: options.sessionResumed ?? false,
      },
      status: 201,
    });
  });

  await page.route(`**/widget/${PUBLIC_TOKEN}/messages`, (route) => {
    route.fulfill({
      json: {
        messageId: 'msg-inbound-001',
        conversationId: 'conv-e2e-001',
        contactId: 'contact-e2e-001',
      },
      status: 201,
    });
  });

  let getMessagesCallCount = 0;
  await page.route(`**/widget/${PUBLIC_TOKEN}/sessions/${sid}/messages`, (route) => {
    getMessagesCallCount++;
    const first = options.messagesOnFirstCall ?? [];
    const second = options.messagesOnSecondCall ?? [AI_REPLY];
    route.fulfill({
      json: { messages: getMessagesCallCount === 1 ? first : second },
    });
  });

  await page.route(`**/widget/${PUBLIC_TOKEN}/sessions/${sid}`, (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { success: true } });
    } else {
      route.continue();
    }
  });
}

async function loadWidgetPage(page: Page) {
  const sdkPath = path.resolve(
    __dirname,
    '../../widget/dist/sdk.js',
  );

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><title>Widget Test</title></head>
    <body>
      <h1>Página de Teste</h1>
      <script src="file://${sdkPath.replace(/\\/g, '/')}"></script>
      <script>
        atendeai('init', {
          token: '${PUBLIC_TOKEN}',
          baseUrl: window.location.origin,
        });
      </script>
    </body>
    </html>
  `);
}

test.describe('Widget Chat — UX Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('widget renders greeting from config', async ({ page }) => {
    await mockWidgetAPIs(page);
    await loadWidgetPage(page);

    // FAB button should be visible
    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await expect(fab).toBeVisible({ timeout: 5000 });

    // Open widget
    await fab.click();

    // Greeting should appear
    const messages = page.locator('#atendeai-widget-root').locator('pierce/#aw-messages');
    await expect(messages).toContainText('Olá! Como posso ajudar?');
  });

  test('visitor sends message and optimistic bubble appears', async ({ page }) => {
    await mockWidgetAPIs(page);
    await loadWidgetPage(page);

    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await fab.click();

    const input = page.locator('#atendeai-widget-root').locator('pierce/.aw-input');
    await input.fill('Quero saber o preço');
    await input.press('Enter');

    // Optimistic bubble should appear immediately
    const userBubbles = page.locator('#atendeai-widget-root').locator('pierce/.aw-msg-user');
    await expect(userBubbles.first()).toBeVisible({ timeout: 2000 });
    await expect(userBubbles.first()).toContainText('Quero saber o preço');
  });

  test('AI reply appears after polling', async ({ page }) => {
    await mockWidgetAPIs(page, {
      messagesOnFirstCall: [],
      messagesOnSecondCall: [
        {
          id: 'inbound-001',
          direction: 'INBOUND',
          contentType: 'TEXT',
          content: { text: 'Quero saber o preço' },
          sentBy: 'CONTACT',
          createdAt: new Date().toISOString(),
        },
        AI_REPLY,
      ],
    });
    await loadWidgetPage(page);

    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await fab.click();

    const input = page.locator('#atendeai-widget-root').locator('pierce/.aw-input');
    await input.fill('Quero saber o preço');
    await input.press('Enter');

    // Wait for polling to fetch AI reply (up to 10s — polling interval is 1.5s)
    const botBubbles = page.locator('#atendeai-widget-root').locator('pierce/.aw-msg-bot');
    await expect(botBubbles.last()).toContainText(
      'Olá! Sou o assistente virtual',
      { timeout: 10000 },
    );
  });

  test('session persists across page reload — messages load on resume', async ({
    page,
  }) => {
    const existingMessages = [
      {
        id: 'msg-prev-001',
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { text: 'Mensagem anterior' },
        sentBy: 'CONTACT',
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'msg-prev-002',
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: { text: 'Resposta anterior da IA' },
        sentBy: 'AI',
        createdAt: new Date(Date.now() - 55000).toISOString(),
      },
    ];

    // Simulate stored session in localStorage before page load
    await page.addInitScript(
      ([key, sid]) => {
        localStorage.setItem(key, sid);
      },
      [SESSION_KEY, SESSION_ID],
    );

    await mockWidgetAPIs(page, {
      sessionResumed: true,
      messagesOnFirstCall: existingMessages,
      messagesOnSecondCall: existingMessages,
    });
    await loadWidgetPage(page);

    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await fab.click();

    const messages = page.locator('#atendeai-widget-root').locator('pierce/#aw-messages');
    await expect(messages).toContainText('Mensagem anterior', { timeout: 5000 });
    await expect(messages).toContainText('Resposta anterior da IA');
  });

  test('restart button clears chat and shows fresh greeting', async ({ page }) => {
    const priorMessages = [
      {
        id: 'msg-before-restart',
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { text: 'Mensagem antes do restart' },
        sentBy: 'CONTACT',
        createdAt: new Date().toISOString(),
      },
    ];

    // First session with messages
    let getCallCount = 0;
    await page.route(`**/widget/${PUBLIC_TOKEN}/config`, (r) =>
      r.fulfill({ json: WIDGET_CONFIG }),
    );
    await page.route(`**/widget/${PUBLIC_TOKEN}/sessions`, (r) =>
      r.fulfill({
        json: { sessionId: SESSION_ID, conversationId: 'conv-001', resumed: false },
        status: 201,
      }),
    );
    await page.route(`**/widget/${PUBLIC_TOKEN}/messages`, (r) =>
      r.fulfill({
        json: { messageId: 'm1', conversationId: 'conv-001', contactId: 'c1' },
        status: 201,
      }),
    );
    await page.route(
      `**/widget/${PUBLIC_TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => {
        getCallCount++;
        r.fulfill({ json: { messages: getCallCount === 1 ? [] : priorMessages } });
      },
    );
    await page.route(
      `**/widget/${PUBLIC_TOKEN}/sessions/${SESSION_ID}`,
      (r) => {
        if (r.request().method() === 'DELETE') r.fulfill({ json: { success: true } });
        else r.continue();
      },
    );

    await loadWidgetPage(page);

    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await fab.click();

    // Send a message to populate chat
    const input = page.locator('#atendeai-widget-root').locator('pierce/.aw-input');
    await input.fill('Mensagem antes do restart');
    await input.press('Enter');

    // Wait a moment for polling to run
    await page.waitForTimeout(2000);

    // Click restart button
    const restartBtn = page
      .locator('#atendeai-widget-root')
      .locator('pierce/.aw-restart-btn');
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();

    // After restart, only greeting should remain — no prior messages
    const msgArea = page.locator('#atendeai-widget-root').locator('pierce/#aw-messages');
    await expect(msgArea).toContainText('Olá! Como posso ajudar?');

    const userBubbles = page
      .locator('#atendeai-widget-root')
      .locator('pierce/.aw-msg-user');
    await expect(userBubbles).toHaveCount(0, { timeout: 3000 });
  });

  test('new session after restart has empty message list', async ({ page }) => {
    const NEW_SESSION_ID = 'session-after-restart-001';

    await page.route(`**/widget/${PUBLIC_TOKEN}/config`, (r) =>
      r.fulfill({ json: WIDGET_CONFIG }),
    );

    let sessionCallCount = 0;
    await page.route(`**/widget/${PUBLIC_TOKEN}/sessions`, (r) => {
      sessionCallCount++;
      const sid = sessionCallCount === 1 ? SESSION_ID : NEW_SESSION_ID;
      r.fulfill({
        json: { sessionId: sid, conversationId: `conv-${sid}`, resumed: false },
        status: 201,
      });
    });

    await page.route(`**/widget/${PUBLIC_TOKEN}/sessions/${SESSION_ID}`, (r) => {
      if (r.request().method() === 'DELETE') r.fulfill({ json: { success: true } });
      else r.continue();
    });

    await page.route(
      `**/widget/${PUBLIC_TOKEN}/sessions/${NEW_SESSION_ID}/messages`,
      (r) => r.fulfill({ json: { messages: [] } }),
    );

    await page.route(
      `**/widget/${PUBLIC_TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => r.fulfill({ json: { messages: [] } }),
    );

    await loadWidgetPage(page);

    const fab = page.locator('#atendeai-widget-root').locator('pierce/.aw-fab');
    await fab.click();

    // Restart
    const restartBtn = page
      .locator('#atendeai-widget-root')
      .locator('pierce/.aw-restart-btn');
    await restartBtn.click();

    // Session key should be updated to new session
    const newStoredSession = await page.evaluate(
      (key) => localStorage.getItem(key),
      SESSION_KEY,
    );
    expect(newStoredSession).toBe(NEW_SESSION_ID);

    // No user messages
    const userBubbles = page
      .locator('#atendeai-widget-root')
      .locator('pierce/.aw-msg-user');
    await expect(userBubbles).toHaveCount(0, { timeout: 3000 });
  });
});
