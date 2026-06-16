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
 * FLOW-B2B — B2B niche (CONSULTATIVE strategy). Quote / proposal capture,
 * sales-rep handoff, deposit payment link, multi-turn context.
 */
describe('FLOW-B2B niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'B2B',
      description: 'Distribuidora B2B de insumos.',
      services: 'Vendas corporativas em volume.',
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
      id: 'b2b-1',
      url: 'https://pay.test/b2b/1',
    });
  });

  it('FLOW-B2B-01 bulk quote request answered with proposal CTA', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Posso montar uma proposta para esse volume.',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'preciso de 500 unidades');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/proposta/i);
  });

  it('FLOW-B2B-02 technical spec question answered', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'A especificacao tecnica e essa.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'qual a ficha tecnica do produto?');
    expect(res).toEqual({ success: true });
  });

  it('FLOW-B2B-03 sales rep request hands off', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'quero falar com um vendedor');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('FLOW-B2B-04 pricing-tier negotiation escalates on low confidence', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Preciso confirmar isso.', confidence: 0.1 });
    const res = await sendMessage(h, conv, 'consigo um desconto especial?');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-B2B-05 out-of-scope contract question does not fabricate', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Vou encaminhar para o juridico.', confidence: 0.2 });
    const res = await sendMessage(h, conv, 'preciso de uma clausula de NDA custom');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-B2B-06 deposit/invoice generates a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Segue o link do sinal. [PAYMENT_LINK: Sinal pedido, 1500.00]',
    });
    await sendMessage(h, conv, 'quero pagar o sinal do pedido');
    expect(h.paymentLinkGenerator.generate).toHaveBeenCalled();
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/b2b/1');
  });

  it('FLOW-B2B-07 multi-turn keeps history context for the model', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue(
      { text: 'Claro, qual o volume?', confidence: 0.95 },
      { text: 'Para 1000 unidades temos desconto.', confidence: 0.95 },
    );
    await sendMessage(h, conv, 'quero comprar em grande quantidade');
    await sendMessage(h, conv, '1000 unidades');
    const secondRequest = h.engine.requests[1];
    expect(secondRequest.contextHistory.length).toBeGreaterThan(0);
  });

  it('FLOW-B2B-08 B2B niche never creates a commerce session', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Posso ajudar com seu pedido corporativo.', confidence: 0.95 });
    await sendMessage(h, conv, 'quero fazer um pedido grande');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });
});
