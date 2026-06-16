import {
  ConversationHarness,
  SeededTenant,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-TXN — transactional business guard. Only transactional business types
 * may enter the commerce state machine; consultative/scheduling niches must
 * never create a ShoppingSession.
 */
describe('GUARD-TXN (e2e)', () => {
  jest.setTimeout(240000);

  let h: ConversationHarness;
  let food: SeededTenant;
  let health: SeededTenant;
  let b2b: SeededTenant;

  beforeAll(async () => {
    h = await bootConversationHarness();
    food = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Transacional.',
    });
    const cat = await seedCategory(h, food.tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId: food.tenantId,
      categoryId: cat,
      name: 'Produto Food',
      basePrice: '10.00',
      tags: ['produto'],
      stock: 20,
    });
    health = await seedTenant(h, {
      businessType: 'HEALTH',
      description: 'Nao transacional.',
    });
    b2b = await seedTenant(h, {
      businessType: 'B2B',
      description: 'Nao transacional.',
    });
  });

  afterAll(async () => {
    await cleanupTenant(h, food.tenantId);
    await cleanupTenant(h, health.tenantId);
    await cleanupTenant(h, b2b.tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.engine.setFallback({ text: 'ok', confidence: 0.95 });
  });

  it('GUARD-TXN-01 transactional FOOD creates a commerce session', async () => {
    const conv = await createConversation(h, food.tenantId);
    await sendMessage(h, conv, 'produto');
    const s = await getSession(h, food.tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('GUARD-TXN-02 non-transactional HEALTH creates no session', async () => {
    const conv = await createConversation(h, health.tenantId);
    await sendMessage(h, conv, 'produto');
    const s = await getSession(h, health.tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-TXN-03 non-transactional B2B creates no session', async () => {
    const conv = await createConversation(h, b2b.tenantId);
    await sendMessage(h, conv, 'produto');
    const s = await getSession(h, b2b.tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-TXN-04 HEALTH still answers conversationally without commerce', async () => {
    h.engine.enqueue({ text: 'Posso ajudar a agendar.', confidence: 0.95 });
    const conv = await createConversation(h, health.tenantId);
    const res = await sendMessage(h, conv, 'quero marcar consulta');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, health.tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-TXN-05 FOOD with non-catalog query yields no session', async () => {
    const conv = await createConversation(h, food.tenantId);
    await sendMessage(h, conv, 'item totalmente inexistente xyz');
    const s = await getSession(h, food.tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-TXN-06 FOOD type is recognized as transactional (case/accents)', async () => {
    const conv = await createConversation(h, food.tenantId);
    await sendMessage(h, conv, 'PRODUTO');
    const s = await getSession(h, food.tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });
});
