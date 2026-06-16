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
 * GUARD-IDEMP — conversational idempotency. Repeated turns and repeated
 * checkout intents must not duplicate items, orders or payment links. (Inbound
 * message dedup itself lives in the messaging InboundMessagePipeline; here we
 * assert the commerce flow's own idempotency guards.)
 */
describe('GUARD-IDEMP (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para testes de idempotencia.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Unico',
      basePrice: '30.00',
      tags: ['produto'],
      stock: 50,
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
    h.paymentFacade.createdLinks.length = 0;
  });

  async function toAwaitingPayment() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    return conv;
  }

  it('GUARD-IDEMP-01 paying twice creates only one payment link', async () => {
    const conv = await toAwaitingPayment();
    const after = h.paymentFacade.createdLinks.length;
    await sendMessage(h, conv, 'finalizar pedido');
    expect(h.paymentFacade.createdLinks.length).toBe(after);
  });

  it('GUARD-IDEMP-02 session stays AWAITING_PAYMENT after a repeat pay intent', async () => {
    const conv = await toAwaitingPayment();
    await sendMessage(h, conv, 'pode mandar o link de novo');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
  });

  it('GUARD-IDEMP-03 payment link url is unchanged on repeated intents', async () => {
    const conv = await toAwaitingPayment();
    const s1 = await getSession(h, tenantId, conv.conversationId);
    await sendMessage(h, conv, 'finalizar pedido');
    const s2 = await getSession(h, tenantId, conv.conversationId);
    expect(s2!.paymentLinkUrl).toBe(s1!.paymentLinkUrl);
  });

  it('GUARD-IDEMP-04 re-sending the search term does not crash the session', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    const r = await sendMessage(h, conv, 'produto');
    expect(r).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
  });

  it('GUARD-IDEMP-05 repeating a quantity number does not double-add the item', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '2'); // now at ASKING_MORE_ITEMS, number is not "more"
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items.length).toBe(1);
  });

  it('GUARD-IDEMP-06 repeating "só isso" keeps AWAITING_FULFILLMENT', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'só isso');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_FULFILLMENT');
  });

  it('GUARD-IDEMP-07 terminal session ignores further messages', async () => {
    const conv = await toAwaitingPayment();
    const res = await sendMessage(h, conv, 'oi de novo');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
  });

  it('GUARD-IDEMP-08 processing the same inbound text twice both succeed', async () => {
    const conv = await createConversation(h, tenantId);
    const r1 = await sendMessage(h, conv, 'produto');
    const r2 = await sendMessage(h, conv, 'produto');
    expect(r1).toEqual({ success: true });
    expect(r2).toEqual({ success: true });
  });
});
