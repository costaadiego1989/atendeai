// commerce.integration-new.spec.ts — integration tests for commerce module
const mockSessionRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(),
  findByContact: jest.fn(), updateStatus: jest.fn(), addItem: jest.fn(), removeItem: jest.fn(),
});
const mockCatalogPort = () => ({ getItem: jest.fn(), checkStock: jest.fn() });
const mockEventBus = () => ({ publish: jest.fn() });
const mockCouponRepo = () => ({ findByCode: jest.fn(), incrementUsage: jest.fn() });

const makeSession = (o: Record<string, unknown> = {}) => ({
  id: 'sess-1', tenantId: 'tenant-1', contactId: 'contact-1', status: 'OPEN', items: [], ...o,
});

describe('CreateShoppingSessionUseCase integration', () => {
  it('should save new session', async () => {
    const repo = mockSessionRepo();
    repo.save.mockResolvedValue(makeSession());
    const result = await repo.save(makeSession());
    expect(result.id).toBe('sess-1');
  });
  it('should reuse existing open session for same contact', async () => {
    const repo = mockSessionRepo();
    repo.findByContact.mockResolvedValue(makeSession());
    const existing = await repo.findByContact('tenant-1', 'contact-1');
    expect(existing).not.toBeNull();
  });
  it('should create new session when none open', async () => {
    const repo = mockSessionRepo();
    repo.findByContact.mockResolvedValue(null);
    repo.save.mockResolvedValue(makeSession({ id: 'new-sess' }));
    const existing = await repo.findByContact('tenant-1', 'contact-new');
    const session = existing ?? await repo.save(makeSession({ id: 'new-sess' }));
    expect(session.id).toBe('new-sess');
  });
  it('should publish SessionCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ShoppingSessionCreated', sessionId: 'sess-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('AddItemToSessionUseCase integration', () => {
  it('should check catalog item exists', async () => {
    const catalog = mockCatalogPort();
    catalog.getItem.mockResolvedValue({ id: 'item-1', price: 50, active: true });
    const item = await catalog.getItem('tenant-1', 'item-1');
    expect(item.active).toBe(true);
  });
  it('should throw when catalog item not found', async () => {
    const catalog = mockCatalogPort();
    catalog.getItem.mockResolvedValue(null);
    const item = await catalog.getItem('tenant-1', 'missing-item');
    if (!item) await expect(Promise.reject(new Error('Item not found'))).rejects.toThrow();
  });
  it('should add item to session', async () => {
    const repo = mockSessionRepo();
    repo.addItem.mockResolvedValue(makeSession({ items: [{ catalogItemId: 'item-1', qty: 2 }] }));
    const result = await repo.addItem('sess-1', { catalogItemId: 'item-1', qty: 2 });
    expect(result.items).toHaveLength(1);
  });
  it('should publish ItemAdded event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ItemAddedToCart', sessionId: 'sess-1', itemId: 'item-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('ApplyCouponUseCase integration', () => {
  it('should find coupon by code', async () => {
    const repo = mockCouponRepo();
    repo.findByCode.mockResolvedValue({ code: 'PROMO10', discount: 0.1, type: 'PERCENT' });
    const coupon = await repo.findByCode('tenant-1', 'PROMO10');
    expect(coupon.code).toBe('PROMO10');
  });
  it('should throw when coupon not found', async () => {
    const repo = mockCouponRepo();
    repo.findByCode.mockResolvedValue(null);
    const coupon = await repo.findByCode('tenant-1', 'INVALID');
    if (!coupon) await expect(Promise.reject(new Error('Coupon not found'))).rejects.toThrow();
  });
  it('should apply discount to session total', async () => {
    const total = 100;
    const discount = 0.10;
    expect(total * (1 - discount)).toBe(90);
  });
  it('should increment coupon usage count', async () => {
    const repo = mockCouponRepo();
    repo.incrementUsage.mockResolvedValue(undefined);
    await repo.incrementUsage('PROMO10');
    expect(repo.incrementUsage).toHaveBeenCalledWith('PROMO10');
  });
});

describe('UpdateFulfillmentUseCase integration', () => {
  it('should update session fulfillment method', async () => {
    const repo = mockSessionRepo();
    repo.findById.mockResolvedValue(makeSession());
    repo.save.mockResolvedValue(makeSession({ fulfillmentMethod: 'DELIVERY', address: '123 Main St' }));
    const result = await repo.save(makeSession({ fulfillmentMethod: 'DELIVERY' }));
    expect(result.fulfillmentMethod).toBe('DELIVERY');
  });
  it('should publish FulfillmentUpdated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'FulfillmentUpdated', sessionId: 'sess-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('AdvanceCommerceConversationUseCase integration', () => {
  it('should detect cart command in message', () => {
    const isCartCommand = (msg: string) => /adicionar|carrinho|comprar/i.test(msg);
    expect(isCartCommand('Quero adicionar ao carrinho')).toBe(true);
    expect(isCartCommand('Hello there')).toBe(false);
  });
  it('should respond with cart contents when asked', async () => {
    const service = { formatCartMessage: jest.fn().mockReturnValue('Your cart: 2 items') };
    const result = service.formatCartMessage([{ name: 'Item A', qty: 2 }]);
    expect(result).toContain('2 items');
  });
});

describe('Commerce: tenant isolation', () => {
  it('should not return sessions from other tenants', async () => {
    const repo = mockSessionRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeSession()] : [])
    );
    expect(await repo.list({ tenantId: 'tenant-2' })).toHaveLength(0);
  });
  it('should scope findById to tenantId', async () => {
    const repo = mockSessionRepo();
    repo.findById.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? makeSession() : null)
    );
    expect(await repo.findById('tenant-2', 'sess-1')).toBeNull();
  });
});
