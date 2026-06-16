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
 * FLOW-RET — Retail niche (COMMERCE strategy). Full state-machine journeys to
 * order conclusion plus complex carting / option / quantity edge cases.
 */
describe('FLOW-RET niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja de roupas com retirada e entrega.',
      services: 'Camisetas, calças e acessórios.',
    }));
    const cat = await seedCategory(h, tenantId, 'Vestuário');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Camiseta Branca',
      basePrice: '59.90',
      tags: ['camiseta'],
      stock: 20,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Camiseta Preta',
      basePrice: '59.90',
      tags: ['camiseta'],
      stock: 5,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Boné Esportivo',
      basePrice: '39.90',
      tags: ['esportivo'],
      stock: 10,
    });
    await seedFixedShipping(h, tenantId, 12);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  async function buildCart(conv: {
    tenantId: string;
    contactId: string;
    conversationId: string;
  }) {
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
  }

  it('FLOW-RET-01 pickup order completes to AWAITING_PAYMENT', async () => {
    const conv = await createConversation(h, tenantId);
    await buildCart(conv);
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(s!.paymentLinkUrl).toContain('https://pay.test/');
  });

  it('FLOW-RET-02 ambiguous query yields multiple options', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.pendingOptions.length).toBeGreaterThanOrEqual(2);
  });

  it('FLOW-RET-03 select option by number transitions to quantity', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '2');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.selectedItemName).toContain('Camiseta');
  });

  it('FLOW-RET-04 invalid option 0 then 99 re-prompts, valid proceeds', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '0');
    await sendMessage(h, conv, '99');
    let s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
    await sendMessage(h, conv, '1');
    s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-RET-05 non-numeric quantity re-prompts', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'algumas');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-RET-06 quantity zero is rejected', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '0');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.items.length).toBe(0);
  });

  it('FLOW-RET-07 valid quantity adds item and asks for more', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '3');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
    expect(s!.items[0].quantity).toBe(3);
  });

  it('FLOW-RET-08 add two distinct items then close', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'esportivo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items.length).toBe(2);
    expect(s!.currentStep).toBe('AWAITING_FULFILLMENT');
  });

  it('FLOW-RET-09 totals reflect quantity and unit price', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'esportivo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(79.8, 1);
  });

  it('FLOW-RET-10 unknown coupon mid-cart keeps flow alive', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    const res = await sendMessage(h, conv, 'cupom: INVALIDO');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('FLOW-RET-11 delivery requires a valid address before checkout', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'oi'); // too short to be an address
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_DELIVERY_ADDRESS');
    expect(s!.deliveryAddress).toBeNull();
  });

  it('FLOW-RET-12 delivery with valid address reaches order note', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'camiseta');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Avenida Brasil, 1000, Bairro Centro');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_ORDER_NOTE');
    expect(s!.deliveryAddress).toContain('Avenida Brasil');
  });
});
