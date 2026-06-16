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
 * FLOW-COUPONEDGE — coupon edge cases: usage limit reached, not-yet-started,
 * and an over-100% misconfiguration. Bug-hunting on discount guards.
 */
describe('FLOW-COUPONEDGE (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja para cupons edge.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Edge',
      basePrice: '100.00',
      tags: ['produto'],
      stock: 50,
    });
    await seedFixedShipping(h, tenantId, 0);

    await seedCoupon(h, {
      tenantId,
      code: 'ESGOTADO',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 1,
      usedCount: 1,
    });
    await seedCoupon(h, {
      tenantId,
      code: 'FUTURO',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: new Date(Date.now() + 7 * 86400000),
    });
    await seedCoupon(h, {
      tenantId,
      code: 'METADE',
      discountType: 'PERCENTAGE',
      discountValue: 50,
    });
    await seedCoupon(h, {
      tenantId,
      code: 'EXAGERADO',
      discountType: 'PERCENTAGE',
      discountValue: 150,
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

  async function cart() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1'); // subtotal 100
    return conv;
  }

  it('FLOW-COUPONEDGE-01 usage-limit-reached coupon gives no discount', async () => {
    const conv = await cart();
    const res = await sendMessage(h, conv, 'cupom: ESGOTADO');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
    expect(s!.couponCode).toBeNull();
  });

  it('FLOW-COUPONEDGE-02 not-yet-started coupon gives no discount', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'cupom: FUTURO');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
  });

  it('FLOW-COUPONEDGE-03 50% coupon halves the total', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'cupom: METADE');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount)).toBeCloseTo(50, 2);
    expect(Number(s!.totalAmount)).toBeCloseTo(50, 2);
  });

  it('FLOW-COUPONEDGE-04 [QUIRK] >100% coupon is not clamped (total goes negative)', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'cupom: EXAGERADO');
    const s = await getSession(h, tenantId, conv.conversationId);
    // Documented quirk: discount = 150% of 100 = 150; total = -50 (no clamp).
    expect(Number(s!.discountAmount)).toBeCloseTo(150, 2);
    expect(Number(s!.totalAmount)).toBeLessThan(0);
  });

  it('FLOW-COUPONEDGE-05 valid coupon survives adding another item (recalc)', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'cupom: METADE'); // 50% of 100 = 50
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1'); // subtotal now 200
    const s = await getSession(h, tenantId, conv.conversationId);
    // AddItem re-applies the active coupon → discount 50% of 200 = 100.
    expect(Number(s!.discountAmount)).toBeCloseTo(100, 2);
  });

  it('FLOW-COUPONEDGE-06 unknown coupon leaves totals untouched', async () => {
    const conv = await cart();
    await sendMessage(h, conv, 'cupom: ZZZZZ');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.discountAmount ?? 0)).toBe(0);
    expect(Number(s!.totalAmount)).toBeCloseTo(100, 2);
  });
});
