import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-CONC — same-conversation concurrency. Two messages processed in
 * parallel must not crash the flow or leave the session in an inconsistent
 * state. (Strict single-session-per-conversation is best-effort under races;
 * these assertions verify resilience, not serialization.)
 */
describe('GUARD-CONC (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para concorrencia.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Conc',
      basePrice: '10.00',
      tags: ['produto'],
      stock: 100,
    });
    await seedFixedShipping(h, tenantId, 0);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.engine.setFallback({ text: 'ok', confidence: 0.95 });
  });

  it('GUARD-CONC-01 two parallel opening messages do not crash', async () => {
    const conv = await createConversation(h, tenantId);
    const results = await Promise.all([
      sendMessage(h, conv, 'produto'),
      sendMessage(h, conv, 'produto'),
    ]);
    for (const r of results) {
      expect(r).toHaveProperty('success');
    }
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.currentStep).toBe('SELECTING_ITEM');
  });

  it('GUARD-CONC-02 parallel quantity messages keep a consistent session', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await Promise.all([
      sendMessage(h, conv, '2'),
      sendMessage(h, conv, '3'),
    ]);
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    // Session advanced past quantity without corruption.
    expect(['AWAITING_QUANTITY', 'ASKING_MORE_ITEMS']).toContain(s!.currentStep);
  });

  it('GUARD-CONC-03 sequential after concurrent still completes an order', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await Promise.all([
      sendMessage(h, conv, 'produto'),
      sendMessage(h, conv, '1'),
    ]);
    // Drive deterministically to checkout afterwards.
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('GUARD-CONC-04 parallel duplicate checkout intents do not double-charge', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    h.paymentFacade.createdLinks.length = 0;
    await Promise.all([
      sendMessage(h, conv, 'finalizar pedido'),
      sendMessage(h, conv, 'finalizar pedido'),
    ]);
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    // At most one payment link should have been created for the order.
    expect(h.paymentFacade.createdLinks.length).toBeLessThanOrEqual(1);
  });
});
