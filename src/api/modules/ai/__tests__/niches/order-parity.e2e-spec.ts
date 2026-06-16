import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getCommerceRepo,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedCoupon,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-PARITY — the persisted ORDER must match the session at checkout
 * (subtotal, freight, discount, total, fulfillment, address). Bug-hunting on
 * checkout total/discount math reaching the order record.
 */
describe('FLOW-PARITY (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'ECOMMERCE',
      description: 'Loja para testes de paridade pedido/sessao.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Paridade',
      basePrice: '100.00',
      tags: ['produto'],
      stock: 50,
    });
    await seedFixedShipping(h, tenantId, 20);
    await seedCoupon(h, {
      tenantId,
      code: 'PARITY10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.prisma.salesCoupon
      .deleteMany({ where: { tenantId } })
      .catch(() => undefined);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  async function orderFor(conversationId: string) {
    const s = await getSession(h, tenantId, conversationId);
    const repo = await getCommerceRepo(h);
    return {
      session: s,
      order: await repo.findOrderByPaymentReference(
        tenantId,
        s!.paymentReference!,
      ),
    };
  }

  it('FLOW-PARITY-01 pickup order totals match the session', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2'); // 200
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const { session, order } = await orderFor(conv.conversationId);
    expect(order).not.toBeNull();
    expect(Number(order!.subtotalAmount)).toBeCloseTo(
      Number(session!.subtotalAmount),
      2,
    );
    expect(Number(order!.totalAmount)).toBeCloseTo(
      Number(session!.totalAmount),
      2,
    );
  });

  it('FLOW-PARITY-02 delivery order freight matches the session', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua Paridade, 100, Centro');
    await sendMessage(h, conv, 'finalizar pedido');
    const { session, order } = await orderFor(conv.conversationId);
    expect(Number(order!.freightAmount)).toBeCloseTo(
      Number(session!.freightAmount),
      2,
    );
    expect(Number(order!.freightAmount)).toBe(20);
  });

  it('FLOW-PARITY-03 order total equals subtotal + freight - discount', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua Paridade, 100, Centro');
    await sendMessage(h, conv, 'finalizar pedido');
    const { order } = await orderFor(conv.conversationId);
    expect(Number(order!.totalAmount)).toBeCloseTo(
      Number(order!.subtotalAmount) +
        Number(order!.freightAmount) -
        Number(order!.discountAmount ?? 0),
      2,
    );
  });

  it('FLOW-PARITY-04 coupon discount is carried onto the order', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1'); // subtotal 100
    await sendMessage(h, conv, 'cupom: PARITY10');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const { order } = await orderFor(conv.conversationId);
    expect(Number(order!.discountAmount ?? 0)).toBeCloseTo(10, 2);
    expect(order!.couponCode).toBe('PARITY10');
  });

  it('FLOW-PARITY-05 fulfillment type matches between session and order', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const { session, order } = await orderFor(conv.conversationId);
    expect(order!.fulfillmentType).toBe(session!.fulfillmentType);
    expect(order!.fulfillmentType).toBe('PICKUP');
  });

  it('FLOW-PARITY-06 delivery address is persisted on the order', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Avenida Paridade, 999, Bairro');
    await sendMessage(h, conv, 'finalizar pedido');
    const { order } = await orderFor(conv.conversationId);
    expect(order!.deliveryAddress).toContain('Avenida Paridade');
  });

  it('FLOW-PARITY-07 order starts AWAITING_PAYMENT with PENDING payment', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const { order } = await orderFor(conv.conversationId);
    expect(order!.status).toBe('AWAITING_PAYMENT');
    expect(order!.paymentStatus).toBe('PENDING');
  });
});
