import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getCommerceRepo,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-RESTART — the customer must NEVER get stuck. From every step a global
 * reset intent (menu / reiniciar / voltar / cancelar / recomeçar) escapes the
 * flow, and once a purchase is finalized the flow restarts fresh.
 */
describe('FLOW-RESTART (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para testes de reinicio de fluxo.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Reinicio',
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
    h.engine.setFallback({ text: 'ok', confidence: 0.95 });
  });

  // Builders to each step --------------------------------------------------
  async function atSelecting() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    return conv;
  }
  async function atQuantity() {
    const conv = await atSelecting();
    await sendMessage(h, conv, '1');
    return conv;
  }
  async function atAskingMore() {
    const conv = await atQuantity();
    await sendMessage(h, conv, '1');
    return conv;
  }
  async function atFulfillment() {
    const conv = await atAskingMore();
    await sendMessage(h, conv, 'só isso');
    return conv;
  }
  async function atDeliveryAddress() {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'entrega');
    return conv;
  }
  async function atOrderNote() {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'retirada');
    return conv;
  }
  async function atReadyForCheckout() {
    const conv = await atOrderNote();
    await sendMessage(h, conv, 'alguma observacao qualquer');
    return conv;
  }

  async function expectEscaped(conv: {
    tenantId: string;
    contactId: string;
    conversationId: string;
  }) {
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  }

  it('FLOW-RESTART-01 "menu" escapes from SELECTING_ITEM', async () => {
    const conv = await atSelecting();
    await sendMessage(h, conv, 'menu');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-02 "reiniciar" escapes from AWAITING_QUANTITY', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, 'reiniciar');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-03 "voltar ao menu" escapes from ASKING_MORE_ITEMS', async () => {
    const conv = await atAskingMore();
    await sendMessage(h, conv, 'voltar ao menu');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-04 "cancelar" escapes from AWAITING_FULFILLMENT', async () => {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'cancelar');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-05 "menu" escapes from AWAITING_DELIVERY_ADDRESS', async () => {
    const conv = await atDeliveryAddress();
    await sendMessage(h, conv, 'menu');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-06 "recomeçar" escapes from AWAITING_ORDER_NOTE', async () => {
    const conv = await atOrderNote();
    await sendMessage(h, conv, 'recomeçar do zero');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-07 "menu" escapes from READY_FOR_CHECKOUT', async () => {
    const conv = await atReadyForCheckout();
    await sendMessage(h, conv, 'menu');
    await expectEscaped(conv);
  });

  it('FLOW-RESTART-08 after reset, a product query starts a fresh empty cart', async () => {
    const conv = await atAskingMore(); // has 1 item
    await sendMessage(h, conv, 'menu');
    await expectEscaped(conv);

    await sendMessage(h, conv, 'produto');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
    expect(s!.items.length).toBe(0);
  });

  it('FLOW-RESTART-09 reset creates a brand new session id on restart', async () => {
    const conv = await atQuantity();
    const before = await getSession(h, tenantId, conv.conversationId);
    await sendMessage(h, conv, 'reiniciar');
    await sendMessage(h, conv, 'produto');
    const after = await getSession(h, tenantId, conv.conversationId);
    expect(after!.id).not.toBe(before!.id);
  });

  it('FLOW-RESTART-10 reset synonyms all escape the flow', async () => {
    for (const word of ['voltar', 'cancelar tudo', 'comecar de novo']) {
      const conv = await atQuantity();
      await sendMessage(h, conv, word);
      await expectEscaped(conv);
    }
  });

  it('FLOW-RESTART-11 finalized (PAID) purchase restarts the flow on next query', async () => {
    // Drive to checkout, then simulate the purchase being settled (PAID).
    const conv = await atOrderNote();
    await sendMessage(h, conv, 'finalizar pedido');
    const awaiting = await getSession(h, tenantId, conv.conversationId);
    expect(awaiting!.currentStep).toBe('AWAITING_PAYMENT');

    const repo = await getCommerceRepo(h);
    await repo.updateSessionState({
      tenantId,
      sessionId: awaiting!.id,
      status: 'PAID',
      currentStep: 'PAID',
    });

    // A finalized purchase is no longer the active session → next query is fresh.
    expect(await getSession(h, tenantId, conv.conversationId)).toBeNull();
    await sendMessage(h, conv, 'produto');
    const fresh = await getSession(h, tenantId, conv.conversationId);
    expect(fresh!.currentStep).toBe('SELECTING_ITEM');
    expect(fresh!.id).not.toBe(awaiting!.id);
    expect(fresh!.items.length).toBe(0);
  });

  it('FLOW-RESTART-13 long sentence mentioning "voltar" does NOT reset the cart', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, 'vou voltar mais tarde para comprar com calma');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-RESTART-14 negated "nao quero cancelar agora" does NOT reset', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, 'nao quero cancelar agora obrigado');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-RESTART-12 customer can complete a SECOND order after the first', async () => {
    const conv = await atOrderNote();
    await sendMessage(h, conv, 'finalizar pedido');
    const first = await getSession(h, tenantId, conv.conversationId);
    const repo = await getCommerceRepo(h);
    await repo.updateSessionState({
      tenantId,
      sessionId: first!.id,
      status: 'PAID',
      currentStep: 'PAID',
    });

    // Second purchase, same conversation.
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const second = await getSession(h, tenantId, conv.conversationId);
    expect(second!.currentStep).toBe('AWAITING_PAYMENT');
    expect(second!.id).not.toBe(first!.id);
  });
});
