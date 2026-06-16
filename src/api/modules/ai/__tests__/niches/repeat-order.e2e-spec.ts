import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getCommerceRepo,
  getSession,
  lastGeneratedText,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-REPEAT — repeat-last-order happy path. After a settled (PAID) order, the
 * [REPEAT_LAST_ORDER] action tag rebuilds the cart from the previous order.
 */
describe('FLOW-REPEAT (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para repetir pedido.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Repeticao',
      basePrice: '15.00',
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
  });

  async function completeAndSettleOrder(qty: string) {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, qty);
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const session = await getSession(h, tenantId, conv.conversationId);
    const repo = await getCommerceRepo(h);
    await repo.markOrderPaidByPaymentReference({
      tenantId,
      paymentReference: session!.paymentReference!,
      paidAt: new Date(),
    });
    await repo.updateSessionState({
      tenantId,
      sessionId: session!.id,
      status: 'PAID',
      currentStep: 'PAID',
    });
    return conv;
  }

  it('FLOW-REPEAT-01 rebuilds the cart from the last paid order', async () => {
    const conv = await completeAndSettleOrder('3');
    h.engine.enqueue({ text: '[REPEAT_LAST_ORDER]' });
    await sendMessage(h, conv, 'quero repetir meu ultimo pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.items.length).toBeGreaterThan(0);
    expect(s!.items[0].quantity).toBe(3);
  });

  it('FLOW-REPEAT-02 repeated cart reply lists the previous items', async () => {
    const conv = await completeAndSettleOrder('2');
    h.engine.enqueue({ text: '[REPEAT_LAST_ORDER]' });
    await sendMessage(h, conv, 'repetir pedido');
    expect(lastGeneratedText(h.events)).toMatch(/Produto Repeticao/i);
  });

  it('FLOW-REPEAT-03 repeated cart subtotal reflects copied items', async () => {
    const conv = await completeAndSettleOrder('4');
    h.engine.enqueue({ text: '[REPEAT_LAST_ORDER]' });
    await sendMessage(h, conv, 'quero o mesmo de antes');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(60, 2); // 4 x 15
  });

  it('FLOW-REPEAT-04 no prior order degrades to a graceful message', async () => {
    const conv = await createConversation(h, tenantId);
    h.engine.enqueue({ text: '[REPEAT_LAST_ORDER]' });
    const res = await sendMessage(h, conv, 'repetir meu pedido');
    expect(res).toEqual({ success: true });
    expect(lastGeneratedText(h.events)).toMatch(/não consegui|nao consegui|novo pedido/i);
  });
});
