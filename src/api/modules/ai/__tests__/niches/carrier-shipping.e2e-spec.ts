import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  seedCarrierShipping,
  seedCatalogItem,
  seedCategory,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-CARRIER — carrier shipping branch (AWAITING_SHIPPING_METHOD →
 * AWAITING_CARRIER_CEP → AWAITING_CARRIER_OPTION) plus PER_KM local routing.
 * Carrier quote + origin CEP are stubbed in the harness (no external carrier
 * API); assertions target the real handler logic (CEP validation, option
 * selection, freight/total math). Bug-hunting assertions.
 */
describe('FLOW-CARRIER (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'ECOMMERCE',
      description: 'Loja com envio por transportadora.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Carrier',
      basePrice: '100.00',
      tags: ['produto'],
      stock: 50,
    });
    await seedCarrierShipping(h, tenantId, { mode: 'FIXED', fixedAmount: 10 });
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.carrierQuote.execute.mockClear();
  });

  async function toFulfillment() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    return conv;
  }

  it('FLOW-CARRIER-01 delivery routes to shipping-method selection', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_SHIPPING_METHOD');
  });

  it('FLOW-CARRIER-02 choosing carrier moves to CEP step', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'transportadora');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_CARRIER_CEP');
    expect(s!.shippingMode).toBe('CARRIER');
  });

  it('FLOW-CARRIER-03 choosing local delivery moves to address step', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'entrega local');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_DELIVERY_ADDRESS');
  });

  it('FLOW-CARRIER-04 valid CEP fetches options and advances', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '01310-100');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(h.carrierQuote.execute).toHaveBeenCalled();
    expect(s!.currentStep).toBe('AWAITING_CARRIER_OPTION');
    expect(s!.pendingOptions.length).toBe(2);
    expect(s!.carrierCep).toBe('01310100');
  });

  it('FLOW-CARRIER-05 invalid CEP keeps the CEP step', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, 'meu cep e 123');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_CARRIER_CEP');
    expect(h.carrierQuote.execute).not.toHaveBeenCalled();
  });

  it('FLOW-CARRIER-06 selecting an option sets freight and recomputes total', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '01310100');
    await sendMessage(h, conv, '1'); // SEDEX 25.50
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_ORDER_NOTE');
    expect(Number(s!.freightAmount)).toBeCloseTo(25.5, 2);
    expect(Number(s!.totalAmount)).toBeCloseTo(
      Number(s!.subtotalAmount) + 25.5,
      2,
    );
    expect(s!.carrierServiceName).toContain('SEDEX');
  });

  it('FLOW-CARRIER-07 second option applies its own freight', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '01310100');
    await sendMessage(h, conv, '2'); // PAC 18.00
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(Number(s!.freightAmount)).toBeCloseTo(18.0, 2);
  });

  // Regression for BUG-1 + BUG-2 (fixed): carrier orders settle on the CEP
  // (no street address required for CARRIER mode) and the turn completes
  // normally instead of throwing an unhandled exception.
  it('FLOW-CARRIER-08 full carrier order completes to AWAITING_PAYMENT', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '01310100');
    await sendMessage(h, conv, '1');
    const res = await sendMessage(h, conv, 'finalizar pedido');
    expect(res).toEqual({ success: true });
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
    expect(s!.shippingMode).toBe('CARRIER');
    expect(s!.paymentLinkUrl).toContain('https://pay.test/');
  });

  it('FLOW-CARRIER-09 no carrier options keeps CEP step and stores CEP', async () => {
    h.carrierQuote.execute.mockResolvedValueOnce({ options: [] });
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '2');
    await sendMessage(h, conv, '01310100');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_CARRIER_CEP');
    expect(s!.carrierCep).toBe('01310100');
  });
});
