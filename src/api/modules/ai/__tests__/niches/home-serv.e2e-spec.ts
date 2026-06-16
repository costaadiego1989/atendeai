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
 * FLOW-HOM — Professional / home services niche (CONSULTATIVE strategy).
 * Conclusion is a qualified answer + CTA, an optional payment link, or handoff.
 * Never enters the commerce state machine.
 */
describe('FLOW-HOM niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'LEGAL',
      description: 'Escritorio de advocacia.',
      services: 'Consultoria juridica.',
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
      id: 'hom-1',
      url: 'https://pay.test/hom/1',
    });
  });

  it('FLOW-HOM-01 legal question answered with a consult CTA', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Posso te orientar. Deseja agendar uma consulta?',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'tenho uma duvida trabalhista');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/consulta/i);
  });

  it('FLOW-HOM-02 real-estate inquiry answered conversationally', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Temos imoveis disponiveis na regiao.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'quero saber sobre imoveis');
    expect(res).toEqual({ success: true });
  });

  it('FLOW-HOM-03 automotive quote request answered', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Posso preparar um orcamento.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'quero um orcamento de funilaria');
    expect(res).toEqual({ success: true });
  });

  it('FLOW-HOM-04 out-of-scope question does not hallucinate (handoff)', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Nao tenho essa informacao.', confidence: 0.2 });
    const res = await sendMessage(h, conv, 'qual a capital da mongolia?');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-HOM-05 consultative niche never creates a commerce session', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Como posso ajudar?', confidence: 0.95 });
    await sendMessage(h, conv, 'quero contratar um servico');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('FLOW-HOM-06 low-confidence answer triggers handoff', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Talvez...', confidence: 0.1 });
    const res = await sendMessage(h, conv, 'pergunta juridica muito especifica');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('FLOW-HOM-07 explicit specialist request hands off', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'quero falar com um especialista');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-HOM-08 service deposit produces a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Para reservar, segue o link. [PAYMENT_LINK: Honorarios, 500.00]',
    });
    await sendMessage(h, conv, 'quero contratar e pagar a entrada');
    expect(h.paymentLinkGenerator.generate).toHaveBeenCalled();
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/hom/1');
  });
});
