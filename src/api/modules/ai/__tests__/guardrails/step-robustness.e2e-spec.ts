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
 * GUARD-STEP — per-step robustness (bug-hunting). Sends blank, garbage, wrong
 * type and context-switching messages at every state-machine step and asserts
 * the flow neither crashes nor silently corrupts. Quirks discovered are pinned
 * with [QUIRK]/[BUG] markers and documented in ADR-0031 §Findings.
 */
describe('GUARD-STEP (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para testes de robustez.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Limitado',
      basePrice: '30.00',
      tags: ['produto'],
      stock: 5,
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

  it('GUARD-STEP-01 blank at entry creates no session, no crash', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMessage(h, conv, '   ');
    expect(res).toHaveProperty('success');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-STEP-02 blank at SELECTING_ITEM stays put', async () => {
    const conv = await atSelecting();
    await sendMessage(h, conv, '   ');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
  });

  it('GUARD-STEP-03 garbage at SELECTING_ITEM stays put', async () => {
    const conv = await atSelecting();
    await sendMessage(h, conv, 'asdfghjkl');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('SELECTING_ITEM');
  });

  it('GUARD-STEP-04 blank at AWAITING_QUANTITY stays put, no item added', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, '   ');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.items.length).toBe(0);
  });

  it('GUARD-STEP-05 garbage text at AWAITING_QUANTITY stays put', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, 'bastante por favor');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.items.length).toBe(0);
  });

  it('GUARD-STEP-06 negative "-3" is rejected (no quantity)', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, '-3');
    const s = await getSession(h, tenantId, conv.conversationId);
    // Fixed: the extractor no longer coerces a negative into a positive.
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.items.length).toBe(0);
  });

  it('GUARD-STEP-07 3-digit quantity "999" is accepted then capped to stock', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, '999');
    const s = await getSession(h, tenantId, conv.conversationId);
    // Fixed: 3-digit quantities parse; oversell guard caps to stock (5).
    expect(s!.currentStep).toBe('ASKING_MORE_ITEMS');
    expect(s!.items[0].quantity).toBe(5);
  });

  it('GUARD-STEP-08 decimal "2.5" is rejected (no quantity)', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, '2.5');
    const s = await getSession(h, tenantId, conv.conversationId);
    // Fixed: decimals are no longer silently truncated.
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
    expect(s!.items.length).toBe(0);
  });

  // Regression for BUG-3 (fixed): conversational add caps quantity to available
  // stock instead of accepting an oversell.
  it('GUARD-STEP-09 quantity above stock is capped to available', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, '9'); // stock is 5
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.items[0].quantity).toBe(5);
  });

  it('GUARD-STEP-10 context-switch text at AWAITING_QUANTITY does not advance', async () => {
    const conv = await atQuantity();
    await sendMessage(h, conv, 'na verdade quero outro produto');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_QUANTITY');
  });

  it('GUARD-STEP-11 "cancelar" at ASKING_MORE_ITEMS resets to identifying need', async () => {
    const conv = await atAskingMore();
    await sendMessage(h, conv, 'cancelar tudo');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('IDENTIFYING_NEED');
  });

  it('GUARD-STEP-12 checkout keyword at ASKING_MORE_ITEMS advances to fulfillment', async () => {
    const conv = await atAskingMore();
    await sendMessage(h, conv, 'finalizar');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_FULFILLMENT');
  });

  it('GUARD-STEP-13 blank at AWAITING_FULFILLMENT stays put', async () => {
    const conv = await atFulfillment();
    await sendMessage(h, conv, '   ');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_FULFILLMENT');
  });

  it('GUARD-STEP-14 ambiguous fulfillment answer stays put', async () => {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'talvez sei la');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_FULFILLMENT');
  });

  it('GUARD-STEP-15 blank at AWAITING_DELIVERY_ADDRESS stays put', async () => {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, '   ');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_DELIVERY_ADDRESS');
    expect(s!.deliveryAddress).toBeNull();
  });

  it('GUARD-STEP-16 garbage at AWAITING_DELIVERY_ADDRESS stays put', async () => {
    const conv = await atFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'xyz');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_DELIVERY_ADDRESS');
  });
});
