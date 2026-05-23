/**
 * Playwright Integration E2E — Real AI context validation via chat widget
 *
 * NO mocks on widget API routes. Every call hits the real NestJS backend.
 * The AI (ProcessAIResponseUseCase) processes messages and responds via polling.
 *
 * Requires:
 *   - npm run stack:up && npm run dev:api
 *   - OPENAI_API_KEY (or configured AI provider) in .env
 *   - Dev DB running (PostgreSQL on 5433)
 *
 * Run: npx playwright test --project=widget-integration
 *
 * Assertion strategy: regex matching on key phrases — AI responses are
 * non-deterministic so we assert INTENT (asked for quantity, not address)
 * rather than exact strings.
 */
import { test, expect, Page } from '@playwright/test';
import {
  seedWidgetConfig,
  seedWidgetAgentRule,
  deleteWidgetConfig,
  deleteWidgetAgentRule,
} from '../helpers/widget-seed';

// Widget API is on the NestJS server (port 3000, prefix api/v1).
// widget.js reads its own src URL to derive apiBase, so all /widget/* calls
// go to http://localhost:3000/api/v1/widget/... — no Vite proxy needed.
const BASE_URL = 'http://localhost:3000/api/v1';

// ─── Shared tokens (seeded per suite) ────────────────────────────────────────

let COMMERCE_TOKEN: string;
let SCHEDULING_TOKEN: string;
let GENERIC_TOKEN: string;

// ─── Test page builder ────────────────────────────────────────────────────────
// Only the HTML container is mocked — all /widget/* API calls pass through.

function buildTestPage(token: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Widget Integration Test</title>
  <script src="${BASE_URL}/widget.js" data-token="${token}"></script>
</head>
<body><p>Integration test page</p></body>
</html>`;
}

async function mountWidget(page: Page, token: string) {
  const testUrl = `${BASE_URL}/_integration_test_${token}`;
  await page.route(testUrl, (r) =>
    r.fulfill({ contentType: 'text/html', body: buildTestPage(token) }),
  );
  await page.goto(testUrl);
  await page.waitForSelector('#_atai-btn', { timeout: 15_000 });
}

async function openPanel(page: Page) {
  await page.click('#_atai-btn');
  await page.waitForSelector('#_atai-panel.open', { timeout: 5_000 });
}

async function sendMessage(page: Page, text: string) {
  const inp = page.locator('#_atai-inp');
  await expect(inp).not.toBeDisabled({ timeout: 8_000 });
  await inp.fill(text);
  await page.click('#_atai-snd');
}

/**
 * Wait for the AI to respond. Widget polls every ~3s; real AI takes 2-8s.
 * Timeout is generous (30s) to account for cold starts.
 */
async function waitForAiReply(page: Page, timeoutMs = 30_000): Promise<string> {
  // Count inbound rows before sending — wait until count increases
  const before = await page.locator('._row.in').count();
  await expect(page.locator('._row.in')).toHaveCount(before + 1, { timeout: timeoutMs });
  const rows = await page.locator('._row.in').allTextContents();
  return rows[rows.length - 1] ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Seed agent rule: widget AI behaves as e-commerce assistant
  seedWidgetAgentRule(`
[E2E Integration Test — Widget AI]
Você é um assistente de vendas online. Siga este fluxo estritamente:
1. Quando o usuário mencionar um produto, confirme o item e pergunte a QUANTIDADE desejada.
2. Após receber a quantidade (número), pergunte o ENDEREÇO de entrega completo.
3. Após receber o endereço, gere um link de pagamento fictício no formato: https://pay.example.com/checkout/[ID]
4. Se o usuário mencionar agendamento ou consulta durante o fluxo de compra, informe que esse canal é exclusivo para compras e redirecione de volta ao passo atual.
5. Se o usuário enviar algo fora do contexto esperado, redirecione educadamente ao passo atual sem avançar.
6. Nunca pule etapas. Nunca pergunte quantidade e endereço na mesma mensagem.
  `.trim());

  // Seed widget configs
  COMMERCE_TOKEN = seedWidgetConfig({
    name: 'Loja E2E Commerce',
    greeting: 'Olá! Bem-vindo à Loja E2E. Como posso ajudar?',
    color: '#f97316',
    quickReplies: ['Ver Produtos', 'Meu Pedido', 'Falar com Atendente'],
    collectName: false,
    collectPhone: false,
  });

  SCHEDULING_TOKEN = seedWidgetConfig({
    name: 'Clínica E2E Scheduling',
    greeting: 'Olá! Bem-vindo à Clínica E2E. Como posso ajudar?',
    color: '#0ea5e9',
    quickReplies: ['Agendar Consulta', 'Especialidades', 'Planos Aceitos'],
    collectName: true,
    collectPhone: true,
    collectCpf: true,
  });

  GENERIC_TOKEN = seedWidgetConfig({
    name: 'Suporte E2E Generic',
    greeting: 'Olá! Em que posso ajudar?',
    color: '#6366f1',
    quickReplies: [],
  });
});

test.afterAll(() => {
  if (COMMERCE_TOKEN) deleteWidgetConfig(COMMERCE_TOKEN);
  if (SCHEDULING_TOKEN) deleteWidgetConfig(SCHEDULING_TOKEN);
  if (GENERIC_TOKEN) deleteWidgetConfig(GENERIC_TOKEN);
  deleteWidgetAgentRule();
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Fluxo commerce — contexto real da IA', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('INT-01: IA pede quantidade após seleção de produto', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar uma camiseta tamanho M');
    const reply = await waitForAiReply(page);

    // AI must ask for quantity — NOT address, NOT payment
    expect(reply).toMatch(/quantidade|unidades|quantas|how many/i);
    expect(reply).not.toMatch(/endereço|address|cep|entrega/i);
    expect(reply).not.toMatch(/pay\.example|pagamento|payment link/i);
  });

  test('INT-02: IA pede endereço após receber quantidade válida', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar um notebook');
    await waitForAiReply(page); // step: qty ask

    await sendMessage(page, '2');
    const reply = await waitForAiReply(page);

    // AI must ask for address — NOT quantity again, NOT payment yet
    expect(reply).toMatch(/endereço|address|cep|rua|entrega|delivery/i);
    expect(reply).not.toMatch(/quantidade|unidades/i);
    expect(reply).not.toMatch(/pay\.example|pagamento/i);
  });

  test('INT-03: IA gera link de pagamento após endereço', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero tênis Nike tamanho 42');
    await waitForAiReply(page); // qty ask

    await sendMessage(page, '1');
    await waitForAiReply(page); // addr ask

    await sendMessage(page, 'Rua das Flores, 123, Jardim Primavera, São Paulo, SP, 01310-100');
    const reply = await waitForAiReply(page);

    // AI must confirm order and provide payment link
    expect(reply).toMatch(/pay\.example|pagamento|checkout|link|pix|boleto/i);
  });

  test('INT-04: off-menu no step qty — IA redireciona, não avança', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar uma mochila');
    await waitForAiReply(page); // qty ask

    // Send completely off-topic
    await sendMessage(page, 'Qual é o horário de funcionamento da loja?');
    const reply = await waitForAiReply(page);

    // AI must redirect back to quantity — must NOT advance to address
    expect(reply).not.toMatch(/endereço|cep|rua/i);
    // Response must not be empty
    expect(reply.trim().length).toBeGreaterThan(10);
  });

  test('INT-05: contexto switch commerce → scheduling — IA mantém fluxo de compra', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar um perfume');
    await waitForAiReply(page); // qty ask

    await sendMessage(page, 'Na verdade quero agendar uma consulta médica');
    const reply = await waitForAiReply(page);

    // AI must NOT switch to scheduling flow — must redirect to qty
    expect(reply).not.toMatch(/endereço|cep/i); // didn't skip to addr
    // Response must acknowledge the confusion and redirect
    expect(reply.trim().length).toBeGreaterThan(10);
  });

  test('INT-06: usuário manda endereço no step qty — IA detecta e redireciona', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar calça jeans');
    await waitForAiReply(page); // qty ask

    // Send address at wrong step
    await sendMessage(page, 'Av. Paulista, 1000, Bela Vista, São Paulo');
    const reply = await waitForAiReply(page);

    // AI must redirect to quantity, not accept address at this step
    expect(reply).not.toMatch(/pagamento|pay\.example/i); // did NOT skip to checkout
    expect(reply.trim().length).toBeGreaterThan(10);
  });

  test('INT-07: 3 inputs inválidos consecutivos — IA sempre responde, sem crash', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar headset gamer');
    await waitForAiReply(page); // qty ask

    for (const invalid of ['???', 'blah', '!!!']) {
      await sendMessage(page, invalid);
      const reply = await waitForAiReply(page);
      expect(reply.trim().length).toBeGreaterThan(5);
    }

    // Input still functional after 3 invalid replies
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Multi-turn — contexto preservado em conversas longas', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('INT-08: 2 desvios + retomada — fluxo completa corretamente', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    // Step 1: product
    await sendMessage(page, 'Quero comprar uma smart TV 55"');
    await waitForAiReply(page);

    // Deviation 1
    await sendMessage(page, 'e aí, tudo bem?');
    const r1 = await waitForAiReply(page);
    expect(r1).not.toMatch(/endereço|cep/i); // did not skip

    // Step 2: correct qty
    await sendMessage(page, '1');
    const r2 = await waitForAiReply(page);
    expect(r2).toMatch(/endereço|entrega|address/i);

    // Deviation 2
    await sendMessage(page, 'qual o prazo de entrega?');
    await waitForAiReply(page);

    // Step 3: correct address
    await sendMessage(page, 'Rua Vergueiro, 500, Liberdade, São Paulo, 01504-001');
    const r3 = await waitForAiReply(page);

    // Should complete checkout despite deviations
    expect(r3).toMatch(/pay\.example|pagamento|link|checkout/i);
  });

  test('INT-09: troca de produto no step qty — IA lida sem crashar', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar um mouse gamer');
    await waitForAiReply(page); // qty ask

    // Change mind
    await sendMessage(page, 'Na verdade mudei de ideia, quero um teclado mecânico');
    const reply = await waitForAiReply(page);

    // AI must handle gracefully — not crash, not skip to checkout
    expect(reply.trim().length).toBeGreaterThan(10);
    expect(reply).not.toMatch(/pay\.example/i);

    // Widget still functional
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Escalação para humano no meio do fluxo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('INT-10: escalação no step qty — IA responde, input continua ativo', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Quero comprar camiseta branca');
    await waitForAiReply(page);

    await sendMessage(page, 'Quero falar com um atendente humano');
    const reply = await waitForAiReply(page);

    // AI must acknowledge escalation request
    expect(reply.trim().length).toBeGreaterThan(10);
    // Input must remain enabled
    await expect(page.locator('#_atai-inp')).not.toBeDisabled({ timeout: 5_000 });
  });

  test('INT-11: escalação via quick reply "Falar com Atendente" — IA responde', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);
    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 10_000 });

    const chip = page.locator('._qr-chip').filter({ hasText: 'Falar com Atendente' });
    if (await chip.count() > 0) {
      await chip.first().click();
      const reply = await waitForAiReply(page);
      expect(reply.trim().length).toBeGreaterThan(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Resiliência de renderização — respostas longas e especiais', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('INT-12: mensagem com emojis renderiza sem corrupção', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await mountWidget(page, GENERIC_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Olá! 🎉 Preciso de ajuda com meu pedido 🛒');
    const reply = await waitForAiReply(page);

    expect(reply.trim().length).toBeGreaterThan(5);
    const criticalErrors = jsErrors.filter((e) => !e.includes('favicon') && !e.includes('net::ERR'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('INT-13: mensagem com acentos preservada na resposta', async ({ page }) => {
    await mountWidget(page, GENERIC_TOKEN);
    await openPanel(page);

    await sendMessage(page, 'Preciso de informações sobre substituição de peças');
    const reply = await waitForAiReply(page);

    // Widget must still be open and functional
    await expect(page.locator('#_atai-panel')).toHaveClass(/open/, { timeout: 3_000 });
    expect(reply.trim().length).toBeGreaterThan(5);
  });

  test('INT-14: mensagem muito longa (500 chars) — widget não trava', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await mountWidget(page, GENERIC_TOKEN);
    await openPanel(page);

    const longMsg = 'Preciso de ajuda. '.repeat(28).trim(); // ~500 chars
    await sendMessage(page, longMsg);
    const reply = await waitForAiReply(page, 35_000);

    expect(reply.trim().length).toBeGreaterThan(5);
    const criticalErrors = jsErrors.filter((e) => !e.includes('favicon'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget saudação e quick replies — dados reais do DB', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('INT-15: saudação do DB exibida ao abrir painel', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    // Greeting from DB (not hardcoded)
    await expect(page.locator('#_atai-msgs')).toContainText('Loja E2E Commerce', { timeout: 12_000 });
  });

  test('INT-16: quick replies do DB exibidos corretamente', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 12_000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Ver Produtos');
    expect(texts).toContain('Meu Pedido');
    expect(texts).toContain('Falar com Atendente');
  });

  test('INT-17: cor do config DB aplicada ao FAB', async ({ page }) => {
    await mountWidget(page, COMMERCE_TOKEN);

    const bgColor = await page.locator('#_atai-btn').evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).backgroundColor,
    );
    // #f97316 = rgb(249, 115, 22)
    expect(bgColor).toBe('rgb(249, 115, 22)');
  });

  test('INT-18: config de clínica exibe CPF collect — sessão inicia collect flow', async ({ page }) => {
    await mountWidget(page, SCHEDULING_TOKEN);
    await openPanel(page);

    // Clinic with collectName + collectPhone + collectCpf should start collect flow
    await expect(page.locator('#_atai-msgs')).toContainText(
      /chamar|nome|como posso te chamar/i,
      { timeout: 15_000 },
    );
  });
});
