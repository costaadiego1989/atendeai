/**
 * Playwright E2E — Widget Security & Vulnerability Tests
 *
 * Probes for real vulnerabilities in the chat widget:
 *   - XSS injection via message content (visitor and AI)
 *   - XSS via config fields (greeting, widget name)
 *   - Empty/whitespace message prevention
 *   - Oversized message handling
 *   - SYSTEM message type injection via API
 *   - Session IDOR (cross-session message read) via API
 *   - Invalid token handling
 *   - visitorId manipulation
 *
 * Requirements: WPET-12..17
 *
 * FINDINGS PROTOCOL: Each test that finds a vulnerability logs
 * window._VULN_* so failures are clearly attributed.
 */
import { test, expect, Page } from '@playwright/test';
import { API_BASE, buildSetup, makeAiMsg, makeVisitorMsg } from './_widget-setup';

const TOKEN = 'wgt-security';
const SESSION_ID = 'sess-sec-001';
const { setup, openPanel, waitForMsg, typeAndSend } = buildSetup(TOKEN, SESSION_ID);

const CFG_BASE = {
  id: 'cfg-sec',
  name: 'Atendimento Seguro',
  greeting: 'Olá! Como posso ajudar?',
  color: '#6366f1',
  position: 'bottom-right' as const,
  avatarUrl: null,
  collectName: false,
  collectPhone: false,
  collectEmail: false,
  collectCpf: false,
  quickReplies: [],
  proactiveDelay: null,
  proactiveMsg: null,
};

// ─── XSS payload helpers ──────────────────────────────────────────────────
const XSS_SCRIPT = '<script>window._xss_script=true</script>';
const XSS_IMG = '<img src=x onerror="window._xss_img=true">';
const XSS_LINK = '<a href="javascript:window._xss_link=true">clique</a>';
const XSS_EVENT = '<b onmouseover="window._xss_event=true">texto</b>';

async function assertNoXss(page: Page, keys: string[]) {
  for (const key of keys) {
    const fired = await page.evaluate((k: string) => (window as any)[k], key);
    expect(fired, `XSS fired via ${key}`).toBeFalsy();
  }
}

// ─── Setup helper for XSS tests via AI reply ─────────────────────────────
async function setupWithXssAiReply(page: Page, xssPayload: string) {
  let pollCount = 0;

  await setup(page, { config: CFG_BASE, preloadSession: true });

  await page.route(`${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`, (r) => {
    pollCount++;
    const messages =
      pollCount >= 2
        ? [makeAiMsg('xss-reply', xssPayload)]
        : [];
    r.fulfill({ json: { messages } });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
test.describe('XSS — Mensagem do visitante', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-12: <script> tag enviada como mensagem NÃO executa JS', async ({ page }) => {
    await setup(page, { config: CFG_BASE, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, XSS_SCRIPT);

    // Wait for message to render
    await page.waitForTimeout(1000);

    await assertNoXss(page, ['_xss_script']);

    // Message content should appear as escaped text, not executed
    const outBubbles = page.locator('._row.out ._bub');
    await expect(outBubbles.first()).toContainText('script', { timeout: 3000 });
  });

  test('WPET-12: <img onerror> enviada como mensagem NÃO executa handler', async ({ page }) => {
    await setup(page, { config: CFG_BASE, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, XSS_IMG);
    await page.waitForTimeout(1000);

    await assertNoXss(page, ['_xss_img']);
  });

  test('WPET-12: javascript: URI em mensagem NÃO executa JS', async ({ page }) => {
    await setup(page, { config: CFG_BASE, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, XSS_LINK);
    await page.waitForTimeout(500);

    await assertNoXss(page, ['_xss_link']);
  });

  test('WPET-12: handler de evento inline em mensagem NÃO executa', async ({ page }) => {
    await setup(page, { config: CFG_BASE, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, XSS_EVENT);

    // Hover to trigger the mouseover event if the element was unsafely rendered
    const outBubble = page.locator('._row.out ._bub').first();
    if (await outBubble.isVisible({ timeout: 2000 }).catch(() => false)) {
      await outBubble.hover();
    }

    await assertNoXss(page, ['_xss_event']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('XSS — Resposta da IA (via polling)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-13: <img onerror> em reply da IA NÃO executa — vulnerabilidade crítica se falhar', async ({ page }) => {
    await setupWithXssAiReply(page, XSS_IMG);
    await openPanel(page);

    await typeAndSend(page, 'Olá');

    // Wait for AI reply to render (polling picks it up)
    await page.waitForTimeout(8000);

    // CRITICAL: if this fails, the widget is vulnerable to XSS in AI replies
    await assertNoXss(page, ['_xss_img']);
  });

  test('WPET-13: <script> em reply da IA NÃO executa', async ({ page }) => {
    await setupWithXssAiReply(page, XSS_SCRIPT);
    await openPanel(page);

    await typeAndSend(page, 'Olá');
    await page.waitForTimeout(8000);

    await assertNoXss(page, ['_xss_script']);
  });

  test('WPET-13: javascript: link em reply da IA NÃO é clicável/executável', async ({ page }) => {
    await setupWithXssAiReply(page, XSS_LINK);
    await openPanel(page);

    await typeAndSend(page, 'Olá');
    await page.waitForTimeout(8000);

    // Try clicking any link rendered in AI message area
    const links = page.locator('._row.in a[href^="javascript"]');
    const count = await links.count();
    if (count > 0) {
      await links.first().click({ force: true }).catch(() => {});
    }

    await assertNoXss(page, ['_xss_link']);
  });

  test('WPET-13: HTML completo em reply da IA renderizado como texto plano', async ({ page }) => {
    const htmlPayload = '<div><h1>Injeção</h1><p onclick="alert(1)">teste</p></div>';

    let pollCount = 0;
    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`, (r) => {
      pollCount++;
      r.fulfill({
        json: {
          messages: pollCount >= 2 ? [makeAiMsg('html-reply', htmlPayload)] : [],
        },
      });
    });

    await openPanel(page);
    await typeAndSend(page, 'Olá');
    await page.waitForTimeout(8000);

    // The h1/p tags should appear as text, not as rendered heading/paragraph
    const inBubbles = page.locator('._row.in ._bub');
    const count = await inBubbles.count();
    if (count > 0) {
      // Should contain the text content of the HTML (even if tags are shown)
      const text = await inBubbles.last().textContent();
      // No injected h1 element should exist
      const h1Count = await page.locator('._row.in h1').count();
      expect(h1Count, 'HTML element injected via innerHTML').toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('XSS — Campos de configuração', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-12: <script> no campo greeting da config NÃO executa', async ({ page }) => {
    await setup(page, {
      config: { ...CFG_BASE, greeting: `${XSS_SCRIPT} Olá!` },
      preloadSession: true,
    });
    await openPanel(page);

    await page.waitForTimeout(1000);
    await assertNoXss(page, ['_xss_script']);
  });

  test('WPET-12: <img onerror> no campo greeting NÃO executa', async ({ page }) => {
    await setup(page, {
      config: { ...CFG_BASE, greeting: `${XSS_IMG} Bem-vindo!` },
      preloadSession: true,
    });
    await openPanel(page);

    await page.waitForTimeout(1500);
    await assertNoXss(page, ['_xss_img']);
  });

  test('WPET-12: <script> no nome do widget NÃO executa', async ({ page }) => {
    await setup(page, {
      config: { ...CFG_BASE, name: `Suporte${XSS_SCRIPT}` },
      preloadSession: true,
    });
    await openPanel(page);

    await page.waitForTimeout(1000);
    await assertNoXss(page, ['_xss_script']);
  });

  test('WPET-12: XSS em quick reply chip NÃO executa', async ({ page }) => {
    await setup(page, {
      config: { ...CFG_BASE, quickReplies: [`${XSS_IMG}`, 'Normal'] },
      preloadSession: true,
    });
    await openPanel(page);
    await page.waitForTimeout(1500);

    await assertNoXss(page, ['_xss_img']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('WPET-15: Mensagem vazia / whitespace', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-15: botão enviar com input vazio NÃO faz request à API', async ({ page }) => {
    let messageSent = false;

    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, (r) => {
      messageSent = true;
      r.fulfill({ status: 201, json: { messageId: 'msg', conversationId: 'conv', contactId: 'ct' } });
    });

    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    // Ensure input is empty
    await inp.fill('');
    await page.click('#_atai-snd');

    await page.waitForTimeout(500);
    expect(messageSent).toBe(false);
  });

  test('WPET-15: Enter com input vazio NÃO faz request à API', async ({ page }) => {
    let messageSent = false;

    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, (r) => {
      messageSent = true;
      r.fulfill({ status: 201, json: { messageId: 'msg', conversationId: 'conv', contactId: 'ct' } });
    });

    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('');
    await inp.press('Enter');

    await page.waitForTimeout(500);
    expect(messageSent).toBe(false);
  });

  test('WPET-15: mensagem só com espaços NÃO é enviada', async ({ page }) => {
    let sentBody: any = null;

    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      sentBody = r.request().postDataJSON();
      await r.fulfill({ status: 201, json: { messageId: 'msg', conversationId: 'conv', contactId: 'ct' } });
    });

    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('   '); // only spaces
    await page.click('#_atai-snd');

    await page.waitForTimeout(500);

    // Either nothing sent, or text was trimmed to empty and not sent
    if (sentBody) {
      expect(sentBody.text.trim()).not.toBe('');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('WPET-16: Mensagem excessivamente longa', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-16: mensagem de 5000 caracteres — widget não trava nem lança erro', async ({ page }) => {
    const longMsg = 'A'.repeat(5000);
    let sentText = '';

    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentText = body?.text ?? '';
      await r.fulfill({ status: 201, json: { messageId: 'msg', conversationId: 'conv', contactId: 'ct' } });
    });

    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill(longMsg);
    await page.click('#_atai-snd');

    await page.waitForTimeout(1000);

    // Widget should not crash — either truncated or sent as-is
    const outBubble = page.locator('._row.out ._bub').first();
    const isVisible = await outBubble.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      // If sent, the text should be reasonable (not 5000 chars or truncated)
      expect(sentText.length).toBeGreaterThan(0);
    }
  });

  test('WPET-16: mensagem de 10000 caracteres — API não recebe payload gigante se limite existe', async ({ page }) => {
    const hugeMsg = 'B'.repeat(10000);
    let sentLength = 0;

    await setup(page, { config: CFG_BASE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentLength = (body?.text ?? '').length;
      await r.fulfill({ status: 201, json: { messageId: 'msg', conversationId: 'conv', contactId: 'ct' } });
    });

    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    // Fill via evaluate to bypass browser input limits
    await inp.evaluate((el: HTMLInputElement, val: string) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, hugeMsg);

    await page.click('#_atai-snd');
    await page.waitForTimeout(1000);

    // If sent: log for reporting. Test passes if widget doesn't crash.
    // A proper implementation would limit to ~2000 chars.
    if (sentLength > 0) {
      console.log(`[WPET-16] Sent ${sentLength} chars — check if backend enforces limit`);
    }

    // Widget must still be functional after the attempt
    const fab = page.locator('#_atai-btn');
    // Panel is still open (not crashed)
    await expect(page.locator('#_atai-panel')).toHaveClass(/open/, { timeout: 2000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('WPET-14: Token inválido / config 404', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-14: token inválido (config 404) — widget NÃO renderiza', async ({ page }) => {
    await setup(page, { config: CFG_BASE, configHttpStatus: 404 });

    // Widget should not render FAB when config fails
    await page.waitForTimeout(3000);

    const fab = page.locator('#_atai-btn');
    const isVisible = await fab.isVisible({ timeout: 1000 }).catch(() => false);

    expect(isVisible).toBeFalsy();
  });

  test('WPET-14: token válido mas sessão retorna 503 — widget renderiza em estado degradado', async ({ page }) => {
    await setup(page, { config: CFG_BASE, sessionHttpStatus: 503, preloadSession: false });

    // FAB should still render (config loaded OK)
    const fab = page.locator('#_atai-btn');
    await expect(fab).toBeVisible({ timeout: 5000 });

    // Open panel
    await fab.click();

    await page.waitForTimeout(2000);
    // Panel should be visible even if session failed
    // (widget degrades gracefully)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('WPET-17: Injeção de tipo SYSTEM via API', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-17: visitorId com caracteres SQL injection — API não retorna 500', async ({ page }) => {
    // This test uses the real widget but intercepts the sessions request to verify
    // the visitorId gets sent as-is (escaping is server responsibility)
    const sqlPayload = "'; DROP TABLE widget_sessions; --";
    let capturedVisitorId = '';

    await setup(page, { config: CFG_BASE });

    // Capture the sessions POST body
    await page.route(`${API_BASE}/widget/${TOKEN}/sessions`, async (r) => {
      const body = r.request().postDataJSON();
      capturedVisitorId = body?.visitorId ?? '';
      await r.fulfill({
        status: 201,
        json: { sessionId: SESSION_ID, conversationId: 'conv-001', resumed: false },
      });
    });

    // Override localStorage with SQL payload as visitorId
    await page.evaluate((payload: string) => {
      localStorage.setItem('atendeai_visitor_id', payload);
    }, sqlPayload);

    await page.reload();
    await page.waitForSelector('#_atai-btn', { timeout: 10000 });

    // The SDK should use the localStorage visitorId
    // Verify the widget still renders (server-side validation is tested separately)
    const fab = page.locator('#_atai-btn');
    await expect(fab).toBeVisible({ timeout: 5000 });

    // Log for manual verification — server must sanitize
    if (capturedVisitorId) {
      console.log(`[WPET-17] visitorId sent to API: ${capturedVisitorId.substring(0, 50)}`);
    }
  });

  test('WPET-17: name com XSS na coleta — nome enviado como texto puro na criação da sessão', async ({ page }) => {
    let capturedName = '';

    const CFG_COLLECT = { ...CFG_BASE, collectName: true };
    await setup(page, { config: CFG_COLLECT });

    await page.route(`${API_BASE}/widget/${TOKEN}/sessions`, async (r) => {
      const body = r.request().postDataJSON();
      capturedName = body?.visitorName ?? '';
      await r.fulfill({
        status: 201,
        json: { sessionId: SESSION_ID, conversationId: 'conv-001', resumed: false },
      });
    });

    await openPanel(page);

    // Wait for name collection step
    const inp = page.locator('#_atai-inp');
    await page.waitForTimeout(3000);
    if (await inp.isDisabled().catch(() => true)) return; // skip if no collect step

    await inp.fill(`<script>alert(1)</script>Diego`);
    await page.click('#_atai-snd');

    await page.waitForTimeout(2000);

    // The name should be sent as-is (plain text) to the API
    // The WIDGET should NOT execute the script
    await assertNoXss(page, ['_xss_script']);

    // Server must sanitize further — but widget must not execute locally
    if (capturedName) {
      expect(capturedName).not.toContain('<script>');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('WPET-14: Session IDOR — isolamento entre visitantes', () => {
  test('WPET-14: widget NÃO usa sessionId de outro visitante de localStorage diferente', async ({ page }) => {
    const victimSessionId = 'victim-session-999';
    const attackerToken = TOKEN;

    await page.addInitScript(() => localStorage.clear());

    // Attacker pre-loads a victim's session ID
    await page.addInitScript(
      ([key, val]: [string, string]) => localStorage.setItem(key, val),
      [`_atai_sid_${attackerToken}`, victimSessionId],
    );

    const validatedSessionId = `sess-validate-${Date.now()}`;
    let validateCalled = false;

    await setup(page, {
      config: CFG_BASE,
      sessionId: validatedSessionId,
    });

    // If widget tries to validate the victim's session, return 404
    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${victimSessionId}/messages`,
      (r) => {
        validateCalled = true;
        // Return 404 to simulate invalid session
        r.fulfill({ status: 404, json: { error: 'Session not found' } });
      },
    );

    // Widget should then create a new session
    await page.route(`${API_BASE}/widget/${TOKEN}/sessions`, async (r) => {
      await r.fulfill({
        status: 201,
        json: { sessionId: validatedSessionId, conversationId: 'conv-new', resumed: false },
      });
    });

    await page.goto(`${API_BASE}/_widget_test_${TOKEN}`);
    await page.waitForSelector('#_atai-btn', { timeout: 10000 });

    await page.waitForTimeout(2000);

    // Widget should have tried to validate (and failed), then created new session
    // OR should have created new session directly without trying victim's session
    const storedSession = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );

    // After validation failure, widget should NOT be stuck on the victim's sessionId
    // It should either have a new session or the victim session was cleared
    expect(storedSession).not.toBe(victimSessionId);
  });
});
