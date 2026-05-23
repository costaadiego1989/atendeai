/**
 * Playwright E2E — Widget Inline JS (WidgetScriptController)
 *
 * Tests every step of the widget served at GET /widget.js.
 * All API calls are mocked via page.route() — no backend needed.
 * Runs under the bug-hunting Playwright project (no auth state).
 *
 * Widget DOM IDs (no Shadow DOM):
 *   #_atai-btn   FAB button
 *   #_atai-panel Chat panel
 *   #_atai-msgs  Messages container
 *   #_atai-inp   Textarea input
 *   #_atai-snd   Send button
 *   #_atai-qr    Quick replies container
 *   ._qr-chip    Individual quick reply chip
 *   #_atai-rbtn  Restart button
 *   #_atai-xbtn  Close button
 *   ._row.in     Inbound message row (agent / AI)
 *   ._row.out    Outbound message row (visitor)
 *   #_atai-tr    Typing indicator row
 */
import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────
const TOKEN = 'wgt-playwright-inline';
const SESSION_ID = 'sess-inline-001';
const API_BASE = 'http://localhost:8080';
const TEST_PAGE_URL = `${API_BASE}/_widget_test_inline`;

// Extract the actual inline widget script from WidgetScriptController.ts
function extractWidgetScript(): string {
  const filePath = path.resolve(
    __dirname,
    '../../../api/modules/messaging/presentation/controllers/WidgetScriptController.ts',
  );
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(/const WIDGET_SCRIPT = `([\s\S]*?)`;/);
  if (!match) throw new Error('WIDGET_SCRIPT not found in WidgetScriptController.ts');
  return match[1];
}

const WIDGET_SCRIPT = extractWidgetScript();

// ─── Widget configs ─────────────────────────────────────────────────────────
const CFG_COLLECT = {
  id: 'cfg-inline-collect',
  name: 'Zion',
  greeting: 'Olá! Como posso te ajudar hoje?',
  color: '#3b82f6',
  position: 'bottom-right',
  avatarUrl: null,
  collectName: true,
  collectPhone: true,
  collectEmail: true,
  collectCpf: false,
  quickReplies: ['Sobre a Empresa', 'Horários'],
  proactiveDelay: null,
  proactiveMsg: null,
};

const CFG_NO_COLLECT = {
  ...CFG_COLLECT,
  collectName: false,
  collectPhone: false,
  collectEmail: false,
};

// ─── Setup helper ─────────────────────────────────────────────────────────
interface SetupOptions {
  config?: object;
  sessionId?: string;
  resumed?: boolean;
  messages?: any[];
  sessionHttpStatus?: number;
  preloadSession?: boolean;
  useFakeClock?: boolean;
}

async function setup(page: Page, opts: SetupOptions = {}) {
  const sid = opts.sessionId ?? SESSION_ID;
  const cfg = opts.config ?? CFG_COLLECT;

  // Serve the test HTML page
  await page.route(TEST_PAGE_URL, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Widget Inline Test</title>
  <script src="${API_BASE}/widget.js" data-token="${TOKEN}"></script>
</head>
<body><p>Página de teste do widget</p></body>
</html>`,
    }),
  );

  // Serve the actual widget script
  await page.route(`${API_BASE}/widget.js`, (r) =>
    r.fulfill({
      contentType: 'application/javascript; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: WIDGET_SCRIPT,
    }),
  );

  // Widget config
  await page.route(`${API_BASE}/widget/${TOKEN}/config`, (r) =>
    r.fulfill({ json: cfg }),
  );

  // Session create / resume
  await page.route(`${API_BASE}/widget/${TOKEN}/sessions`, (r) => {
    if (opts.sessionHttpStatus && opts.sessionHttpStatus >= 400) {
      r.fulfill({
        status: opts.sessionHttpStatus,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    } else {
      r.fulfill({
        status: 201,
        json: {
          sessionId: sid,
          conversationId: 'conv-inline-001',
          resumed: opts.resumed ?? false,
        },
      });
    }
  });

  // Send message
  await page.route(`${API_BASE}/widget/${TOKEN}/messages`, (r) =>
    r.fulfill({
      status: 201,
      json: {
        messageId: 'msg-inline-001',
        conversationId: 'conv-inline-001',
        contactId: 'ct-inline-001',
      },
    }),
  );

  // Message history (default: empty)
  await page.route(
    `${API_BASE}/widget/${TOKEN}/sessions/${sid}/messages`,
    (r) => r.fulfill({ json: { messages: opts.messages ?? [] } }),
  );

  // Session delete
  await page.route(`${API_BASE}/widget/${TOKEN}/sessions/${sid}`, (r) => {
    if (r.request().method() === 'DELETE') r.fulfill({ json: { success: true } });
    else r.continue();
  });

  // Pre-load session in localStorage (simulates page reload with existing session)
  if (opts.preloadSession) {
    await page.addInitScript(
      ([key, val]: [string, string]) => localStorage.setItem(key, val),
      [`_atai_sid_${TOKEN}`, sid],
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

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — FAB e painel', () => {
  test('FAB aparece após init', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT });
    await expect(page.locator('#_atai-btn')).toBeVisible();
  });

  test('painel abre ao clicar FAB', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT });
    await page.click('#_atai-btn');
    await expect(page.locator('#_atai-panel')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('painel fecha ao clicar botão X', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT });
    await openPanel(page);
    await page.click('#_atai-xbtn');
    await expect(page.locator('#_atai-panel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('botão de reinício visível no header', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT });
    await openPanel(page);
    await expect(page.locator('#_atai-rbtn')).toBeVisible();
  });

  test('saudação exibida ao abrir (sem coleta)', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);
    await waitForMsg(page, 'Olá! Como posso te ajudar hoje?');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Fluxo de coleta: nome', () => {
  test('exibe saudação seguida da pergunta de nome', async ({ page }) => {
    await setup(page, { config: CFG_COLLECT });
    await openPanel(page);
    await waitForMsg(page, 'Olá! Como posso te ajudar hoje?', 6000);
    await waitForMsg(page, 'Como posso te chamar?', 10000);
  });

  test('campo de nome obrigatório — borda vermelha e sem avanço quando vazio', async ({
    page,
  }) => {
    await setup(page, { config: CFG_COLLECT });
    await openPanel(page);
    await waitForMsg(page, 'Como posso te chamar?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    // Submit empty value
    await page.click('#_atai-snd');

    await expect(inp).toHaveCSS('border-color', 'rgb(239, 68, 68)', { timeout: 2000 });
    // Flow stays on name step — no phone question yet
    await expect(page.locator('#_atai-msgs')).not.toContainText('WhatsApp');
  });

  test('digitar nome e enviar exibe bolha "out" com o nome', async ({ page }) => {
    await setup(page, { config: CFG_COLLECT });
    await openPanel(page);
    await waitForMsg(page, 'Como posso te chamar?', 10000);

    await typeAndSend(page, 'Diego Costa');

    await expect(page.locator('._row.out ._bub').first()).toContainText('Diego Costa', {
      timeout: 3000,
    });
  });

  test('após nome avança para pergunta de telefone', async ({ page }) => {
    await setup(page, { config: CFG_COLLECT });
    await openPanel(page);
    await waitForMsg(page, 'Como posso te chamar?', 10000);

    await typeAndSend(page, 'Diego Costa');

    await waitForMsg(page, 'Qual seu WhatsApp ou telefone?', 10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Fluxo de coleta: telefone', () => {
  const CFG_PHONE_ONLY = { ...CFG_COLLECT, collectName: false, collectEmail: false };

  test('máscara de telefone formata (11) 9 9999-9999 ao digitar', async ({ page }) => {
    await setup(page, { config: CFG_PHONE_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu WhatsApp ou telefone?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    // Type raw digits — mask should apply via input event
    await inp.fill('21993001883');
    await inp.dispatchEvent('input');

    const val = await inp.inputValue();
    // Expect masked: digits only replaced by mask
    expect(val.replace(/\D/g, '')).toBe('21993001883');
    expect(val).toMatch(/\(\d{2}\)/); // DDD in parentheses
  });

  test('telefone com menos de 10 dígitos — exibe erro', async ({ page }) => {
    await setup(page, { config: CFG_PHONE_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu WhatsApp ou telefone?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('12345'); // too short
    await page.click('#_atai-snd');

    await waitForMsg(page, 'Número inválido', 6000);
  });

  test('telefone válido (11 dígitos) — avança para próximo passo', async ({ page }) => {
    await setup(page, { config: { ...CFG_PHONE_ONLY, collectEmail: true } });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu WhatsApp ou telefone?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('21993001883');
    await page.click('#_atai-snd');

    await waitForMsg(page, 'Qual seu e-mail?', 10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Fluxo de coleta: email', () => {
  const CFG_EMAIL_ONLY = { ...CFG_COLLECT, collectName: false, collectPhone: false };

  test('email sem @ — borda vermelha e sem avanço', async ({ page }) => {
    await setup(page, { config: CFG_EMAIL_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu e-mail?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('emailsemarroba');
    await page.click('#_atai-snd');

    await expect(inp).toHaveCSS('border-color', 'rgb(239, 68, 68)', { timeout: 2000 });
    expect(await inp.isDisabled()).toBeFalsy();
  });

  test('email com # no lugar de @ — rejeita (caso real: costaadiego2989#gmail.com)', async ({
    page,
  }) => {
    await setup(page, { config: CFG_EMAIL_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu e-mail?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('costaadiego2989#gmail.com');
    await page.click('#_atai-snd');

    await expect(inp).toHaveCSS('border-color', 'rgb(239, 68, 68)', { timeout: 2000 });
  });

  test('email sem domínio válido — rejeita', async ({ page }) => {
    await setup(page, { config: CFG_EMAIL_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu e-mail?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('teste@');
    await page.click('#_atai-snd');

    await expect(inp).toHaveCSS('border-color', 'rgb(239, 68, 68)', { timeout: 2000 });
  });

  test('email válido aceito e sessão criada', async ({ page }) => {
    await setup(page, { config: CFG_EMAIL_ONLY });
    await openPanel(page);
    await waitForMsg(page, 'Qual seu e-mail?', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('diego@example.com');
    await page.click('#_atai-snd');

    await waitForMsg(page, 'Tudo certo!', 12000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Fluxo de coleta: conclusão', () => {
  test('fluxo completo envia dados corretos na criação de sessão', async ({ page }) => {
    let capturedBody: any;

    await setup(page, { config: CFG_COLLECT });

    // Override session route to capture the request body
    await page.route(`${API_BASE}/widget/${TOKEN}/sessions`, async (r) => {
      capturedBody = r.request().postDataJSON();
      await r.fulfill({
        status: 201,
        json: { sessionId: SESSION_ID, conversationId: 'conv-001', resumed: false },
      });
    });

    await openPanel(page);
    const inp = page.locator('#_atai-inp');

    // Name
    await waitForMsg(page, 'Como posso te chamar?', 10000);
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('Diego Costa');
    await page.click('#_atai-snd');

    // Phone
    await waitForMsg(page, 'Qual seu WhatsApp', 10000);
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('21993001883');
    await page.click('#_atai-snd');

    // Email
    await waitForMsg(page, 'Qual seu e-mail?', 10000);
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('diego@example.com');
    await page.click('#_atai-snd');

    await waitForMsg(page, 'Tudo certo!', 12000);

    expect(capturedBody.visitorName).toBe('Diego Costa');
    expect(capturedBody.visitorPhone?.replace(/\D/g, '')).toBe('21993001883');
    expect(capturedBody.visitorEmail).toBe('diego@example.com');
  });

  test('falha 500 na criação de sessão — exibe erro e não persiste sessionId', async ({
    page,
  }) => {
    const CFG_ONE_STEP = { ...CFG_COLLECT, collectPhone: false, collectEmail: false };
    await setup(page, { config: CFG_ONE_STEP, sessionHttpStatus: 500 });
    await openPanel(page);

    await waitForMsg(page, 'Como posso te chamar?', 10000);
    await typeAndSend(page, 'Usuário Erro');

    await waitForMsg(page, 'Falha ao conectar', 12000);

    const stored = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );
    expect(stored).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Persistência de sessão', () => {
  test('reload com sessionId em localStorage pula coleta e habilita input', async ({
    page,
  }) => {
    await setup(page, { config: CFG_COLLECT, preloadSession: true, resumed: true });
    await openPanel(page);

    // Give time for any potential collect flow to start
    await page.waitForTimeout(3000);

    // Must NOT show collect question
    const content = await page.locator('#_atai-msgs').textContent();
    expect(content).not.toContain('Como posso te chamar?');

    // Input must be enabled (chatting mode)
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });

  test('retomada de sessão — carrega histórico de mensagens', async ({ page }) => {
    const history = [
      {
        id: 'h1',
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { text: 'Mensagem anterior do visitante' },
        sentBy: 'CONTACT',
        createdAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: 'h2',
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: { text: 'Resposta anterior da IA' },
        sentBy: 'AI',
        createdAt: new Date(Date.now() - 115000).toISOString(),
      },
    ];

    await setup(page, {
      config: CFG_COLLECT,
      preloadSession: true,
      resumed: true,
      messages: history,
    });
    await openPanel(page);

    await waitForMsg(page, 'Mensagem anterior do visitante', 6000);
    await waitForMsg(page, 'Resposta anterior da IA', 3000);
  });

  test('sessionId persiste em localStorage após coleta completa', async ({ page }) => {
    const CFG_NAME_ONLY = { ...CFG_COLLECT, collectPhone: false, collectEmail: false };
    await setup(page, { config: CFG_NAME_ONLY });
    await openPanel(page);

    await waitForMsg(page, 'Como posso te chamar?', 10000);
    await typeAndSend(page, 'Teste Persist');

    await waitForMsg(page, 'Tudo certo!', 12000);

    const stored = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );
    expect(stored).toBe(SESSION_ID);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Envio de mensagens', () => {
  test('mensagem enviada aparece como bolha out', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, 'Qual o horário de funcionamento?');

    await expect(page.locator('._row.out ._bub').first()).toContainText(
      'Qual o horário de funcionamento?',
      { timeout: 3000 },
    );
  });

  test('envio via tecla Enter', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('Mensagem via Enter');
    await inp.press('Enter');

    await expect(page.locator('._row.out ._bub').first()).toContainText('Mensagem via Enter', {
      timeout: 3000,
    });
  });

  test('input limpo após envio', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('Texto enviado');
    await inp.press('Enter');

    await expect(inp).toHaveValue('', { timeout: 2000 });
  });

  test('erro de rede no envio — exibe mensagem de falha', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });

    // Override messages route after setup — abort to simulate network failure
    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, (r) => r.abort('failed'));

    await openPanel(page);
    await typeAndSend(page, 'Mensagem com rede falha');

    await waitForMsg(page, 'Erro ao enviar', 8000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Quick replies', () => {
  test('chips visíveis após sessão iniciada', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    await expect(page.locator('._qr-chip').first()).toBeVisible({ timeout: 3000 });
  });

  test('click em chip envia texto correto via API', async ({ page }) => {
    let sentText = '';

    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentText = body?.text ?? '';
      await r.fulfill({
        status: 201,
        json: { messageId: 'msg-chip', conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    await page.locator('._qr-chip').first().click();

    await expect(page.locator('._row.out ._bub').first()).toContainText('Sobre a Empresa', {
      timeout: 3000,
    });
    expect(sentText).toBe('Sobre a Empresa');
  });

  test('chips escondem após click', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    await page.locator('._qr-chip').first().click();

    await expect(page.locator('#_atai-qr')).toHaveClass(/hidden/, { timeout: 2000 });
  });

  test('chip não envia quando estado não é chatting (coletando)', async ({ page }) => {
    await setup(page, { config: CFG_COLLECT }); // collect mode — no preload
    await openPanel(page);

    await waitForMsg(page, 'Como posso te chamar?', 10000);

    // QR chips are rendered but should NOT trigger send in collecting state
    const chip = page.locator('._qr-chip').first();
    if (await chip.isVisible()) {
      await chip.click();
      // No out bubble should appear (state is collecting, not chatting)
      await expect(page.locator('._row.out')).toHaveCount(0, { timeout: 1000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Resposta da IA (polling)', () => {
  test('typing indicator aparece após envio', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, 'Quero saber mais sobre os planos');

    await expect(page.locator('#_atai-tr')).toBeVisible({ timeout: 4000 });
  });

  test('mensagem OUTBOUND da IA aparece via polling (3s interval)', async ({ page }) => {
    const aiMsg = {
      id: 'ai-001',
      direction: 'OUTBOUND',
      contentType: 'TEXT',
      content: { text: 'Posso te ajudar com informações sobre nossos planos!' },
      sentBy: 'AI',
      createdAt: new Date().toISOString(),
    };

    let pollCount = 0;

    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });

    // Override: first 2 polls empty, then AI reply
    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => {
        pollCount++;
        r.fulfill({ json: { messages: pollCount >= 2 ? [aiMsg] : [] } });
      },
    );

    await openPanel(page);
    await typeAndSend(page, 'Quais são os planos disponíveis?');

    // AI reply should appear within 12s (polling every 3s, 2nd poll has the reply)
    await expect(page.locator('._row.in ._bub').last()).toContainText(
      'Posso te ajudar com informações',
      { timeout: 15000 },
    );

    // Typing indicator should disappear after reply arrives
    await expect(page.locator('#_atai-tr')).not.toBeAttached({ timeout: 3000 });
  });

  test('timeout 25s sem resposta — exibe erro e mostra chips novamente', async ({ page }) => {
    await setup(page, {
      config: CFG_NO_COLLECT,
      preloadSession: true,
      useFakeClock: true,
    });

    // Always return empty messages (AI never responds)
    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => r.fulfill({ json: { messages: [] } }),
    );

    await openPanel(page);
    await typeAndSend(page, 'Pergunta que ficará sem resposta');

    // Advance clock past 25s timeout
    await page.clock.fastForward(26000);

    await waitForMsg(page, 'Não recebi resposta no momento', 5000);

    // Chips should reappear after timeout
    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget — Reinício', () => {
  test('restart limpa mensagens do histórico', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    await typeAndSend(page, 'Mensagem antes do restart');
    await expect(page.locator('._row.out ._bub').first()).toContainText('Mensagem antes do restart', { timeout: 3000 });

    await page.click('#_atai-rbtn');

    await expect(page.locator('._row.out')).toHaveCount(0, { timeout: 5000 });
  });

  test('restart remove sessionId do localStorage', async ({ page }) => {
    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });
    await openPanel(page);

    const before = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );
    expect(before).toBe(SESSION_ID);

    await page.click('#_atai-rbtn');
    await page.waitForTimeout(1000);

    const after = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );
    expect(after).toBeNull();
  });

  test('restart com collect config — reinicia fluxo de coleta', async ({ page }) => {
    await setup(page, { config: CFG_COLLECT, preloadSession: true });
    await openPanel(page);

    // Should be in chat mode
    await page.waitForTimeout(2000);
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });

    await page.click('#_atai-rbtn');

    // Collect flow restarts
    await waitForMsg(page, 'Como posso te chamar?', 12000);
  });

  test('restart faz chamada DELETE na API', async ({ page }) => {
    let deleteCalledOnSid = '';

    await setup(page, { config: CFG_NO_COLLECT, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}`, async (r) => {
      if (r.request().method() === 'DELETE') {
        deleteCalledOnSid = SESSION_ID;
        await r.fulfill({ json: { success: true } });
      } else {
        await r.continue();
      }
    });

    await openPanel(page);
    await page.click('#_atai-rbtn');

    await page.waitForTimeout(1500);
    expect(deleteCalledOnSid).toBe(SESSION_ID);
  });
});
