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
 * FLOW-CART — cart-building mutations: multiple items, same item twice, totals
 * integrity across additions. Bug-hunting on subtotal correctness.
 */
describe('FLOW-CART (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para testes de carrinho.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Item Alpha',
      basePrice: '10.00',
      tags: ['alpha'],
      stock: 100,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Item Beta',
      basePrice: '25.00',
      tags: ['beta'],
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
  });

  it('FLOW-CART-01 single item subtotal is correct', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '3');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(30, 2);
  });

  it('FLOW-CART-02 two distinct items sum correctly', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2'); // 2 x 10 = 20
    await sendMessage(h, conv, 'beta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1'); // 1 x 25 = 25
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items.length).toBe(2);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(45, 2);
  });

  it('FLOW-CART-03 adding the same item twice keeps subtotal consistent', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2'); // 2 x 10
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '3'); // 3 x 10
    const s = await getSession(h, tenantId, conv.conversationId);
    // Whether merged or two lines, subtotal must equal 5 x 10 = 50.
    expect(Number(s!.subtotalAmount)).toBeCloseTo(50, 2);
  });

  it('FLOW-CART-04 line total equals unit price x quantity', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'beta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '4');
    const s = await getSession(h, tenantId, conv.conversationId);
    const line = s!.items[0];
    expect(Number(line.lineTotal)).toBeCloseTo(
      Number(line.unitPrice) * line.quantity,
      2,
    );
  });

  it('FLOW-CART-05 subtotal equals the sum of all line totals', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, 'beta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    const s = await getSession(h, tenantId, conv.conversationId);
    const sumLines = s!.items.reduce((a, i) => a + Number(i.lineTotal), 0);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(sumLines, 2);
  });

  it('FLOW-CART-06 building more items keeps the session in ASKING_MORE_ITEMS', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'alpha');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
  });
});
