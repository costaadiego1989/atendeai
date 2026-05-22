/**
 * Production E2E tests — Widget Chat
 *
 * Hits the real API at api.atende-ai.tech with the real tenant token.
 * Creates real sessions/contacts/conversations in production DB.
 * Run with: npx playwright test e2e/production --project=production
 *
 * NOTE: Production API wraps all responses as {success, statusCode, data}.
 *       The `unwrap()` helper extracts `.data` when present.
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';

const BASE_URL = 'https://api.atende-ai.tech/api/v1';
const PUBLIC_TOKEN = '578f92f9-46d6-498a-b2a6-c47b03d8c7f5';
const TENANT_ID = 'd75e1961-9e33-409c-bf9a-c916c8c7e46c';
const TEST_VISITOR_PREFIX = `pw_e2e_${Date.now()}`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _widgetPhone(visitorId: string): string {
  return `wgt_${crypto.createHash('sha256').update(visitorId).digest('hex').slice(0, 15)}`;
}

function unwrap(raw: any): any {
  return raw?.data ?? raw;
}

async function pollForOutbound(
  request: APIRequestContext,
  sessionId: string,
  expectedCount: number,
  timeoutMs = 45_000,
): Promise<{ found: boolean; messages: any[] }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions/${sessionId}/messages`,
    );
    if (res.ok()) {
      const data = unwrap(await res.json());
      const outbound = (data.messages || []).filter(
        (m: any) => m.direction === 'OUTBOUND',
      );
      if (outbound.length >= expectedCount) {
        return { found: true, messages: data.messages };
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { found: false, messages: [] };
}

test.describe('Widget Chat — Production API', () => {
  test.setTimeout(120_000);

  test('GET /config returns valid widget config', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/widget/${PUBLIC_TOKEN}/config`);
    expect(res.status(), `Config endpoint returned ${res.status()}`).toBe(200);

    const cfg = unwrap(await res.json());
    expect(cfg.name, 'Widget must have a name').toBeTruthy();
    expect(cfg.color, 'Widget must have a color').toBeTruthy();
    console.log('Widget config:', JSON.stringify(cfg, null, 2));
  });

  test('POST /sessions creates session and contact', async ({ request }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_session`;

    const res = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      {
        data: {
          visitorId,
          visitorName: 'PW Test User',
          visitorPhone: '21900000001',
          pageUrl: 'https://test.playwright.io',
        },
      },
    );

    const rawText = await res.text();
    expect(res.status(), `Session creation failed: ${rawText}`).toBe(201);

    const body = unwrap(JSON.parse(rawText));
    console.log('Session response:', body);

    expect(body.sessionId, 'sessionId must be present').toBeTruthy();
    expect(body.resumed).toBe(false);
    expect(body.conversationId, 'conversationId must be set immediately').toBeTruthy();
  });

  test('session resumes correctly on second POST /sessions', async ({ request }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_resume`;

    const first = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      { data: { visitorId, visitorName: 'Resume Test' } },
    );
    expect(first.status()).toBe(201);
    const firstBody = unwrap(await first.json());

    const second = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      { data: { visitorId, visitorName: 'Resume Test' } },
    );
    expect(second.status()).toBe(201);
    const secondBody = unwrap(await second.json());

    expect(secondBody.sessionId).toBe(firstBody.sessionId);
    expect(secondBody.resumed).toBe(true);
  });

  test('POST /messages saves message and triggers AI (waits up to 45s)', async ({
    request,
  }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_msg`;

    // Create session
    const sessRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      {
        data: {
          visitorId,
          visitorName: 'Playwright AI Test',
          visitorPhone: '21900000002',
        },
      },
    );
    expect(sessRes.status()).toBe(201);
    const { sessionId } = unwrap(await sessRes.json());
    console.log(`Session created: ${sessionId}`);

    // Send message
    const msgRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/messages`,
      {
        data: {
          sessionId,
          visitorId,
          text: 'Olá! Qual o horário de funcionamento?',
        },
      },
    );
    const msgRawText = await msgRes.text();
    expect(msgRes.status(), `Message send failed: ${msgRawText}`).toBe(201);

    const msgBody = unwrap(JSON.parse(msgRawText));
    console.log('Message response:', msgBody);
    expect(msgBody.messageId).toBeTruthy();
    expect(msgBody.conversationId).toBeTruthy();
    expect(msgBody.contactId).toBeTruthy();

    // Poll for AI response (up to 45s)
    console.log('Polling for AI OUTBOUND response...');
    const { found, messages } = await pollForOutbound(request, sessionId, 1);

    if (!found) {
      const histRes = await request.get(
        `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions/${sessionId}/messages`,
      );
      const hist = unwrap(await histRes.json());
      console.error(
        'AI did not respond within 45s. Messages in DB:',
        JSON.stringify(hist.messages, null, 2),
      );
    }

    expect(
      found,
      `AI must respond within 45s. Check: billing subscription for tenant ${TENANT_ID}, DeepSeek API key, BullMQ worker status.`,
    ).toBe(true);

    const outbound = messages.filter((m: any) => m.direction === 'OUTBOUND');
    console.log('AI response:', outbound[0]?.content?.text);
  });

  test('GET /sessions/:id/messages returns message history', async ({
    request,
  }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_history`;

    const sessRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      { data: { visitorId, visitorName: 'History Test' } },
    );
    const { sessionId } = unwrap(await sessRes.json());

    await request.post(`${BASE_URL}/widget/${PUBLIC_TOKEN}/messages`, {
      data: { sessionId, visitorId, text: 'Mensagem de teste para histórico' },
    });

    const histRes = await request.get(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions/${sessionId}/messages`,
    );
    expect(histRes.status()).toBe(200);

    const { messages } = unwrap(await histRes.json());
    console.log('History messages:', messages?.length, 'total');

    const inbound = messages.filter((m: any) => m.direction === 'INBOUND');
    expect(inbound.length, 'Must have at least 1 INBOUND message').toBeGreaterThanOrEqual(1);
    expect(
      inbound.some((m: any) => m.content?.text === 'Mensagem de teste para histórico'),
      'Must find the exact sent message in history',
    ).toBe(true);
  });

  test('DELETE /sessions/:id closes session (restart flow)', async ({
    request,
  }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_restart`;

    const sessRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      { data: { visitorId, visitorName: 'Restart Test' } },
    );
    const { sessionId } = unwrap(await sessRes.json());

    const delRes = await request.delete(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions/${sessionId}`,
    );
    expect(delRes.status(), `Delete failed: ${await delRes.text()}`).toBe(200);
    const delBody = unwrap(await delRes.json());
    expect(delBody.success).toBe(true);

    // After delete, new session with same visitorId must NOT be resumed
    const newSessRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      { data: { visitorId, visitorName: 'Fresh Start' } },
    );
    const newSessBody = unwrap(await newSessRes.json());
    expect(newSessBody.resumed, 'After restart, session must not be resumed').toBe(false);
    expect(newSessBody.sessionId).not.toBe(sessionId);
  });

  test('contact is created in DB (conversationId proves contact+conversation created)', async ({
    request,
  }) => {
    const visitorId = `${TEST_VISITOR_PREFIX}_contact`;
    const visitorPhone = '21900000099';

    const sessRes = await request.post(
      `${BASE_URL}/widget/${PUBLIC_TOKEN}/sessions`,
      {
        data: { visitorId, visitorName: 'Contact Verify', visitorPhone },
      },
    );
    const rawText = await sessRes.text();
    expect(sessRes.status(), `Session failed: ${rawText}`).toBe(201);
    const body = unwrap(JSON.parse(rawText));

    expect(
      body.conversationId,
      'conversationId must be set — proves InitiateWidgetContactUseCase created contact + conversation',
    ).toBeTruthy();

    console.log(
      `Session ${body.sessionId} → conversation ${body.conversationId}`,
    );
  });

  test('widget.js script is served with correct content-type', async ({
    request,
  }) => {
    const res = await request.get(`${BASE_URL}/widget.js`);
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] || '';
    expect(ct, 'Must serve JavaScript').toContain('javascript');

    const body = await res.text();
    expect(body, 'Script must reference widget API').toContain('/widget/');
    expect(body.length, 'Script must be non-trivial').toBeGreaterThan(1000);
    console.log(`widget.js size: ${body.length} bytes`);
  });
});
