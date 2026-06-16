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
 * FLOW-ECM — E-commerce niche (COMMERCE strategy). Emphasis on delivery,
 * freight, totals precision, order notes and checkout guards.
 */
describe('FLOW-ECM niche (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'ECOMMERCE',
      description: 'Loja online de eletronicos com entrega nacional.',
      services: 'Fones, cabos e acessorios.',
    }));
    const cat = await seedCategory(h, tenantId, 'Eletronicos');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Fone Bluetooth',
      basePrice: '150.00',
      tags: ['fone'],
      stock: 30,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Fone com Fio',
      basePrice: '40.00',
      tags: ['fone'],
      stock: 30,
    });
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Cabo USB',
      basePrice: '25.00',
      tags: ['cabo'],
      stock: 100,
    });
    await seedFixedShipping(h, tenantId, 20);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  it('FLOW-ECM-01 delivery order with note completes to AWAITING_PAYMENT', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'fone');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua A, 100, Centro, Sao Paulo');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(Number(s!.freightAmount)).toBe(20);
  });

  it('FLOW-ECM-02 short address is rejected', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'aqui');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_DELIVERY_ADDRESS');
  });

  it('FLOW-ECM-03 total equals subtotal plus freight', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua B, 200, Bairro Novo');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.totalAmount)).toBeCloseTo(
      Number(s!.subtotalAmount) + Number(s!.freightAmount),
      1,
    );
  });

  it('FLOW-ECM-04 order note text is persisted', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'por favor embrulhar para presente');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('READY_FOR_CHECKOUT');
    expect(s!.notes).toContain('presente');
  });

  it('FLOW-ECM-05 skip order note proceeds to ready for checkout', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'sem observação');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('READY_FOR_CHECKOUT');
    expect(s!.notes).toBeNull();
  });

  it('FLOW-ECM-06 ready-for-checkout completes on payment intent', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'sem observação');
    await sendMessage(h, conv, 'pode mandar o link');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(s!.paymentLinkUrl).toContain('https://pay.test/');
  });

  it('FLOW-ECM-07 high-value order keeps precise totals', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'fone');
    await sendMessage(h, conv, '1'); // Fone Bluetooth 150
    await sendMessage(h, conv, '3');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.subtotalAmount)).toBeCloseTo(450, 1);
  });

  it('FLOW-ECM-08 select by listed option number resolves the right item', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'fone');
    await sendMessage(h, conv, '2');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.selectedItemName).toContain('Fone');
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('FLOW-ECM-09 switching to pickup drops address requirement', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.fulfillmentType).toBe('PICKUP');
    expect(s!.currentStep).toBe('AWAITING_ORDER_NOTE');
  });

  it('FLOW-ECM-10 order note with accents and emoji is stored verbatim', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'entregar à tarde 🙏 por favor');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.notes).toContain('à tarde');
  });

  it('FLOW-ECM-11 unknown coupon does not break delivery flow', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'cabo');
    await sendMessage(h, conv, '1');
    const res = await sendMessage(h, conv, 'cupom: XPTO');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).not.toBeNull();
  });

  it('FLOW-ECM-12 delivery order persists fulfillment and address', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'fone');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua das Palmeiras, 45, Jardim');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.fulfillmentType).toBe('DELIVERY');
    expect(s!.deliveryAddress).toContain('Palmeiras');
  });
});
