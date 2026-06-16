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
 * FLOW-HLT — Health & Scheduling niche (SCHEDULING strategy). Conclusion is a
 * reserved slot via the [SCHEDULE_SLOT:...] action tag handled by
 * AIResponseProcessor → RESERVE_PROFESSIONAL_SLOT, or a human handoff.
 */
describe('FLOW-HLT niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  const SLOT_TAG =
    '[SCHEDULE_SLOT: professionalId=prof-1, date=2026-07-01, slotId=slot-1, payment=free]';
  const SLOT_TAG_PAID =
    '[SCHEDULE_SLOT: professionalId=prof-1, date=2026-07-01, slotId=slot-1, payment=required, paymentTimeoutHours=3]';
  const SLOT_TAG_INVALID = '[SCHEDULE_SLOT: professionalId=prof-1, date=2026-07-01]';

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'HEALTH',
      description: 'Clinica medica com agendamento.',
      services: 'Consultas e exames.',
      confidenceThreshold: 0.5,
      escalationMessage: 'Vou transferir para a recepcao.',
    }));
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.reserveSlot.execute.mockReset();
    h.reserveSlot.execute.mockResolvedValue({
      startsAt: '09:00',
      endsAt: '09:30',
      label: 'Consulta',
      status: 'RESERVED',
      reservedFor: { categoryName: 'Consulta' },
      payment: null,
    });
  });

  it('FLOW-HLT-01 free booking is confirmed via slot reservation', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: `Vou reservar. ${SLOT_TAG}` });
    const res = await sendMessage(h, conv, 'quero marcar uma consulta');
    expect(res).toEqual({ success: true });
    expect(h.reserveSlot.execute).toHaveBeenCalledTimes(1);
    expect(lastGeneratedText(h.events)).toMatch(/agendamento|confirmado/i);
  });

  it('FLOW-HLT-02 paid booking returns a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockResolvedValueOnce({
      startsAt: '10:00',
      endsAt: '10:30',
      label: 'Consulta',
      reservedFor: { categoryName: 'Consulta' },
      payment: { linkUrl: 'https://pay.test/slot/1', status: 'PENDING' },
    });
    h.engine.enqueue({ text: `Pre-reservei. ${SLOT_TAG_PAID}` });
    await sendMessage(h, conv, 'quero agendar consulta particular');
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/slot/1');
  });

  it('FLOW-HLT-03 free booking does not include a payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: SLOT_TAG });
    await sendMessage(h, conv, 'agendar consulta pelo convenio');
    const reserveArg = h.reserveSlot.execute.mock.calls[0][0];
    expect(reserveArg.isFree).toBe(true);
    expect(lastGeneratedText(h.events)).not.toContain('pagar');
  });

  it('FLOW-HLT-04 taken slot falls back gracefully to a handoff message', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockRejectedValueOnce(new Error('slot already taken'));
    h.engine.enqueue({ text: SLOT_TAG });
    const res = await sendMessage(h, conv, 'marcar consulta amanha cedo');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/atendente|não consegui/i);
  });

  it('FLOW-HLT-05 missing agenda configuration falls back', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockRejectedValueOnce(
      new Error('professional has no agenda'),
    );
    h.engine.enqueue({ text: SLOT_TAG });
    await sendMessage(h, conv, 'quero marcar com a doutora');
    expect(lastGeneratedText(h.events)).toMatch(/atendente|não consegui/i);
  });

  it('FLOW-HLT-06 invalid schedule payload is caught and falls back', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: `Reservando ${SLOT_TAG_INVALID}` });
    const res = await sendMessage(h, conv, 'agendar exame');
    expect(res).toEqual({ success: true });
    expect(h.reserveSlot.execute).not.toHaveBeenCalled();
    expect(lastGeneratedText(h.events)).toMatch(/atendente|não consegui/i);
  });

  it('FLOW-HLT-07 explicit human request triggers handoff', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'quero falar com um atendente');
    expect(res).toEqual({
      success: false,
      error: 'HANDOFF_REQUIRED',
      message: 'Escalated to human.',
    });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('FLOW-HLT-08 low confidence answer triggers handoff', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Não tenho certeza...', confidence: 0.1 });
    const res = await sendMessage(h, conv, 'tenho uma duvida clinica complexa');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
  });

  it('FLOW-HLT-09 complaint intent triggers handoff', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Sinto muito pelo ocorrido.',
      intent: 'COMPLAINT',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'o atendimento foi pessimo');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-HLT-10 negative sentiment triggers handoff', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Entendo sua frustracao.',
      sentiment: 'NEGATIVE',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'estou muito insatisfeito');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
  });

  it('FLOW-HLT-11 informational question answered conversationally', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({
      text: 'Atendemos de segunda a sexta, das 8h as 18h.',
      confidence: 0.95,
    });
    const res = await sendMessage(h, conv, 'qual o horario de funcionamento?');
    expect(res).toEqual({ success: true });
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });

  it('FLOW-HLT-12 scheduling niche never creates a commerce session', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Posso ajudar a agendar.' });
    await sendMessage(h, conv, 'quero marcar consulta');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });
});
