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
 * FLOW-BTY — Beauty / Pet / Gym niche (SCHEDULING strategy). Slot reservation
 * via [SCHEDULE_SLOT:...] or handoff.
 */
describe('FLOW-BTY niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  const SLOT = (extra = '') =>
    `[SCHEDULE_SLOT: professionalId=prof-1, date=2026-07-02, slotId=slot-9${extra}]`;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'BEAUTY',
      description: 'Salao de beleza com agendamento.',
      services: 'Corte, barba, manicure.',
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
    h.reserveSlot.execute.mockReset();
    h.reserveSlot.execute.mockResolvedValue({
      startsAt: '14:00',
      endsAt: '14:45',
      label: 'Corte',
      status: 'RESERVED',
      reservedFor: { categoryName: 'Corte' },
      payment: null,
    });
  });

  it('FLOW-BTY-01 salon booking confirmed', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: `Agendando ${SLOT(', payment=free')}` });
    const res = await sendMessage(h, conv, 'quero agendar um corte');
    expect(res).toEqual({ success: true });
    expect(h.reserveSlot.execute).toHaveBeenCalledTimes(1);
    expect(lastGeneratedText(h.events)).toMatch(/agendamento|confirmado/i);
  });

  it('FLOW-BTY-02 pet grooming booking confirmed', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: `Reservado ${SLOT(', payment=free')}` });
    await sendMessage(h, conv, 'banho e tosa para meu cachorro');
    expect(h.reserveSlot.execute).toHaveBeenCalled();
  });

  it('FLOW-BTY-03 gym trial booking is free', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: SLOT(', payment=free') });
    await sendMessage(h, conv, 'quero uma aula experimental');
    expect(h.reserveSlot.execute.mock.calls[0][0].isFree).toBe(true);
  });

  it('FLOW-BTY-04 paid service returns payment link', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockResolvedValueOnce({
      startsAt: '15:00',
      endsAt: '16:00',
      reservedFor: { categoryName: 'Coloracao' },
      payment: { linkUrl: 'https://pay.test/beauty/1', status: 'PENDING' },
    });
    h.engine.enqueue({ text: SLOT(', payment=required, paymentTimeoutHours=2') });
    await sendMessage(h, conv, 'quero agendar coloracao');
    expect(lastGeneratedText(h.events)).toContain('https://pay.test/beauty/1');
  });

  it('FLOW-BTY-05 unavailable slot falls back gracefully', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockRejectedValueOnce(new Error('no slot'));
    h.engine.enqueue({ text: SLOT(', payment=free') });
    await sendMessage(h, conv, 'agendar corte hoje');
    expect(lastGeneratedText(h.events)).toMatch(/atendente|não consegui/i);
  });

  it('FLOW-BTY-06 paid service forwards payment timeout hours', async () => {
    const conv = await createConversation(h, tenantId);
    h.reserveSlot.execute.mockResolvedValueOnce({
      startsAt: '11:00',
      endsAt: '11:30',
      reservedFor: { categoryName: 'Corte' },
      payment: { linkUrl: 'https://pay.test/beauty/2', status: 'PENDING' },
    });
    h.engine.enqueue({ text: SLOT(', payment=required, paymentTimeoutHours=4') });
    await sendMessage(h, conv, 'agendar corte particular');
    expect(h.reserveSlot.execute.mock.calls[0][0].paymentTimeoutHours).toBe(4);
  });

  it('FLOW-BTY-07 informational answer when not booking', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Trabalhamos com varios profissionais.', confidence: 0.95 });
    const res = await sendMessage(h, conv, 'quais servicos voces oferecem?');
    expect(res).toEqual({ success: true });
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });

  it('FLOW-BTY-08 cancel intent does not reserve a slot', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: 'Tudo bem, cancelado.', confidence: 0.95 });
    await sendMessage(h, conv, 'na verdade deixa pra la');
    expect(h.reserveSlot.execute).not.toHaveBeenCalled();
  });

  it('FLOW-BTY-09 booking message with accents resolves the service', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: SLOT(', payment=free') });
    await sendMessage(h, conv, 'quero agendar uma manicure à tarde');
    expect(h.reserveSlot.execute).toHaveBeenCalled();
  });

  it('FLOW-BTY-10 human request pauses booking and hands off', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'prefiro falar com um atendente');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
    expect(h.reserveSlot.execute).not.toHaveBeenCalled();
  });
});
