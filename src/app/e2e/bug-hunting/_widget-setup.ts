/**
 * Shared test setup for inline-widget bug-hunting tests.
 *
 * Widget DOM IDs (no Shadow DOM — inline WidgetScriptController):
 *   #_atai-btn   FAB button
 *   #_atai-panel Chat panel  (.open when visible)
 *   #_atai-msgs  Messages container
 *   #_atai-inp   Textarea / text input
 *   #_atai-snd   Send button
 *   #_atai-qr    Quick replies container
 *   ._qr-chip    Individual quick reply chip
 *   #_atai-rbtn  Restart button
 *   #_atai-xbtn  Close button
 *   ._row.in     Inbound message row (AI / agent)
 *   ._row.out    Outbound message row (visitor)
 *   #_atai-tr    Typing indicator
 */
import { expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const API_BASE = 'http://localhost:8080';

export function extractWidgetScript(): string {
  const filePath = path.resolve(
    __dirname,
    '../../../api/modules/messaging/presentation/controllers/WidgetScriptController.ts',
  );
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(/const WIDGET_SCRIPT = `([\s\S]*?)`;/);
  if (!match) throw new Error('WIDGET_SCRIPT not found in WidgetScriptController.ts');
  return match[1];
}

export interface WidgetConfig {
  id: string;
  name: string;
  greeting: string;
  color: string;
  position: 'bottom-right' | 'bottom-left';
  avatarUrl: string | null;
  collectName: boolean;
  collectPhone: boolean;
  collectEmail: boolean;
  collectCpf: boolean;
  quickReplies: string[];
  proactiveDelay: number | null;
  proactiveMsg: string | null;
}

export interface SetupOptions {
  config?: Partial<WidgetConfig> | object;
  sessionId?: string;
  resumed?: boolean;
  messages?: WidgetMessage[];
  sessionHttpStatus?: number;
  preloadSession?: boolean;
  useFakeClock?: boolean;
  configHttpStatus?: number;
}

export interface WidgetMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  contentType: string;
  content: { text?: string; url?: string };
  sentBy: string;
  createdAt: string;
}

export function makeAiMsg(id: string, text: string): WidgetMessage {
  return {
    id,
    direction: 'OUTBOUND',
    contentType: 'TEXT',
    content: { text },
    sentBy: 'AI',
    createdAt: new Date().toISOString(),
  };
}

export function makeVisitorMsg(id: string, text: string): WidgetMessage {
  return {
    id,
    direction: 'INBOUND',
    contentType: 'TEXT',
    content: { text },
    sentBy: 'CONTACT',
    createdAt: new Date().toISOString(),
  };
}

const WIDGET_SCRIPT = extractWidgetScript();

export function buildSetup(token: string, defaultSessionId: string) {
  const TEST_PAGE_URL = `${API_BASE}/_widget_test_${token}`;

  async function setup(page: Page, opts: SetupOptions = {}) {
    const sid = opts.sessionId ?? defaultSessionId;
    const cfg = opts.config ?? {};

    await page.route(TEST_PAGE_URL, (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Widget Test</title>
  <script src="${API_BASE}/widget.js" data-token="${token}"></script>
</head>
<body><p>Página de teste</p></body>
</html>`,
      }),
    );

    await page.route(`${API_BASE}/widget.js`, (r) =>
      r.fulfill({
        contentType: 'application/javascript; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: WIDGET_SCRIPT,
      }),
    );

    await page.route(`${API_BASE}/widget/${token}/config`, (r) => {
      if (opts.configHttpStatus && opts.configHttpStatus >= 400) {
        r.fulfill({ status: opts.configHttpStatus, body: '{}' });
      } else {
        r.fulfill({ json: cfg });
      }
    });

    await page.route(`${API_BASE}/widget/${token}/sessions`, (r) => {
      if (opts.sessionHttpStatus && opts.sessionHttpStatus >= 400) {
        r.fulfill({ status: opts.sessionHttpStatus, body: JSON.stringify({ error: 'Error' }) });
      } else {
        r.fulfill({
          status: 201,
          json: {
            sessionId: sid,
            conversationId: `conv-${token}-001`,
            resumed: opts.resumed ?? false,
          },
        });
      }
    });

    await page.route(`${API_BASE}/widget/${token}/messages`, (r) =>
      r.fulfill({
        status: 201,
        json: { messageId: 'msg-001', conversationId: `conv-${token}-001`, contactId: 'ct-001' },
      }),
    );

    await page.route(
      `${API_BASE}/widget/${token}/sessions/${sid}/messages`,
      (r) => r.fulfill({ json: { messages: opts.messages ?? [] } }),
    );

    await page.route(`${API_BASE}/widget/${token}/sessions/${sid}`, (r) => {
      if (r.request().method() === 'DELETE') r.fulfill({ json: { success: true } });
      else r.continue();
    });

    if (opts.preloadSession) {
      await page.addInitScript(
        ([key, val]: [string, string]) => localStorage.setItem(key, val),
        [`_atai_sid_${token}`, sid],
      );
    }

    if (opts.useFakeClock) {
      await page.clock.install({ time: Date.now() });
    }

    await page.goto(TEST_PAGE_URL);
    await page.waitForSelector('#_atai-btn', { timeout: 10000 });
  }

  async function openPanel(page: Page) {
    await page.click('#_atai-btn');
    await page.waitForSelector('#_atai-panel.open', { timeout: 3000 });
  }

  async function waitForMsg(page: Page, text: string, timeoutMs = 10000) {
    await expect(page.locator('#_atai-msgs')).toContainText(text, { timeout: timeoutMs });
  }

  async function typeAndSend(page: Page, text: string) {
    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill(text);
    await page.click('#_atai-snd');
  }

  return { setup, openPanel, waitForMsg, typeAndSend, TEST_PAGE_URL, TOKEN: token, SESSION_ID: defaultSessionId };
}
