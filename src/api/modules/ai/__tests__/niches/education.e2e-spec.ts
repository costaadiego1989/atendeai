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
 * FLOW-EDU — Education / courses niche (CONSULTATIVE strategy). Course info,
 * enrollment payment link, scheduling a trial, or handoff.
 */
describe('FLOW-EDU niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'EDUCATION',
      description: 'Escola de cursos profissionalizantes.',
      services: 'Cursos de tecnologia e idiomas.',
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
      id: 'edu-1',
      url: 'https://pay.test/edu/1',
    });
    h.reserveSlot.execute.mockReset();
    h.reserveSlot.execute.mockResolvedValue({
      startsAt: '19:00',
      endsAt: '20:00',
      reservedFor: { categoryName: 'Aula experimental' },
      payment: null,
    });
  });

  it('FLOW-EDU-01 course inquiry answered with enroll CTA', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'O curso tem 6 meses. Deseja se matricular?',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'me fale sobre o curso de programacao');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/matricular|curso/i);
  });

  it('FLOW-EDU-02 price question answered', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'O investimento e de 12x de 200.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'qual o valor do curso?');
    expect(res).toEqual({ success: true });
  });

  it('FLOW-EDU-03 enrollment generates a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Otimo! [PAYMENT_LINK: Matricula, 200.00]',
    });
    await sendMessage(h, conv, 'quero me matricular');
    expect(h.paymentLinkGenerator.generate).toHaveBeenCalled();
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/edu/1');
  });

  it('FLOW-EDU-04 trial class booking via schedule tag', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Agendado! [SCHEDULE_SLOT: professionalId=prof-1, date=2026-07-03, slotId=slot-1, payment=free]',
    });
    await sendMessage(h, conv, 'quero uma aula experimental');
    expect(h.reserveSlot.execute).toHaveBeenCalled();
  });

  it('FLOW-EDU-05 out-of-catalog course answered honestly (handoff on low conf)', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Nao temos esse curso.', confidence: 0.1 });
    const res = await sendMessage(h, conv, 'voces tem curso de mergulho?');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-EDU-06 informational answer publishes generated event', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'As aulas sao online e presenciais.', confidence: 0.95 });
    await sendMessage(h, conv, 'as aulas sao online?');
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });

  it('FLOW-EDU-07 complaint about course hands off', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Sinto muito.', intent: 'COMPLAINT', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'o curso foi muito ruim');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-EDU-08 education niche never creates a commerce session', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Posso ajudar com matriculas.', confidence: 0.95 });
    await sendMessage(h, conv, 'quero informacoes de matricula');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });
});
