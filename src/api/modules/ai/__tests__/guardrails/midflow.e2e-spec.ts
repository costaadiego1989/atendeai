import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  hasEvent,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-MIDFLOW — guardrails firing with an ACTIVE commerce cart. Quota, safety
 * and handoff must trigger correctly mid-flow without corrupting or losing the
 * shopping session.
 */
describe('GUARD-MIDFLOW quota/handoff (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja midflow.',
      confidenceThreshold: 0.5,
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Mid',
      basePrice: '20.00',
      tags: ['produto'],
      stock: 100,
    });
    await seedFixedShipping(h, tenantId, 5);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.quota.execute.mockReset();
    h.quota.execute.mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 100000,
      status: 'ACTIVE',
    });
  });

  async function cart() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    return conv;
  }

  it('GUARD-MIDFLOW-01 quota denial mid-cart preserves the session', async () => {
    const conv = await cart();
    h.quota.execute.mockResolvedValueOnce({
      canProceed: false,
      used: 100000,
      quota: 100000,
      status: 'ACTIVE',
    });
    const res = await sendMessage(h, conv, 'mais alguma coisa');
    expect(res).toMatchObject({ success: false, error: 'QUOTA_EXCEEDED' });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
  });

  it('GUARD-MIDFLOW-02 quota denial mid-cart does not call the LLM', async () => {
    const conv = await cart();
    h.engine.reset();
    h.quota.execute.mockResolvedValueOnce({
      canProceed: false,
      used: 100000,
      quota: 100000,
      status: 'ACTIVE',
    });
    await sendMessage(h, conv, 'mais');
    expect(h.engine.requests.length).toBe(0);
  });

  it('GUARD-MIDFLOW-03 human request mid-cart hands off and keeps a session', async () => {
    const conv = await cart();
    const res = await sendMessage(h, conv, 'quero um atendente humano');
    expect(res).toMatchObject({ success: false, error: 'HANDOFF_REQUIRED' });
    expect(hasEvent(h.events, 'ai.escalation.requested.v1')).toBe(true);
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('GUARD-MIDFLOW-04 cart resumes normally after a mid-flow handoff', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'quero um atendente');
    // Customer continues; flow still answers and keeps a live session.
    const res = await sendMessage(h, conv, 'produto');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });
});

describe('GUARD-MIDFLOW safety (e2e, safety enabled)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness({
      safety: {
        safetyModeEnabled: true,
        blockedSubstrings: ['comprar arma'],
        platformSystemAppend: 'Sem conteudo ilegal.',
      },
    });
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja midflow safety.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Mid',
      basePrice: '20.00',
      tags: ['produto'],
      stock: 100,
    });
    await seedFixedShipping(h, tenantId, 5);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  it('GUARD-MIDFLOW-05 blocked message mid-cart is blocked and preserves session', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    const res = await sendMessage(h, conv, 'quero comprar arma tambem');
    expect(res).toMatchObject({ success: false, error: 'SAFETY_BLOCKED' });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
  });

  it('GUARD-MIDFLOW-06 blocked mid-cart does not advance the cart or call LLM', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    h.engine.reset();
    await sendMessage(h, conv, 'comprar arma');
    expect(h.engine.requests.length).toBe(0);
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items.length).toBe(1);
  });
});
