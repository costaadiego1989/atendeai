import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  seedCatalogItem,
  seedCategory,
  seedCoupon,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-GROUND — prompt grounding. Verifies the system prompt that reaches the
 * model actually carries the correct, current domain context (catalog matches,
 * prices, cart state, totals, coupon) so a real LLM COULD answer correctly.
 * This is the closest deterministic proxy to "validating correct responses".
 */
describe('GUARD-GROUND (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Pizzaria artesanal do bairro.',
      services: 'Pizzas, bebidas e sobremesas.',
    }));
    const cat = await seedCategory(h, tenantId, 'Cardápio');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Pizza Calabresa',
      basePrice: '49.90',
      tags: ['pizza'],
      stock: 50,
    });
    await seedFixedShipping(h, tenantId, 8);
    await seedCoupon(h, {
      tenantId,
      code: 'GROUND10',
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
    h.engine.setFallback({ text: 'ok', confidence: 0.95 });
  });

  it('GUARD-GROUND-01 catalog matches block reaches the model on option turn', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1'); // option selection turn injects matches block
    expect(h.engine.lastRequest!.systemPrompt).toContain(
      'Commerce catalog matches:',
    );
  });

  it('GUARD-GROUND-02 matched product name is grounded in the prompt', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    expect(h.engine.lastRequest!.systemPrompt).toContain('Pizza Calabresa');
  });

  it('GUARD-GROUND-03 product price is grounded in the prompt', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    expect(h.engine.lastRequest!.systemPrompt).toContain('49');
  });

  it('GUARD-GROUND-04 numbered option list is grounded on option turn', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    expect(h.engine.lastRequest!.systemPrompt).toMatch(/-\s*1\.\s*Pizza/);
  });

  it('GUARD-GROUND-05 active session flow context reaches the model', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    expect(h.engine.lastRequest!.systemPrompt).toContain(
      'Commerce flow context:',
    );
  });

  it('GUARD-GROUND-06 current step is grounded after building the cart', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    expect(h.engine.lastRequest!.systemPrompt).toContain('Current step:');
  });

  it('GUARD-GROUND-07 cart subtotal is grounded', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '2');
    expect(h.engine.lastRequest!.systemPrompt).toContain('Subtotal:');
  });

  it('GUARD-GROUND-08 applied coupon is grounded after coupon use', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'pizza');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'cupom: GROUND10');
    expect(h.engine.lastRequest!.systemPrompt).toContain('Applied coupon:');
    expect(h.engine.lastRequest!.systemPrompt).toContain('GROUND10');
  });

  it('GUARD-GROUND-09 user message is delivered to the model verbatim', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'tem pizza vegetariana?');
    expect(h.engine.lastRequest!.userMessage).toBe('tem pizza vegetariana?');
  });

  it('GUARD-GROUND-10 no-match query still reaches the model with a prompt', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'vocês fazem yakisoba?');
    expect(h.engine.lastRequest!.systemPrompt.length).toBeGreaterThan(0);
  });
});
