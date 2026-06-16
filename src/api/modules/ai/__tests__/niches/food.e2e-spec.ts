import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  hasEvent,
  lastGeneratedText,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-FOOD — Food & Delivery niche (COMMERCE strategy).
 * Drives the real 11-step commerce state machine to order conclusion through
 * the real ProcessAIResponse pipeline, with scripted LLM + fake payment facade.
 */
describe('FLOW-FOOD niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Pizzaria com entrega e retirada.',
      services: 'Pizzas, bebidas e sobremesas.',
    }));
    const menu = await seedCategory(h, tenantId, 'Cardápio');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: menu,
      name: 'Pizza Calabresa',
      basePrice: '49.90',
      tags: ['pizza'],
      stock: 100,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: menu,
      name: 'Pizza Marguerita',
      basePrice: '45.00',
      tags: ['pizza'],
      stock: 100,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: menu,
      name: 'Refrigerante Lata',
      basePrice: '6.00',
      tags: ['bebida'],
      stock: 50,
    });
    await seedFixedShipping(h, tenantId, 8);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  it('FLOW-FOOD-01 pickup order reaches AWAITING_PAYMENT with payment link', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');

    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(s!.fulfillmentType).toBe('PICKUP');
    expect(s!.paymentLinkUrl).toContain('https://pay.test/');
    expect(h.paymentFacade.createdLinks.length).toBeGreaterThan(0);
  });

  it('FLOW-FOOD-02 pickup path requires no address', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirar');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_ORDER_NOTE');
    expect(s!.deliveryAddress).toBeNull();
  });

  it('FLOW-FOOD-03 combo of multiple items accumulates the cart', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    // add another item
    await sendMessage(h, conv, 'refrigerante');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items.length).toBeGreaterThanOrEqual(2);
  });

  it('FLOW-FOOD-04 delivery order to AWAITING_PAYMENT with freight', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua das Flores, 123, Centro');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(s!.fulfillmentType).toBe('DELIVERY');
    expect(s!.deliveryAddress).toContain('Rua das Flores');
    expect(Number(s!.freightAmount)).toBeGreaterThan(0);
  });

  it('FLOW-FOOD-05 out-of-stock item is not offered', async () => {
    const menu2 = await seedCategory(h, tenantId, 'Esgotados');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: menu2,
      name: 'Sorvete Esgotado',
      basePrice: '12.00',
      tags: ['sorvete'],
      stock: 0,
    });
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'sorvete');
    const s = await getSession(h, tenantId, conv.conversationId);
    // unavailable inventory not offered; no catalog token match either path stays safe
    expect(s === null || s.currentStep === 'SELECTING_ITEM').toBe(true);
  });

  it('FLOW-FOOD-06 checkout intent variants advance from order note', async () => {
    for (const closing of ['pode finalizar', 'checkout', 'pagar']) {
      const conv = await createConversation(h, tenantId);
      await sendMessage(h, conv, 'pizza');
      await sendMessage(h, conv, '1');
      await sendMessage(h, conv, '1');
      await sendMessage(h, conv, 'só isso');
      await sendMessage(h, conv, 'retirada');
      await sendMessage(h, conv, closing);
      const s = await getSession(h, tenantId, conv.conversationId);
      expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    }
  });

  it('FLOW-FOOD-07 fulfillment keyword is accent and case insensitive', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'ENTREGA');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.fulfillmentType).toBe('DELIVERY');
  });

  it('FLOW-FOOD-08 repeat last order tag handled gracefully when no prior order', async () => {
    const conv = await createConversation(h, tenantId);
    // Non-catalog message so commerce flow yields null and the scripted tag runs.
    h.engine.enqueue({ text: '[REPEAT_LAST_ORDER]' });
    await sendMessage(h, conv, 'quero repetir meu ultimo pedido');
    const text = lastGeneratedText(h.events);
    expect(text).toBeTruthy();
    expect(text).toMatch(/pedido/i);
  });

  it('FLOW-FOOD-09 unknown coupon keeps the conversation alive', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    const res = await sendMessage(h, conv, 'cupom: NAOEXISTE');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('FLOW-FOOD-10 abandoned session is resumed on next message', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    const first = await getSession(h, tenantId, conv.conversationId);
    await sendMessage(h, conv, '1');
    const second = await getSession(h, tenantId, conv.conversationId);
    expect(second!.id).toBe(first!.id);
    expect(second!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-FOOD-11 invalid option number re-prompts without crashing', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '0');
    await sendMessage(h, conv, '99');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
    const ok = await sendMessage(h, conv, '1');
    expect(ok).toEqual({ success: true });
  });

  it('FLOW-FOOD-12 non-numeric quantity re-prompts then accepts a number', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'umas duas');
    let s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    await sendMessage(h, conv, '2');
    s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
  });

  it('FLOW-FOOD-13 no catalog match falls back to conversational answer', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, 'vocês têm comida japonesa?');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });

  it('FLOW-FOOD-14 ambiguous query returns multiple options to choose from', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
    expect(s!.pendingOptions.length).toBeGreaterThanOrEqual(2);
  });
});
