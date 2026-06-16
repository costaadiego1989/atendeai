import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  findEvent,
  hasEvent,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-HANDOFF — HumanHandoffPolicy. Verifies every escalation trigger
 * (explicit human request, low confidence, complaint intent, negative
 * sentiment), the strict threshold boundary, reason precedence, and the
 * ai.escalation.requested.v1 payload.
 */
const ESCALATION = 'Vou te transferir para um atendente humano agora.';

describe('GUARD-HANDOFF (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'OTHER',
      description: 'Negocio para testes de handoff.',
      confidenceThreshold: 0.5,
      escalationMessage: ESCALATION,
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

  async function send(text: string) {
    const conv = await createConversation(h, tenantId);
    return { conv, res: await sendMessage(h, conv, text) };
  }

  const expectHandoff = (res: { success: boolean; error?: string }) =>
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });

  it('GUARD-HANDOFF-01 "humano" requests handoff', async () => {
    const { res } = await send('quero falar com um humano');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-02 "atendente" requests handoff', async () => {
    const { res } = await send('me passa para um atendente');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-03 "pessoa" requests handoff', async () => {
    const { res } = await send('quero falar com uma pessoa de verdade');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-04 "vendedor" requests handoff', async () => {
    const { res } = await send('chama um vendedor por favor');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-05 "especialista" requests handoff', async () => {
    const { res } = await send('preciso de um especialista');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-06 confidence below threshold hands off', async () => {
    h.engine.enqueue({ text: 'Nao sei bem.', confidence: 0.2 });
    const { res } = await send('uma pergunta dificil');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-07 confidence exactly at threshold does NOT hand off', async () => {
    h.engine.enqueue({ text: 'Resposta ok.', confidence: 0.5 });
    const { res } = await send('uma pergunta simples');
    expect(res).toEqual({ success: true });
  });

  it('GUARD-HANDOFF-08 complaint intent hands off', async () => {
    h.engine.enqueue({ text: 'Sinto muito.', intent: 'COMPLAINT', confidence: 0.95 });
    const { res } = await send('isso e inaceitavel');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-09 negative sentiment hands off', async () => {
    h.engine.enqueue({ text: 'Entendo.', sentiment: 'NEGATIVE', confidence: 0.95 });
    const { res } = await send('estou bravo com o servico');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-10 normal positive turn does not hand off', async () => {
    h.engine.enqueue({ text: 'Que otimo!', confidence: 0.95 });
    const { res } = await send('adorei o atendimento de voces');
    expect(res).toEqual({ success: true });
  });

  it('GUARD-HANDOFF-11 human request wins even with high confidence', async () => {
    h.engine.enqueue({ text: 'Posso ajudar.', confidence: 0.99 });
    const { res } = await send('prefiro um atendente humano');
    expectHandoff(res);
    const ev = findEvent(h.events, 'ai.escalation.requested.v1');
    expect((ev!.payload as { reason: string }).reason).toBe(
      'USER_REQUESTED_HUMAN',
    );
  });

  it('GUARD-HANDOFF-12 low confidence takes precedence over complaint reason', async () => {
    h.engine.enqueue({
      text: 'Hmm.',
      intent: 'COMPLAINT',
      confidence: 0.1,
    });
    await send('algo ambiguo e ruim');
    const ev = findEvent(h.events, 'ai.escalation.requested.v1');
    expect((ev!.payload as { reason: string }).reason).toBe('LOW_CONFIDENCE');
  });

  it('GUARD-HANDOFF-13 handoff emits ai.escalation.requested.v1', async () => {
    await send('quero um atendente');
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('GUARD-HANDOFF-14 escalation event carries configured message', async () => {
    await send('chamar atendente');
    const ev = findEvent(h.events, 'ai.escalation.requested.v1');
    expect((ev!.payload as { escalationMessage: string }).escalationMessage).toBe(
      ESCALATION,
    );
  });

  it('GUARD-HANDOFF-15 keyword match is case-insensitive', async () => {
    const { res } = await send('QUERO UM HUMANO');
    expectHandoff(res);
  });

  it('GUARD-HANDOFF-16 lookalike word does not falsely trigger handoff', async () => {
    h.engine.enqueue({ text: 'A humanidade agradece.', confidence: 0.95 });
    const { res } = await send('voces acreditam na humanidade?');
    expect(res).toEqual({ success: true });
  });

  it('GUARD-HANDOFF-17 escalation event records the last user message', async () => {
    const { conv } = await send('quero atendente humano');
    const ev = findEvent(h.events, 'ai.escalation.requested.v1');
    expect((ev!.payload as { conversationId: string }).conversationId).toBe(
      conv.conversationId,
    );
  });

  it('GUARD-HANDOFF-18 no-handoff turn emits only generated event', async () => {
    h.engine.enqueue({ text: 'Tudo certo!', confidence: 0.95 });
    await send('obrigado pela ajuda');
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(false);
  });
});
