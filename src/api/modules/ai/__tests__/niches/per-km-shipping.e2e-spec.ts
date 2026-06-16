import { ConfigureShippingPolicyUseCase } from '@modules/commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * FLOW-PERKM — PER_KM freight routing. Delivery with a PER_KM policy routes to
 * AWAITING_FREIGHT_REVIEW, which has no conversational handler (freight is
 * reviewed out-of-band by the merchant). This suite documents that behavior and
 * proves the global reset rescues the customer so they are never stuck.
 */
describe('FLOW-PERKM (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'ECOMMERCE',
      description: 'Loja com frete por km.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto PerKm',
      basePrice: '50.00',
      tags: ['produto'],
      stock: 50,
    });
    const configure = h.app.get(ConfigureShippingPolicyUseCase);
    await configure.execute({
      tenantId,
      mode: 'PER_KM',
      pricePerKm: 2,
      active: true,
      carrierShippingEnabled: false,
    } as never);
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  async function toFulfillment() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    return conv;
  }

  it('FLOW-PERKM-01 delivery with PER_KM routes to freight review', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_FREIGHT_REVIEW');
    expect(s!.shippingMode).toBe('PER_KM');
  });

  it('FLOW-PERKM-02 freight review has no conversational handler (stays put)', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'Rua qualquer, 123, Centro');
    const s = await getSession(h, tenantId, conv.conversationId);
    // Documented: merchant reviews freight out-of-band; flow parks here.
    expect(s!.currentStep).toBe('AWAITING_FREIGHT_REVIEW');
  });

  it('FLOW-PERKM-03 reset rescues the customer from freight review', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'entrega');
    await sendMessage(h, conv, 'menu');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s).toBeNull();
  });

  it('FLOW-PERKM-04 pickup still works under a PER_KM policy', async () => {
    const conv = await toFulfillment();
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    const s = await getSession(h, tenantId, conv.conversationId);
    expect(s!.currentStep).toBe('AWAITING_PAYMENT');
  });
});
