import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  hasEvent,
  lastGeneratedText,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-REC — Recovery / collections niche (RECOVERY strategy). Conclusion is a
 * payment link generated via the [PAYMENT_LINK:name,value] tag, or a handoff.
 */
describe('FLOW-REC niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RECOVERY',
      description: 'Setor de cobranca e recuperacao de credito.',
      services: 'Negociacao de dividas.',
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
      id: 'rec-link-1',
      url: 'https://pay.test/recovery/1',
    });
  });

  it('FLOW-REC-01 debtor gets a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Segue o link. [PAYMENT_LINK: Acordo, 250.00]' });
    const res = await sendMessage(h, conv, 'quero pagar minha divida');
    expect(res).toEqual({ success: true });
    expect(h.paymentLinkGenerator.generate).toHaveBeenCalledTimes(1);
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/recovery/1');
  });

  it('FLOW-REC-02 already-paid debtor gets info without a new link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Sua divida ja consta como quitada, obrigado!',
      confidence: 0.95,
    });
    await sendMessage(h, conv, 'ja paguei isso mes passado');
    expect(h.paymentLinkGenerator.generate).not.toHaveBeenCalled();
  });

  it('FLOW-REC-03 partial agreement generates a link for the agreed value', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Fechado. [PAYMENT_LINK: Entrada acordo, 100.00]' });
    await sendMessage(h, conv, 'consigo pagar so uma entrada agora');
    const arg = h.paymentLinkGenerator.generate.mock.calls[0][0];
    expect(arg.value).toBeCloseTo(100, 1);
  });

  it('FLOW-REC-04 payment link failure degrades gracefully', async () => {
    const conv = await createConversation(h, tenantId);
    h.paymentLinkGenerator.generate.mockRejectedValueOnce(
      new Error('provider down'),
    );
    h.engine.enqueue({ text: '[PAYMENT_LINK: Acordo, 250.00]' });
    const res = await sendMessage(h, conv, 'quero pagar agora');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/indisponível|aguarde/i);
  });

  it('FLOW-REC-05 installment negotiation request hands off to a human', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(
      h,
      conv,
      'quero negociar parcelado com um atendente',
    );
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-REC-06 invalid amount tag does not call the generator', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: '[PAYMENT_LINK: Acordo, abc]', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'quanto eu devo?');
    expect(res).toEqual({ success: true });
    expect(h.paymentLinkGenerator.generate).not.toHaveBeenCalled();
  });

  it('FLOW-REC-07 debtor disputing the debt (negative) hands off', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Entendo, vou verificar.',
      sentiment: 'NEGATIVE',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'eu nao devo nada disso, e um absurdo');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-REC-08 choosing one of multiple debts links the right amount', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Certo, a fatura 2. [PAYMENT_LINK: Fatura 2, 380.50]',
    });
    await sendMessage(h, conv, 'quero pagar a segunda fatura');
    const arg = h.paymentLinkGenerator.generate.mock.calls[0][0];
    expect(arg.value).toBeCloseTo(380.5, 1);
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });
});
