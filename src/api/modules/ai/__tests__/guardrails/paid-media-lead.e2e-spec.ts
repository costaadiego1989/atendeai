import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  findEvent,
  getCommerceRepo,
  getSession,
  hasEvent,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMedia,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-PAID / MEDIA / LEAD.
 *  - PAID: order persistence transition AWAITING_PAYMENT → PAID via the
 *    repository's payment-reference settlement (the path a payment webhook hits).
 *  - MEDIA: non-text inbound (image/audio) flows through MediaUnderstanding.
 *  - LEAD: the generated event carries the intent/sentiment/confidence that lead
 *    scoring consumes. (The LeadScored event itself is emitted by an async event
 *    handler/worker and is out of scope for this in-process harness.)
 */
describe('GUARD-PAID / MEDIA / LEAD (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'FOOD',
      description: 'Loja para testes de pagamento e midia.',
    }));
    const cat = await seedCategory(h, tenantId, 'Itens');
    await seedCatalogItem(h, {
      tenantId,
      categoryId: cat,
      name: 'Produto Pago',
      basePrice: '40.00',
      tags: ['produto'],
      stock: 50,
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
    h.mediaUnderstanding.buildAiMessage.mockClear();
  });

  async function checkout() {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'produto');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, '1');
    await sendMessage(h, conv, 'só isso');
    await sendMessage(h, conv, 'retirada');
    await sendMessage(h, conv, 'finalizar pedido');
    return conv;
  }

  it('GUARD-PAID-01 checkout creates an order awaiting payment', async () => {
    const conv = await checkout();
    const session = await getSession(h, tenantId, conv.conversationId);
    const repo = await getCommerceRepo(h);
    const order = await repo.findOrderByPaymentReference(
      tenantId,
      session!.paymentReference!,
    );
    expect(order).not.toBeNull();
    expect(order!.status).toBe('AWAITING_PAYMENT');
    expect(order!.paymentStatus).toBe('PENDING');
  });

  it('GUARD-PAID-02 settling the payment reference marks the order PAID', async () => {
    const conv = await checkout();
    const session = await getSession(h, tenantId, conv.conversationId);
    const repo = await getCommerceRepo(h);
    const paid = await repo.markOrderPaidByPaymentReference({
      tenantId,
      paymentReference: session!.paymentReference!,
      paidAt: new Date(),
    });
    expect(paid).not.toBeNull();
    expect(paid!.status).toBe('PAID');
    expect(paid!.paidAt).toBeTruthy();
  });

  it('GUARD-PAID-03 settled order persists PAID on re-read', async () => {
    const conv = await checkout();
    const session = await getSession(h, tenantId, conv.conversationId);
    const repo = await getCommerceRepo(h);
    await repo.markOrderPaidByPaymentReference({
      tenantId,
      paymentReference: session!.paymentReference!,
      paidAt: new Date(),
    });
    const reread = await repo.findOrderByPaymentReference(
      tenantId,
      session!.paymentReference!,
    );
    expect(reread!.status).toBe('PAID');
  });

  it('GUARD-PAID-04 unknown payment reference settles nothing', async () => {
    const repo = await getCommerceRepo(h);
    const result = await repo.markOrderPaidByPaymentReference({
      tenantId,
      paymentReference: 'does-not-exist',
      paidAt: new Date(),
    });
    expect(result).toBeNull();
  });

  it('GUARD-MEDIA-01 image message flows through media understanding', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMedia(h, conv, {
      type: 'IMAGE',
      url: 'https://files.test/img.jpg',
      mimeType: 'image/jpeg',
    });
    expect(res).toEqual({ success: true });
    expect(h.mediaUnderstanding.buildAiMessage).toHaveBeenCalled();
  });

  it('GUARD-MEDIA-02 interpreted media text reaches the model', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMedia(h, conv, {
      type: 'IMAGE',
      url: 'https://files.test/img.jpg',
    });
    expect(h.engine.lastRequest!.userMessage).toContain(
      'conteudo de midia interpretado',
    );
  });

  it('GUARD-MEDIA-03 audio message is handled', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMedia(h, conv, {
      type: 'AUDIO',
      url: 'https://files.test/a.ogg',
      mimeType: 'audio/ogg',
    });
    expect(res).toEqual({ success: true });
  });

  it('GUARD-MEDIA-04 media without url falls back to text without crashing', async () => {
    const conv = await createConversation(h, tenantId);
    const res = await sendMedia(h, conv, {
      type: 'IMAGE',
      text: 'foto do produto',
    });
    expect(res).toHaveProperty('success');
    // No url → media understanding not invoked.
    expect(h.mediaUnderstanding.buildAiMessage).not.toHaveBeenCalled();
  });

  it('GUARD-LEAD-01 generated event carries intent + sentiment (lead-scoring inputs)', async () => {
    h.engine.enqueue({
      text: 'Quero comprar agora!',
      intent: 'PURCHASE',
      sentiment: 'POSITIVE',
      confidence: 0.92,
    });
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'tenho muito interesse');
    const ev = findEvent(h.events, 'ai.response.generated.v1');
    const payload = ev!.payload as {
      intent: string;
      sentiment: string;
      confidence: number;
    };
    expect(payload.intent).toBe('PURCHASE');
    expect(payload.sentiment).toBe('POSITIVE');
    expect(payload.confidence).toBeCloseTo(0.92, 2);
  });

  it('GUARD-LEAD-02 every answered turn emits the generated event for scoring', async () => {
    h.engine.enqueue({ text: 'Oi', intent: 'GREETING', sentiment: 'NEUTRAL' });
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(hasEvent(h.events, 'ai.response.generated.v1')).toBe(true);
  });
});
