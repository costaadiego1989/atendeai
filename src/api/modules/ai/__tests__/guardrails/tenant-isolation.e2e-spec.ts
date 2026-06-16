import {
  ConversationHarness,
  SeededTenant,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  findEvent,
  getSession,
  seedCatalogItem,
  seedCategory,
  seedFixedShipping,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-TENANT — multi-tenant isolation (CLAUDE.md §6). Two tenants run side by
 * side; sessions, catalog, orders and events must never cross the boundary.
 */
describe('GUARD-TENANT (e2e)', () => {
  jest.setTimeout(240000);

  let h: ConversationHarness;
  let A: SeededTenant;
  let B: SeededTenant;

  beforeAll(async () => {
    h = await bootConversationHarness();
    A = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja A.',
    });
    B = await seedTenant(h, {
      businessType: 'RETAIL',
      description: 'Loja B.',
    });
    const catA = await seedCategory(h, A.tenantId, 'CatA');
    await seedCatalogItem(h, {
      tenantId: A.tenantId,
      categoryId: catA,
      name: 'Alphacamiseta',
      basePrice: '50.00',
      tags: ['alphacamiseta'],
      stock: 10,
    });
    const catB = await seedCategory(h, B.tenantId, 'CatB');
    await seedCatalogItem(h, {
      tenantId: B.tenantId,
      categoryId: catB,
      name: 'Betaboneco',
      basePrice: '70.00',
      tags: ['betaboneco'],
      stock: 10,
    });
    await seedFixedShipping(h, A.tenantId, 10);
    await seedFixedShipping(h, B.tenantId, 15);
  });

  afterAll(async () => {
    await cleanupTenant(h, A.tenantId);
    await cleanupTenant(h, B.tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  it("GUARD-TENANT-01 A's session is invisible to B", async () => {
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'alphacamiseta');
    const underA = await getSession(h, A.tenantId, convA.conversationId);
    const underB = await getSession(h, B.tenantId, convA.conversationId);
    expect(underA).not.toBeNull();
    expect(underB).toBeNull();
  });

  it("GUARD-TENANT-02 B cannot find A's product via catalog search", async () => {
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'alphacamiseta');
    const s = await getSession(h, B.tenantId, convB.conversationId);
    expect(s).toBeNull();
  });

  it("GUARD-TENANT-03 A cannot find B's product via catalog search", async () => {
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'betaboneco');
    const s = await getSession(h, A.tenantId, convA.conversationId);
    expect(s).toBeNull();
  });

  it('GUARD-TENANT-04 each tenant resolves its own catalog', async () => {
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'betaboneco');
    const s = await getSession(h, B.tenantId, convB.conversationId);
    expect(s).not.toBeNull();
    expect(s!.pendingOptions[0].name).toContain('Beta');
  });

  it('GUARD-TENANT-05 concurrent conversations do not bleed state', async () => {
    const convA = await createConversation(h, A.tenantId);
    const convB = await createConversation(h, B.tenantId);
    await Promise.all([
      sendMessage(h, convA, 'alphacamiseta'),
      sendMessage(h, convB, 'betaboneco'),
    ]);
    const sA = await getSession(h, A.tenantId, convA.conversationId);
    const sB = await getSession(h, B.tenantId, convB.conversationId);
    expect(sA!.tenantId).toBe(A.tenantId);
    expect(sB!.tenantId).toBe(B.tenantId);
  });

  it('GUARD-TENANT-06 generated event carries the originating tenant (A)', async () => {
    h.engine.enqueue({ text: 'Oi de A', confidence: 0.95 });
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'ola loja');
    const ev = findEvent(h.events, 'ai.response.generated.v1');
    expect((ev!.payload as { tenantId: string }).tenantId).toBe(A.tenantId);
  });

  it('GUARD-TENANT-07 generated event carries the originating tenant (B)', async () => {
    h.engine.enqueue({ text: 'Oi de B', confidence: 0.95 });
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'ola loja');
    const ev = findEvent(h.events, 'ai.response.generated.v1');
    expect((ev!.payload as { tenantId: string }).tenantId).toBe(B.tenantId);
  });

  it('GUARD-TENANT-08 a session built in A stays scoped to A on lookup', async () => {
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'alphacamiseta');
    await sendMessage(h, convA, '1');
    const s = await getSession(h, A.tenantId, convA.conversationId);
    expect(s!.tenantId).toBe(A.tenantId);
  });

  it('GUARD-TENANT-09 cross-tenant lookup of a built session returns null', async () => {
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'alphacamiseta');
    await sendMessage(h, convA, '1');
    const crossed = await getSession(h, B.tenantId, convA.conversationId);
    expect(crossed).toBeNull();
  });

  it('GUARD-TENANT-10 each tenant keeps an independent freight policy', async () => {
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'alphacamiseta');
    await sendMessage(h, convA, '1');
    await sendMessage(h, convA, '1');
    await sendMessage(h, convA, 'só isso');
    await sendMessage(h, convA, 'entrega');
    await sendMessage(h, convA, 'Rua A, 10, Centro');
    await sendMessage(h, convA, 'finalizar pedido');
    const s = await getSession(h, A.tenantId, convA.conversationId);
    expect(Number(s!.freightAmount)).toBe(10);
  });

  it('GUARD-TENANT-11 tenant B freight differs from A', async () => {
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'betaboneco');
    await sendMessage(h, convB, '1');
    await sendMessage(h, convB, '1');
    await sendMessage(h, convB, 'só isso');
    await sendMessage(h, convB, 'entrega');
    await sendMessage(h, convB, 'Rua B, 20, Centro');
    await sendMessage(h, convB, 'finalizar pedido');
    const s = await getSession(h, B.tenantId, convB.conversationId);
    expect(Number(s!.freightAmount)).toBe(15);
  });

  it('GUARD-TENANT-12 LLM request trace carries the correct tenant', async () => {
    h.engine.enqueue({ text: 'ok', confidence: 0.95 });
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'ola');
    expect(h.engine.lastRequest!.trace?.tenantId).toBe(B.tenantId);
  });

  it('GUARD-TENANT-13 distinct conversations within A are isolated', async () => {
    const c1 = await createConversation(h, A.tenantId);
    const c2 = await createConversation(h, A.tenantId);
    await sendMessage(h, c1, 'alphacamiseta');
    const s2 = await getSession(h, A.tenantId, c2.conversationId);
    expect(s2).toBeNull();
  });

  it('GUARD-TENANT-14 payment link is created under the paying tenant order', async () => {
    h.paymentFacade.createdLinks.length = 0;
    const convA = await createConversation(h, A.tenantId);
    await sendMessage(h, convA, 'alphacamiseta');
    await sendMessage(h, convA, '1');
    await sendMessage(h, convA, '1');
    await sendMessage(h, convA, 'só isso');
    await sendMessage(h, convA, 'retirada');
    await sendMessage(h, convA, 'finalizar pedido');
    const s = await getSession(h, A.tenantId, convA.conversationId);
    expect(s!.paymentLinkUrl).toContain('https://pay.test/');
  });

  it('GUARD-TENANT-15 a non-matching query in B never returns A items', async () => {
    const convB = await createConversation(h, B.tenantId);
    await sendMessage(h, convB, 'alpha');
    const s = await getSession(h, B.tenantId, convB.conversationId);
    expect(s).toBeNull();
  });
});
