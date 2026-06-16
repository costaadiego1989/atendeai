import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedCoupon,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-COUPON — valid coupon application + discount math (bug-hunting). Coupons
 * are seeded directly into sales_schema.sales_coupons. Subtotal is fixed at 100
 * (1 x R$100) so discount/total are exactly predictable.
 */
describe('FLOW-COUPON (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja com cupons.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Cupom',
      basePrice: '100.00',
      tags: ['produto'],
      stock: 50,
    });
    await seedFixedShipping(h, tenantId, 0);

    await seedCoupon(h, {
      tenantId,
      code: 'PCT10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });
    await seedCoupon(h, {
      tenantId,
      code: 'FIX25',
      discountType: 'FIXED_AMOUNT',
      discountValue: 25,
    });
    await seedCoupon(h, {
      tenantId,
      code: 'INATIVO',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      active: false,
    });
    await seedCoupon(h, {
      tenantId,
      code: 'VENCIDO',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      startsAt: new Date(Date.now() - 2 * 86400000),
      expiresAt: new Date(Date.now() - 86400000),
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

  async function cartWithOneItem() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1'); // subtotal = 100
    return conv;
  }

  it('FLOW-COUPON-01 percentage coupon applies the right discount', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: PCT10');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount)).toBeCloseTo(10, 2);
  });

  it('FLOW-COUPON-02 percentage coupon recomputes the total', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: PCT10');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.totalAmount)).toBeCloseTo(90, 2);
  });

  it('FLOW-COUPON-03 fixed-amount coupon applies the right discount', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: FIX25');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount)).toBeCloseTo(25, 2);
    expect(Number(s!.totalAmount)).toBeCloseTo(75, 2);
  });

  it('FLOW-COUPON-04 coupon code is persisted on the session', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: PCT10');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.couponCode).toBe('PCT10');
  });

  it('FLOW-COUPON-05 inactive coupon applies no discount but keeps the flow', async () => {
    const conv = await cartWithOneItem();
    const res = await sendMessage(h, conv, 'cupom: INATIVO');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
    expect(s!.couponCode).toBeNull();
  });

  it('FLOW-COUPON-06 expired coupon applies no discount', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: VENCIDO');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
  });

  it('FLOW-COUPON-07 discounted order carries discount through checkout', async () => {
    const conv = await cartWithOneItem();
    await sendMessage(h, conv, 'cupom: FIX25');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(Number(s!.totalAmount)).toBeCloseTo(75, 2);
  });

  it('FLOW-COUPON-08 unknown coupon code applies no discount', async () => {
    const conv = await cartWithOneItem();
    const res = await sendMessage(h, conv, 'cupom: NAOEXISTE');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
  });
});
