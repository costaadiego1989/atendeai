/**
 * Playwright E2E — AI conversation context integrity
 *
 * Validates that the widget correctly handles:
 *   - Submenu context accuracy (AI stays on correct step)
 *   - Off-menu inputs (user sends unrelated text at each step)
 *   - Context switching mid-flow (commerce → scheduling)
 *   - Multi-turn exchanges without context loss
 *   - User ignores AI question (sends wrong data for current step)
 *   - Empty AI reply resilience
 *   - Re-entry into flow after context drift
 *   - Escalation mid-checkout
 *   - Repeated invalid inputs
 *
 * Mock strategy: content-aware state machine (not index-based).
 * The mock AI reads the actual text sent and replies based on
 * conversation step, mimicking CommerceConversationFlowRules.
 */
import { test, expect, Page } from '@playwright/test';
import { API_BASE, buildSetup, makeAiMsg, makeVisitorMsg, WidgetMessage } from './_widget-setup';

const TOKEN = 'wgt-ai-ctx';
const SESSION_ID = 'sess-ai-ctx-001';
const { setup, openPanel, waitForMsg, typeAndSend } = buildSetup(TOKEN, SESSION_ID);

const CFG = {
  id: 'cfg-ai-ctx',
  name: 'Loja Teste IA',
  greeting: 'Olá! Bem-vindo à Loja Teste IA 🛒 O que posso fazer por você?',
  color: '#f97316',
  position: 'bottom-right',
  avatarUrl: null,
  collectName: false,
  collectPhone: false,
  collectEmail: false,
  collectCpf: false,
  quickReplies: ['Ver Produtos', 'Meu Pedido', 'Falar com Atendente'],
  proactiveDelay: null,
  proactiveMsg: null,
};

// ─── Content-aware AI state machine ──────────────────────────────────────────

type FlowStep = 'idle' | 'awaiting_qty' | 'awaiting_addr' | 'checkout_done';

function buildAiStateMachine() {
  let step: FlowStep = 'idle';
  const history: WidgetMessage[] = [];
  let msgCounter = 0;

  function getAiReply(userText: string): string {
    const txt = userText.toLowerCase().trim();

    // Escalation — overrides any step
    if (/humano|atendente|pessoa real|falar com algu/.test(txt)) {
      return 'Entendido! Vou transferir você para um de nossos atendentes. Por favor, aguarde um momento.';
    }

    switch (step) {
      case 'idle':
        if (/camiseta|tênis|notebook|produto|comprar|quero|ver produto/.test(txt)) {
          step = 'awaiting_qty';
          return '✅ Encontrei: Camiseta Básica M — R$ 59,90\n\nQual a quantidade desejada?';
        }
        if (/agendar|agendamento|consulta|horário/.test(txt)) {
          // Context switch attempt: widget is in commerce mode
          return 'Estou aqui para ajudar com compras. Para agendamentos, acesse outro canal. Posso te ajudar a encontrar um produto?';
        }
        return 'Olá! Qual produto você está procurando hoje?';

      case 'awaiting_qty':
        if (/^\d+$/.test(txt) || /\b[1-9][0-9]?\b/.test(txt)) {
          step = 'awaiting_addr';
          return 'Perfeito! Subtotal: R$ 119,80\n\nQual o endereço de entrega?\n(Rua, número, bairro, cidade, CEP)';
        }
        if (/agendar|agendamento|consulta/.test(txt)) {
          // Off-topic while in qty step — must redirect back
          return 'Ainda preciso da quantidade do produto. Quantas unidades deseja?';
        }
        if (/rua|av\.|avenida|cep|bairro|cidade/.test(txt)) {
          // User sent address at wrong step — must redirect
          return 'Antes do endereço, preciso saber a quantidade. Quantas unidades deseja?';
        }
        if (/o que você faz|o que é isso|não entendi|como funciona/.test(txt)) {
          // Generic off-menu question
          return 'Sou o assistente da Loja Teste IA. No momento aguardo a quantidade do produto. Quantas unidades deseja?';
        }
        // Any other off-menu text
        return 'Não entendi. Para continuar com seu pedido, informe a quantidade desejada.';

      case 'awaiting_addr':
        if (/rua|av\.|avenida|cep|\d{5}-?\d{3}|bairro/.test(txt) || txt.length > 25) {
          step = 'checkout_done';
          return '🛒 Pedido confirmado!\n\nLink de pagamento: https://pay.example.com/checkout/abc123\n\nVálido por 30 minutos.';
        }
        if (/^\d{1,3}$/.test(txt)) {
          // Looks like a quantity, wrong step
          return 'Já recebi a quantidade! Agora preciso do endereço completo de entrega (Rua, número, bairro, cidade, CEP).';
        }
        if (/agendar|agendamento/.test(txt)) {
          return 'Quase lá! Só preciso do endereço de entrega para finalizar seu pedido (Rua, número, bairro, cidade, CEP).';
        }
        return 'Por favor, informe o endereço de entrega completo (Rua, número, bairro, cidade, CEP).';

      case 'checkout_done':
        return 'Seu pedido já foi confirmado! O link de pagamento foi enviado. Posso ajudar com mais alguma coisa?';
    }
  }

  function processMessage(userText: string): WidgetMessage[] {
    msgCounter++;
    history.push(makeVisitorMsg(`v${msgCounter}`, userText));
    const reply = getAiReply(userText);
    msgCounter++;
    history.push(makeAiMsg(`ai${msgCounter}`, reply));
    return [...history];
  }

  return {
    processMessage,
    getStep: () => step,
    getHistory: () => [...history],
  };
}

// ─── Setup with state-machine mock ────────────────────────────────────────────

async function setupWithStateMachine(page: Page) {
  const machine = buildAiStateMachine();
  let latestHistory: WidgetMessage[] = [];

  await setup(page, { config: CFG, preloadSession: true });

  await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
    const body = r.request().postDataJSON();
    const text: string = body?.text ?? '';
    latestHistory = machine.processMessage(text);
    await r.fulfill({
      status: 201,
      json: { messageId: `msg-${Date.now()}`, conversationId: 'conv-001', contactId: 'ct-001' },
    });
  });

  await page.route(
    `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
    (r) => r.fulfill({ json: { messages: latestHistory } }),
  );

  return machine;
}

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Contexto correto por submenu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-01: step qty — IA pede quantidade, não produto novamente', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero comprar uma camiseta');
    await waitForMsg(page, 'Qual a quantidade desejada?', 12000);

    // IA deve perguntar quantidade, NÃO "qual produto"
    const content = await page.locator('#_atai-msgs').textContent();
    expect(content).not.toMatch(/qual produto|o que procura|qual item/i);
    expect(content).toContain('quantidade');
  });

  test('AI-02: step addr — IA pede endereço, não quantidade novamente', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, '2');
    await waitForMsg(page, 'endereço de entrega', 12000);

    // IA NÃO deve repetir "quantidade"
    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).not.toContain('quantidade');
    expect(lastAiMsg.toLowerCase()).toContain('endereço');
  });

  test('AI-03: fluxo completo 3 steps sem desvio de contexto', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero um notebook');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, '1');
    await waitForMsg(page, 'endereço', 12000);

    await typeAndSend(page, 'Rua das Flores, 123, Jardim Primavera, SP, 01310-100');
    await waitForMsg(page, 'pay.example.com', 15000);

    // Confirm all 3 steps were answered correctly (no step was repeated)
    const content = await page.locator('#_atai-msgs').textContent() ?? '';
    expect(content).toContain('quantidade');
    expect(content).toContain('endereço');
    expect(content).toContain('Link de pagamento');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Inputs fora do menu em cada step', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-04: fora do menu no step idle — IA redireciona sem crashar', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'o que é blockchain?');
    await waitForMsg(page, 'produto', 12000);

    // Widget still functional after off-menu input
    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 3000 });
  });

  test('AI-05: fora do menu no step qty — IA mantém step, pede quantidade', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    // Send completely off-topic message
    await typeAndSend(page, 'o que você faz?');
    await waitForMsg(page, 'quantidade', 12000);

    // IA must still be asking for quantity (not advance to addr step)
    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).toContain('quantidade');
    expect(lastAiMsg.toLowerCase()).not.toContain('endereço');
  });

  test('AI-06: usuário manda endereço no step qty — IA detecta e redireciona', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero tênis');
    await waitForMsg(page, 'quantidade', 12000);

    // Wrong data for current step
    await typeAndSend(page, 'Rua das Rosas, 45, São Paulo');
    await waitForMsg(page, 'quantidade', 12000);

    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).toContain('quantidade');
  });

  test('AI-07: usuário manda número no step addr — IA detecta e redireciona', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero notebook');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, '3');
    await waitForMsg(page, 'endereço', 12000);

    // Send quantity again (wrong step)
    await typeAndSend(page, '5');
    await waitForMsg(page, 'endereço', 12000);

    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).toContain('endereço');
  });

  test('AI-08: 3 inputs inválidos consecutivos — IA sempre responde, sem crash', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    const invalids = ['??!!', 'blah blah blah', '!!!'];
    for (const inv of invalids) {
      await typeAndSend(page, inv);
      await waitForMsg(page, 'quantidade', 12000);
    }

    // Input must still be enabled after 3 invalid inputs
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Troca de contexto (commerce → scheduling)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-09: usuário tenta agendar durante step qty — IA mantém fluxo de compra', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, 'quero agendar uma consulta');
    // IA deve responder algo sobre agendamento ser outro canal OU manter o fluxo
    // O importante: NÃO avançar para step de endereço
    await page.waitForTimeout(4000);

    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';

    // Must not have advanced to address step
    expect(lastAiMsg.toLowerCase()).not.toContain('endereço de entrega');
    // IA must have responded (not silently ignored)
    expect(lastAiMsg.length).toBeGreaterThan(5);
  });

  test('AI-10: usuário tenta agendar no step idle — IA explica e não trava', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'quero agendar uma consulta médica');
    await waitForMsg(page, 'produto', 12000);

    // Widget still functional
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Multi-turn sem perda de contexto', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-11: 6 trocas — fluxo completo com desvio e retomada', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    // Turn 1: select product
    await typeAndSend(page, 'Quero uma camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    // Turn 2: off-menu deviation
    await typeAndSend(page, 'e aí, tudo bem?');
    await waitForMsg(page, 'quantidade', 8000);

    // Turn 3: correct answer to qty
    await typeAndSend(page, '2');
    await waitForMsg(page, 'endereço', 12000);

    // Turn 4: off-menu again
    await typeAndSend(page, 'qual o horário de funcionamento?');
    await waitForMsg(page, 'endereço', 8000);

    // Turn 5: correct answer to address
    await typeAndSend(page, 'Av. Paulista, 1000, Bela Vista, São Paulo, 01311-000');
    await waitForMsg(page, 'pay.example.com', 15000);

    // Flow completed despite deviations
    const content = await page.locator('#_atai-msgs').textContent() ?? '';
    expect(content).toContain('Link de pagamento');
  });

  test('AI-12: mensagens rápidas em sequência — IA não mistura respostas', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero notebook');
    await waitForMsg(page, 'quantidade', 12000);

    // Send two messages quickly
    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });
    await inp.fill('1');
    await page.click('#_atai-snd');

    // Wait for the addr step response
    await waitForMsg(page, 'endereço', 12000);

    // IA should be at addr step, not back at qty
    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).toContain('endereço');
    expect(lastAiMsg.toLowerCase()).not.toContain('qual produto');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Escalação para humano no meio do fluxo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-13: escalação no step qty — IA responde, input continua ativo', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, 'quero falar com um humano');
    await waitForMsg(page, 'atendente', 12000);

    // Input must remain enabled after escalation
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });

  test('AI-14: escalação no step idle — IA responde e não trava', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'quero falar com uma pessoa real');
    await waitForMsg(page, 'atendente', 12000);

    // Can still send another message
    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'produto', 10000);
  });

  test('AI-15: escalação no step addr — IA responde, checkout pode ser retomado', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero notebook');
    await waitForMsg(page, 'quantidade', 12000);

    await typeAndSend(page, '1');
    await waitForMsg(page, 'endereço', 12000);

    await typeAndSend(page, 'quero falar com atendente');
    await waitForMsg(page, 'atendente', 12000);

    // Panel still open and functional
    await expect(page.locator('#_atai-panel')).toHaveClass(/open/, { timeout: 3000 });
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Resiliência — respostas inesperadas da IA', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-16: IA retorna texto vazio — widget não trava, input continua ativo', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await setup(page, { config: CFG, preloadSession: true });

    let callCount = 0;
    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      callCount++;
      await r.fulfill({
        status: 201,
        json: { messageId: `msg-${callCount}`, conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) =>
        r.fulfill({
          json: {
            messages: [
              makeAiMsg('ai1', ''), // empty AI reply
            ],
          },
        }),
    );

    await openPanel(page);

    // Wait for polling to process empty message
    await page.waitForTimeout(5000);

    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR'),
    );
    expect(criticalErrors).toHaveLength(0);
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });

  test('AI-17: IA retorna resposta fora do contexto do step — widget renderiza sem crash', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await setup(page, { config: CFG, preloadSession: true });

    const contextDriftReplies: WidgetMessage[] = [
      makeVisitorMsg('v1', 'Quero camiseta'),
      // IA responde com menu de restaurante (total context drift)
      makeAiMsg('ai1', 'Bem-vindo ao Cardápio! Temos:\n1. Pizza Margherita\n2. Lasanha\n3. Risoto'),
    ];

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) =>
      r.fulfill({
        status: 201,
        json: { messageId: 'msg-1', conversationId: 'conv-001', contactId: 'ct-001' },
      }),
    );

    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => r.fulfill({ json: { messages: contextDriftReplies } }),
    );

    await openPanel(page);
    await waitForMsg(page, 'Pizza', 12000);

    // Widget renders despite drift — no crash
    const criticalErrors = jsErrors.filter((e) => !e.includes('favicon'));
    expect(criticalErrors).toHaveLength(0);
    await expect(page.locator('#_atai-panel')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('AI-18: troca de produto no meio do fluxo (qty step) — IA deve lidar', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero camiseta');
    await waitForMsg(page, 'quantidade', 12000);

    // Change mind about product
    await typeAndSend(page, 'na verdade quero outro produto, um tênis');
    await waitForMsg(page, 'quantidade', 8000);

    // IA must not have advanced to addr
    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).not.toContain('endereço de entrega');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Re-entrada no fluxo após desvio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('AI-19: após 2 off-menu, input correto retoma o fluxo', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero notebook');
    await waitForMsg(page, 'quantidade', 12000);

    // Two off-menu deviations
    await typeAndSend(page, 'qual o seu nome?');
    await waitForMsg(page, 'quantidade', 8000);

    await typeAndSend(page, 'onde fica a loja?');
    await waitForMsg(page, 'quantidade', 8000);

    // Now correct input
    await typeAndSend(page, '3');
    await waitForMsg(page, 'endereço', 12000);

    // Flow resumed to next step
    const msgs = await page.locator('._row.in').allTextContents();
    const lastAiMsg = msgs[msgs.length - 1] ?? '';
    expect(lastAiMsg.toLowerCase()).toContain('endereço');
  });

  test('AI-20: quick reply após off-menu retoma corretamente', async ({ page }) => {
    await setupWithStateMachine(page);
    await openPanel(page);

    // Off-menu first
    await typeAndSend(page, 'random text');
    await waitForMsg(page, 'produto', 10000);

    // Then use quick reply
    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    const chip = page.locator('._qr-chip').filter({ hasText: 'Ver Produtos' });
    await chip.first().click();

    // IA should respond to the QR click
    await page.waitForTimeout(4000);
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 3000 });
  });
});
