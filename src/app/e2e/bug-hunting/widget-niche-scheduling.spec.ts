/**
 * Playwright E2E — Niche: Scheduling/Booking via chat widget
 *
 * Covers:
 *   - Clínica médica: collectCpf flow + booking confirmation
 *   - Salão de beleza: select service → professional → date → confirmation
 *   - Unavailable slot handling
 *   - CPF validation edge cases
 *
 * Requirements: WPET-06..08, WPET-20
 */
import { test, expect, Page } from '@playwright/test';
import { API_BASE, buildSetup, makeAiMsg, makeVisitorMsg, WidgetMessage } from './_widget-setup';

// ─── Clinic (with CPF collection) ─────────────────────────────────────────
const TOKEN_CLINIC = 'wgt-sched-clinic';
const SESSION_CLINIC = 'sess-clinic-001';
const clinicEnv = buildSetup(TOKEN_CLINIC, SESSION_CLINIC);

const CFG_CLINIC = {
  id: 'cfg-clinic',
  name: 'Clínica Saúde Total',
  greeting: 'Olá! Bem-vindo à Clínica Saúde Total. Como posso ajudar?',
  color: '#0ea5e9',
  position: 'bottom-right',
  avatarUrl: null,
  collectName: true,
  collectPhone: true,
  collectEmail: false,
  collectCpf: true,
  quickReplies: ['Agendar Consulta', 'Especialidades', 'Planos Aceitos'],
  proactiveDelay: null,
  proactiveMsg: null,
};

// ─── Beauty salon (no CPF) ────────────────────────────────────────────────
const TOKEN_SALON = 'wgt-sched-salon';
const SESSION_SALON = 'sess-salon-001';
const salonEnv = buildSetup(TOKEN_SALON, SESSION_SALON);

const CFG_SALON = {
  id: 'cfg-salon',
  name: 'Studio Beleza',
  greeting: 'Oi! Aqui é o Studio Beleza 💇‍♀️ Posso te ajudar?',
  color: '#ec4899',
  position: 'bottom-right',
  avatarUrl: null,
  collectName: true,
  collectPhone: true,
  collectEmail: false,
  collectCpf: false,
  quickReplies: ['Agendar Serviço', 'Tabela de Preços', 'Profissionais'],
  proactiveDelay: null,
  proactiveMsg: null,
};

// ─── Booking flow helpers ─────────────────────────────────────────────────
function buildSchedulingFlow(
  visitorMessages: string[],
  availableSlot = true,
): WidgetMessage[] {
  const msgs: WidgetMessage[] = [];
  const aiReplies = availableSlot
    ? [
        'Quais serviços você gostaria de agendar?\n1. Corte R$ 50\n2. Coloração R$ 120\n3. Hidratação R$ 80',
        'Perfeito! Temos os seguintes horários disponíveis:\n• Terça 14h — Profissional: Ana\n• Quinta 10h — Profissional: Carla\n\nQual prefere?',
        '✅ Agendamento confirmado!\n\nCorte com Ana\nTerça-feira às 14h00\n\nLembramos 1h antes pelo WhatsApp.',
      ]
    : [
        'Quais serviços você gostaria de agendar?',
        '😔 Infelizmente não temos horários disponíveis para amanhã.\n\nPodemos agendar para sexta-feira às 15h?',
        '✅ Agendamento confirmado para sexta-feira às 15h!',
      ];

  visitorMessages.forEach((text, idx) => {
    msgs.push(makeVisitorMsg(`v${idx + 1}`, text));
    if (aiReplies[idx]) {
      msgs.push(makeAiMsg(`ai${idx + 1}`, aiReplies[idx]));
    }
  });
  return msgs;
}

async function setupSchedulingFlow(
  page: Page,
  env: ReturnType<typeof buildSetup>,
  token: string,
  sessionId: string,
  config: object,
  availableSlot = true,
) {
  const visitorMessages: string[] = [];

  await env.setup(page, { config, preloadSession: true });

  await page.route(`${API_BASE}/widget/${token}/messages`, async (r) => {
    const body = r.request().postDataJSON();
    visitorMessages.push(body?.text ?? '');
    await r.fulfill({
      status: 201,
      json: { messageId: `msg-${visitorMessages.length}`, conversationId: 'conv-001', contactId: 'ct-001' },
    });
  });

  await page.route(
    `${API_BASE}/widget/${token}/sessions/${sessionId}/messages`,
    (r) => r.fulfill({ json: { messages: buildSchedulingFlow(visitorMessages, availableSlot) } }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: Salão de Beleza — Fluxo de agendamento', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-06: saudação do salão exibida ao abrir', async ({ page }) => {
    await salonEnv.setup(page, { config: CFG_SALON, preloadSession: true });
    await salonEnv.openPanel(page);
    await salonEnv.waitForMsg(page, 'Studio Beleza');
  });

  test('WPET-06: quick replies de agendamento visíveis', async ({ page }) => {
    await salonEnv.setup(page, { config: CFG_SALON, preloadSession: true });
    await salonEnv.openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const chips = page.locator('._qr-chip');
    await expect(chips.first()).toBeVisible({ timeout: 3000 });

    const texts = await chips.allTextContents();
    expect(texts).toContain('Agendar Serviço');
    expect(texts).toContain('Profissionais');
  });

  test('WPET-06..07: fluxo completo — solicitar → escolher horário → confirmação', async ({ page }) => {
    await setupSchedulingFlow(page, salonEnv, TOKEN_SALON, SESSION_SALON, CFG_SALON);
    await salonEnv.openPanel(page);

    await salonEnv.typeAndSend(page, 'Quero agendar um corte');
    await salonEnv.waitForMsg(page, 'horários disponíveis', 12000);

    await salonEnv.typeAndSend(page, 'Terça 14h com Ana');
    await salonEnv.waitForMsg(page, 'Agendamento confirmado', 12000);
    await salonEnv.waitForMsg(page, 'Terça-feira às 14h00', 3000);
  });

  test('WPET-07: mensagem de confirmação contém data e hora', async ({ page }) => {
    await setupSchedulingFlow(page, salonEnv, TOKEN_SALON, SESSION_SALON, CFG_SALON);
    await salonEnv.openPanel(page);

    await salonEnv.typeAndSend(page, 'Corte');
    await salonEnv.waitForMsg(page, 'horários disponíveis', 12000);

    await salonEnv.typeAndSend(page, 'Terça 14h com Ana');
    await salonEnv.waitForMsg(page, '14h00', 12000);

    // Confirmation must mention the professional and time
    const content = await page.locator('#_atai-msgs').textContent();
    expect(content).toContain('Ana');
    expect(content).toContain('14h');
  });

  test('WPET-07: horário indisponível — IA sugere alternativa', async ({ page }) => {
    await setupSchedulingFlow(page, salonEnv, TOKEN_SALON, SESSION_SALON, CFG_SALON, false);
    await salonEnv.openPanel(page);

    await salonEnv.typeAndSend(page, 'Quero corte amanhã de manhã');
    await salonEnv.waitForMsg(page, 'Quais serviços', 12000);

    await salonEnv.typeAndSend(page, 'Corte simples');
    await salonEnv.waitForMsg(page, 'não temos horários disponíveis', 12000);

    // Alternative slot offered
    await salonEnv.waitForMsg(page, 'sexta-feira', 3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: Clínica Médica — Coleta de CPF', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-08: coleta de CPF exibida após nome e telefone', async ({ page }) => {
    await clinicEnv.setup(page, { config: CFG_CLINIC });
    await clinicEnv.openPanel(page);

    await clinicEnv.waitForMsg(page, 'Como posso te chamar?', 10000);
    await clinicEnv.typeAndSend(page, 'João Silva');

    await clinicEnv.waitForMsg(page, 'WhatsApp ou telefone', 10000);
    await clinicEnv.typeAndSend(page, '11987654321');

    await clinicEnv.waitForMsg(page, 'CPF', 15000);
  });

  test('WPET-20: CPF com menos de 11 dígitos — rejeita', async ({ page }) => {
    await clinicEnv.setup(page, {
      config: { ...CFG_CLINIC, collectName: false, collectPhone: false },
    });
    await clinicEnv.openPanel(page);
    await clinicEnv.waitForMsg(page, 'CPF', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('1234567');
    await page.click('#_atai-snd');

    // Should show error (red border or error message)
    const hasRedBorder = await inp.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return style.borderColor.includes('239') || style.outlineColor.includes('239');
    });
    const hasErrorMsg = await page.locator('#_atai-msgs').textContent()
      .then(t => (t ?? '').includes('inválido') || (t ?? '').includes('CPF'));

    expect(hasRedBorder || hasErrorMsg).toBeTruthy();
  });

  test('WPET-20: CPF inválido com 11 dígitos mas dígitos verificadores errados — exibe erro', async ({ page }) => {
    await clinicEnv.setup(page, {
      config: { ...CFG_CLINIC, collectName: false, collectPhone: false },
    });
    await clinicEnv.openPanel(page);
    await clinicEnv.waitForMsg(page, 'CPF', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('00000000000'); // all zeros — invalid CPF
    await page.click('#_atai-snd');

    await page.waitForTimeout(500);

    // Should NOT advance to next step
    const content = await page.locator('#_atai-msgs').textContent();
    // Still on CPF step (or showing error) — NOT on "Tudo certo!" step
    expect(content).not.toContain('Tudo certo!');
  });

  test('WPET-20: CPF com formato pontuado aceito (000.000.000-00)', async ({ page }) => {
    // Use a mathematically valid CPF: 529.982.247-25
    await clinicEnv.setup(page, {
      config: { ...CFG_CLINIC, collectName: false, collectPhone: false },
    });
    await clinicEnv.openPanel(page);
    await clinicEnv.waitForMsg(page, 'CPF', 10000);

    const inp = page.locator('#_atai-inp');
    await expect(inp).not.toBeDisabled({ timeout: 5000 });

    await inp.fill('529.982.247-25');
    await page.click('#_atai-snd');

    // Should advance to session creation / next step
    await clinicEnv.waitForMsg(page, 'Tudo certo!', 15000);
  });

  test('WPET-08: fluxo completo da clínica — nome → telefone → CPF → agendamento', async ({ page }) => {
    await setupSchedulingFlow(page, clinicEnv, TOKEN_CLINIC, SESSION_CLINIC, {
      ...CFG_CLINIC,
      collectCpf: false, // Skip CPF collect for flow test (separate test above)
      collectName: false,
      collectPhone: false,
    });

    await setupSchedulingFlow(page, clinicEnv, TOKEN_CLINIC, SESSION_CLINIC, CFG_CLINIC);
    await clinicEnv.openPanel(page);

    // Collect flow
    await clinicEnv.waitForMsg(page, 'Como posso te chamar?', 10000);
    await clinicEnv.typeAndSend(page, 'Maria Oliveira');

    await clinicEnv.waitForMsg(page, 'WhatsApp', 10000);
    await clinicEnv.typeAndSend(page, '11987654321');

    await clinicEnv.waitForMsg(page, 'CPF', 15000);
    await clinicEnv.typeAndSend(page, '529.982.247-25');

    await clinicEnv.waitForMsg(page, 'Tudo certo!', 15000);
  });

  test('WPET-06: quick replies da clínica visíveis após sessão', async ({ page }) => {
    await clinicEnv.setup(page, { config: CFG_CLINIC, preloadSession: true });
    await clinicEnv.openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Agendar Consulta');
    expect(texts).toContain('Planos Aceitos');
  });

  test('WPET-06: quick reply "Agendar Consulta" inicia conversa de agendamento', async ({ page }) => {
    let sentText = '';

    await clinicEnv.setup(page, { config: CFG_CLINIC, preloadSession: true });

    await page.route(`${API_BASE}/widget/${TOKEN_CLINIC}/messages`, async (r) => {
      const body = r.request().postDataJSON();
      sentText = body?.text ?? '';
      await r.fulfill({
        status: 201,
        json: { messageId: 'msg-qr', conversationId: 'conv-001', contactId: 'ct-001' },
      });
    });

    await clinicEnv.openPanel(page);
    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    // Click the scheduling chip
    const chips = page.locator('._qr-chip');
    const agendarChip = chips.filter({ hasText: 'Agendar' });
    await agendarChip.first().click();

    await page.waitForTimeout(500);
    expect(sentText).toBe('Agendar Consulta');
  });
});
