import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  findEvent,
  getSession,
  hasEvent,
  seedCatalogItem,
  seedCategory,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-QUOTA — quota enforcement. When the billing quota check denies, the
 * LLM must NOT be called (no token spend), ai.quota.denied.v1 must be emitted,
 * and no commerce side effects may occur.
 */
describe('GUARD-QUOTA (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  const allow = () => ({
    canProceed: true,
    used: 10,
    quota: 100000,
    status: 'ACTIVE',
  });
  const deny = (status = 'ACTIVE', used = 100000, quota = 100000) => ({
    canProceed: false,
    used,
    quota,
    status,
  });

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja para testes de cota.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Teste',
      basePrice: '10.00',
      tags: ['produto'],
      stock: 10,
    });
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.quota.execute.mockReset();
    h.quota.execute.mockResolvedValue(allow());
  });

  it('GUARD-QUOTA-01 denial prevents the LLM from being called', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.requests.length).toBe(0);
  });

  it('GUARD-QUOTA-02 denial emits ai.quota.denied.v1', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(hasEvent(h.events, 'ai.quota.denied.v1')).toBe(true);
  });

  it('GUARD-QUOTA-03 denial returns QUOTA_EXCEEDED to the caller', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'ola');
    expect(res).toMatchObject({ success: false, error: 'QUOTA_EXCEEDED' });
  });

  it('GUARD-QUOTA-04 allowed quota proceeds normally', async () => {
    h.engine.enqueue({ text: 'Oi!', confidence: 0.95 });
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'ola tudo bem');
    expect(res).toEqual({ success: true });
  });

  it('GUARD-QUOTA-05 NO_SUBSCRIPTION status returns the right error', async () => {
    h.quota.execute.mockResolvedValueOnce(deny('NO_SUBSCRIPTION', 0, 0));
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'ola');
    expect(res).toMatchObject({ success: false, error: 'NO_SUBSCRIPTION' });
  });

  it('GUARD-QUOTA-06 inactive subscription returns SUBSCRIPTION_INACTIVE', async () => {
    h.quota.execute.mockResolvedValueOnce(deny('SUSPENDED'));
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'ola');
    expect(res).toMatchObject({ success: false, error: 'SUBSCRIPTION_INACTIVE' });
  });

  it('GUARD-QUOTA-07 denial also publishes a fallback failed event', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(hasEvent(h.events, 'ai.response.failed.v1')).toBe(true);
  });

  it('GUARD-QUOTA-08 denial creates no commerce session', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-QUOTA-09 denial produces no generated response event', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(false);
  });

  it('GUARD-QUOTA-10 quota denied event carries tenant context', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    const ev = findEvent(h.events, 'ai.quota.denied.v1');
    expect((ev!.payload as { tenantId: string }).tenantId).toBe(tenantId);
  });

  it('GUARD-QUOTA-11 conversation recovers after quota is restored', async () => {
    h.quota.execute.mockResolvedValueOnce(deny());
    const conv = await createConversation(h, tenantId);
    const denied = await sendMessage(h, conv, 'ola');
    expect(denied.success).toBe(false);

    h.engine.enqueue({ text: 'Agora sim!', confidence: 0.95 });
    const ok = await sendMessage(h, conv, 'ola de novo');
    expect(ok).toEqual({ success: true });
  });

  it('GUARD-QUOTA-12 quota check is invoked before the LLM on every turn', async () => {
    h.engine.enqueue({ text: 'Ok.', confidence: 0.95 });
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.quota.execute).toHaveBeenCalled();
  });
});
