/**
 * Playwright E2E — Niche: E-commerce checkout via chat widget
 *
 * Validates the full commerce conversation flow through the inline widget:
 *   product inquiry → quantity → delivery address → payment link
 *
 * Mocked AI replies simulate AdvanceCommerceConversationUseCase steps.
 * Runs under the 'bug-hunting' project (no auth, all API routes mocked).
 *
 * Requirements: WPET-01..05
 */
import { test, expect, Page } from '@playwright/test';
import { API_BASE, buildSetup, makeAiMsg, makeVisitorMsg, WidgetMessage } from './_widget-setup';

const TOKEN = 'wgt-niche-commerce';
const SESSION_ID = 'sess-commerce-001';

const { setup, openPanel, waitForMsg, typeAndSend } = buildSetup(TOKEN, SESSION_ID);

const CFG_ECOMMERCE = {
  id: 'cfg-ecommerce',
  name: 'Loja Online',
  greeting: 'Olá! Bem-vindo à nossa loja. Em que posso ajudar?',
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

// ─── Commerce AI reply sequence ────────────────────────────────────────────
// Mirrors the server-side CommerceConversationFlowRules steps:
//   IdentifyNeed → SelectingItem → AwaitingQuantity →
//   AwaitingDeliveryAddress → ReadyForCheckout

function buildCommerceConversation(visitorMessages: string[]): WidgetMessage[] {
  const msgs: WidgetMessage[] = [];
  const aiReplies = [
    '✅ Encontrei: Camiseta Básica Tamanho M — R$ 59,90\n\nQual a quantidade desejada?',
    'Perfeito! Subtotal: R$ 119,80\n\nQual o endereço de entrega?\n(Rua, número, bairro, cidade, CEP)',
    '🛒 Pedido confirmado!\n\nLink de pagamento: https://pay.example.com/checkout/abc123\n\nVálido por 30 minutos.',
  ];

  visitorMessages.forEach((text, idx) => {
    msgs.push(makeVisitorMsg(`v${idx + 1}`, text));
    if (aiReplies[idx]) {
      msgs.push(makeAiMsg(`ai${idx + 1}`, aiReplies[idx]));
    }
  });

  return msgs;
}

// ─── Commerce flow helper ──────────────────────────────────────────────────
async function setupCommerceFlow(page: Page) {
  const visitorMessages: string[] = [];

  await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });

  // Track visitor messages and build AI replies after each send
  await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
    const body = r.request().postDataJSON();
    visitorMessages.push(body?.text ?? '');
    await r.fulfill({
      status: 201,
      json: { messageId: `msg-${visitorMessages.length}`, conversationId: 'conv-001', contactId: 'ct-001' },
    });
  });

  // Polling returns updated conversation after each visitor message
  await page.route(
    `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
    (r) => r.fulfill({ json: { messages: buildCommerceConversation(visitorMessages) } }),
  );

  return { visitorMessages };
}

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: E-commerce — Fluxo completo de checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-01: saudação da loja exibida ao abrir', async ({ page }) => {
    await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });
    await openPanel(page);
    await waitForMsg(page, 'Bem-vindo à nossa loja');
  });

  test('WPET-01: quick replies de e-commerce visíveis ao abrir', async ({ page }) => {
    await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    await expect(page.locator('._qr-chip').first()).toContainText('Ver Produtos', { timeout: 3000 });
  });

  test('WPET-01..02: fluxo completo — produto → quantidade → endereço → link pagamento', async ({ page }) => {
    await setupCommerceFlow(page);
    await openPanel(page);

    // Step 1: visitor asks for a product
    await typeAndSend(page, 'Quero comprar uma camiseta tamanho M');
    await waitForMsg(page, 'Qual a quantidade desejada?', 12000);

    // Step 2: visitor sends quantity
    await typeAndSend(page, '2');
    await waitForMsg(page, 'Qual o endereço de entrega?', 12000);

    // Step 3: visitor sends address
    await typeAndSend(page, 'Rua das Flores 123, Copacabana, Rio de Janeiro, 22010-000');
    await waitForMsg(page, 'Link de pagamento', 12000);
    await waitForMsg(page, 'pay.example.com', 3000);
  });

  test('WPET-03: mensagens do visitante aparecem como bolhas "out"', async ({ page }) => {
    await setupCommerceFlow(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero comprar uma camiseta tamanho M');

    const outBubble = page.locator('._row.out ._bub').first();
    await expect(outBubble).toContainText('Quero comprar uma camiseta', { timeout: 3000 });
  });

  test('WPET-04: resposta da IA aparece como bolha "in" com detalhes do produto', async ({ page }) => {
    await setupCommerceFlow(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero comprar uma camiseta tamanho M');

    const inBubble = page.locator('._row.in ._bub').last();
    await expect(inBubble).toContainText('R$ 59,90', { timeout: 12000 });
  });

  test('WPET-05: link de pagamento renderizado sem ser executado como script', async ({ page }) => {
    await setupCommerceFlow(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero comprar uma camiseta tamanho M');
    await waitForMsg(page, 'Qual a quantidade desejada?', 12000);

    await typeAndSend(page, '2');
    await waitForMsg(page, 'Qual o endereço de entrega?', 12000);

    await typeAndSend(page, 'Rua das Flores 123, Copacabana, Rio de Janeiro, 22010-000');
    await waitForMsg(page, 'pay.example.com', 12000);

    // Payment link must be visible text — not a broken DOM or executed code
    const msgs = await page.locator('#_atai-msgs').textContent();
    expect(msgs).toContain('pay.example.com/checkout/abc123');
  });

  test('WPET-05: quantidade inválida (texto) — histórico mostra pedido de IA ainda aguardando', async ({ page }) => {
    const visitorMessages: string[] = [];

    await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });

    // First AI reply asks for quantity; second AI reply repeats the ask (invalid input)
    const invalidQtyReplies: Record<number, string> = {
      1: 'Qual a quantidade desejada?',
      2: 'Por favor, informe um número válido. Quantas unidades deseja?',
    };

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      visitorMessages.push(body?.text ?? '');
      await r.fulfill({
        status: 201,
        json: { messageId: `msg-${visitorMessages.length}`, conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => {
        const msgs: WidgetMessage[] = visitorMessages.flatMap((text, idx) => {
          const items: WidgetMessage[] = [makeVisitorMsg(`v${idx}`, text)];
          const reply = invalidQtyReplies[idx + 1];
          if (reply) items.push(makeAiMsg(`ai${idx}`, reply));
          return items;
        });
        r.fulfill({ json: { messages: msgs } });
      },
    );

    await openPanel(page);

    await typeAndSend(page, 'Quero uma camiseta M');
    await waitForMsg(page, 'Qual a quantidade desejada?', 12000);

    // Send invalid quantity (text instead of number)
    await typeAndSend(page, 'muitas');
    await waitForMsg(page, 'número válido', 12000);
  });

  test('WPET-05: restart no meio do checkout limpa histórico e começa nova sessão', async ({ page }) => {
    await setupCommerceFlow(page);
    await openPanel(page);

    await typeAndSend(page, 'Quero comprar uma camiseta tamanho M');
    await waitForMsg(page, 'Qual a quantidade desejada?', 12000);

    // Abandon checkout — restart
    await page.click('#_atai-rbtn');

    await expect(page.locator('._row.out')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('._row.in')).toHaveCount(0, { timeout: 3000 });

    // sessionId should be cleared from localStorage
    const stored = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      `_atai_sid_${TOKEN}`,
    );
    expect(stored).toBeNull();
  });

  test('WPET-01: quick reply "Ver Produtos" envia texto correto à API', async ({ page }) => {
    let sentText = '';

    await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentText = body?.text ?? '';
      await r.fulfill({
        status: 201,
        json: { messageId: 'msg-qr', conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });
    await page.locator('._qr-chip').first().click();

    await page.waitForTimeout(1000);
    expect(sentText).toBe('Ver Produtos');
  });

  test('múltiplos produtos no mesmo carrinho — conversa continua na mesma sessão', async ({ page }) => {
    const sentMessages: string[] = [];

    await setup(page, { config: CFG_ECOMMERCE, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentMessages.push(body.text);
      await r.fulfill({
        status: 201,
        json: { messageId: `msg-${sentMessages.length}`, conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await page.route(
      `${API_BASE}/widget/${TOKEN}/sessions/${SESSION_ID}/messages`,
      (r) => r.fulfill({ json: { messages: [] } }),
    );

    await openPanel(page);

    await typeAndSend(page, 'Camiseta M');
    await typeAndSend(page, 'Calça Jeans 42');
    await typeAndSend(page, 'Tênis 41');

    await page.waitForTimeout(500);

    // All messages sent to same session — no new session created
    expect(sentMessages).toHaveLength(3);
    expect(sentMessages[0]).toBe('Camiseta M');
    expect(sentMessages[2]).toBe('Tênis 41');
  });
});
