import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  findEvent,
  hasEvent,
  lastGeneratedText,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-RESIL — provider resilience. LLM failures must degrade to a friendly
 * fallback, emit ai.response.failed.v1, and never freeze the conversation.
 * Action-tag side-effect failures must also degrade gracefully.
 */
describe('GUARD-RESIL (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RECOVERY',
      description: 'Negocio para testes de resiliencia.',
      confidenceThreshold: 0.5,
    }));
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.paymentLinkGenerator.generate.mockReset();
    h.paymentLinkGenerator.generate.mockResolvedValue({
      id: 'r-1',
      url: 'https://pay.test/r/1',
    });
    h.reserveSlot.execute.mockReset();
    h.reserveSlot.execute.mockResolvedValue({
      startsAt: '09:00',
      endsAt: '09:30',
      reservedFor: { categoryName: 'Servico' },
      payment: null,
    });
  });

  async function send(text: string) {
    const conv = await createConversation(h, tenantId);
    return sendMessage(h, conv, text);
  }

  it('GUARD-RESIL-01 generic provider error returns AI_PROVIDER_ERROR', async () => {
    h.engine.failNext(new Error('Provider Offline'));
    const res = await send('ola');
    expect(res).toMatchObject({ success: false, error: 'AI_PROVIDER_ERROR' });
  });

  it('GUARD-RESIL-02 429 rate-limit emits ai.response.failed.v1', async () => {
    h.engine.failNext(new Error('Request failed with status code 429'));
    await send('ola');
    expect(hasEvent(h.events, 'ai.response.failed.v1')).toBe(true);
  });

  it('GUARD-RESIL-03 503 unavailable emits failed event', async () => {
    h.engine.failNext(new Error('Service Unavailable 503'));
    await send('ola');
    expect(hasEvent(h.events, 'ai.response.failed.v1')).toBe(true);
  });

  it('GUARD-RESIL-04 timeout degrades without throwing', async () => {
    h.engine.failNext(new Error('timeout of 120000ms exceeded'));
    const res = await send('ola');
    expect(res.success).toBe(false);
  });

  it('GUARD-RESIL-05 failed event carries a friendly fallback message', async () => {
    h.engine.failNext(new Error('boom'));
    await send('ola');
    const ev = findEvent(h.events, 'ai.response.failed.v1');
    const payload = ev!.payload as { fallbackMessage: string };
    expect(payload.fallbackMessage).toMatch(/instabilidades/i);
  });

  it('GUARD-RESIL-06 failed event carries tenant + conversation context', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.failNext(new Error('boom'));
    await sendMessage(h, conv, 'ola');
    const ev = findEvent(h.events, 'ai.response.failed.v1');
    const payload = ev!.payload as {
      tenantId: string;
      conversationId: string;
    };
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.conversationId).toBe(conv.conversationId);
  });

  it('GUARD-RESIL-07 failed event records the provider', async () => {
    h.engine.failNext(new Error('boom'));
    await send('ola');
    const ev = findEvent(h.events, 'ai.response.failed.v1');
    expect((ev!.payload as { provider: string }).provider).toBe('deepseek');
  });

  it('GUARD-RESIL-08 provider failure produces no generated event', async () => {
    h.engine.failNext(new Error('boom'));
    await send('ola');
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(false);
  });

  it('GUARD-RESIL-09 conversation is not frozen after a failure', async () => {
    h.engine.failNext(new Error('boom'));
    const conv = await createConversation(h, tenantId);
    const failed = await sendMessage(h, conv, 'ola');
    expect(failed.success).toBe(false);

    h.engine.enqueue({ text: 'Voltamos!', confidence: 0.95 });
    const ok = await sendMessage(h, conv, 'ainda esta ai?');
    expect(ok).toEqual({ success: true });
  });

  it('GUARD-RESIL-10 payment-link generation failure degrades gracefully', async () => {
    h.paymentLinkGenerator.generate.mockRejectedValueOnce(new Error('down'));
    h.engine.enqueue({ text: '[PAYMENT_LINK: Acordo, 100.00]' });
    const res = await send('quero pagar');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/indisponível|aguarde/i);
  });

  it('GUARD-RESIL-11 schedule reservation failure degrades gracefully', async () => {
    h.reserveSlot.execute.mockRejectedValueOnce(new Error('no slot'));
    h.engine.enqueue({
      text: '[SCHEDULE_SLOT: professionalId=p1, date=2026-07-01, slotId=s1, payment=free]',
    });
    const res = await send('quero agendar');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/atendente|não consegui/i);
  });

  it('GUARD-RESIL-12 malformed empty LLM text still completes the turn', async () => {
    h.engine.enqueue({ text: '', confidence: 0.95 });
    const res = await send('ola');
    expect(res).toEqual({ success: true });
  });
});
