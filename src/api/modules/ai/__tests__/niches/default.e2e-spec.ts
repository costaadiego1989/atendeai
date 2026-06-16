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
 * FLOW-DEF — Default / generic niche (CONSULTATIVE strategy) for unknown or
 * unmapped business types. Conversational answers + safe handoff fallback;
 * never enters the commerce flow.
 */
describe('FLOW-DEF niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'OTHER',
      description: 'Negocio generico.',
      services: 'Atendimento geral.',
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
  });

  it('FLOW-DEF-01 generic greeting answered', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Ola! Como posso ajudar?', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'oi, bom dia');
    expect(res).toEqual({ success: true });
  });

  it('FLOW-DEF-02 generic question answered conversationally', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Funcionamos de seg a sex.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'qual horario voces abrem?');
    expect(res).toEqual({ success: true });
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });

  it('FLOW-DEF-03 off-topic out-of-scope hands off safely', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Nao sei responder isso.', confidence: 0.1 });
    const res = await sendMessage(h, conv, 'me ensina a hackear um sistema');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-DEF-04 explicit human request hands off', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'quero falar com uma pessoa');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-DEF-05 low confidence answer hands off', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Hmm...', confidence: 0.05 });
    const res = await sendMessage(h, conv, 'pergunta muito ambigua aqui');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('FLOW-DEF-06 confident answer is delivered to the user', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Claro, posso ajudar com isso.', confidence: 0.95 });
    await sendMessage(h, conv, 'voces fazem entrega?');
    expect(lastGeneratedText(h.events)).toContain('posso ajudar');
  });

  it('FLOW-DEF-07 default niche never enters the commerce flow', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Posso te ajudar a comprar.', confidence: 0.95 });
    await sendMessage(h, conv, 'quero comprar alguma coisa');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('FLOW-DEF-08 negative sentiment hands off', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Lamento o ocorrido.',
      sentiment: 'NEGATIVE',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'estou decepcionado com voces');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });
});
