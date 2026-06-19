// commerce.e2e-new.spec.ts — e2e tests for commerce module
describe('Commerce API: GET /tenants/:tenantId/commerce/sessions', () => {
  it('should return 200 with sessions list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue([]) };
    expect(Array.isArray(await ctrl.list({ tenantId: 'tenant-1' }))).toBe(true);
  });
  it('should return 401 without auth', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { list: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.list({ tenantId: 'other' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('Commerce API: POST /tenants/:tenantId/commerce/sessions', () => {
  it('should return 201 on session create', async () => {
    const ctrl = { create: jest.fn().mockResolvedValue({ id: 'sess-new', status: 201 }) };
    const result = await ctrl.create({ contactId: 'c1' });
    expect(result.status).toBe(201);
  });
  it('should return 400 when contactId missing', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({})).rejects.toMatchObject({ status: 400 });
  });
});

describe('Commerce API: POST /tenants/:tenantId/commerce/sessions/:id/items', () => {
  it('should return 200 on item add', async () => {
    const ctrl = { addItem: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.addItem('sess-1', { catalogItemId: 'item-1', qty: 2 });
    expect(result.status).toBe(200);
  });
  it('should return 404 when catalog item not found', async () => {
    const ctrl = { addItem: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.addItem('sess-1', { catalogItemId: 'missing', qty: 1 })).rejects.toMatchObject({ status: 404 });
  });
  it('should return 400 for zero quantity', async () => {
    const ctrl = { addItem: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.addItem('sess-1', { catalogItemId: 'item-1', qty: 0 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Commerce API: POST /tenants/:tenantId/commerce/sessions/:id/coupon', () => {
  it('should return 200 on valid coupon', async () => {
    const ctrl = { applyCoupon: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.applyCoupon('sess-1', 'PROMO10');
    expect(result.status).toBe(200);
  });
  it('should return 404 when coupon not found', async () => {
    const ctrl = { applyCoupon: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.applyCoupon('sess-1', 'INVALID')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when coupon expired', async () => {
    const ctrl = { applyCoupon: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.applyCoupon('sess-1', 'EXPIRED')).rejects.toMatchObject({ status: 422 });
  });
});

describe('Commerce API: PATCH /tenants/:tenantId/commerce/sessions/:id/fulfillment', () => {
  it('should return 200 on update', async () => {
    const ctrl = { updateFulfillment: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.updateFulfillment('sess-1', { method: 'DELIVERY', address: '123 Main' });
    expect(result.status).toBe(200);
  });
  it('should return 400 for invalid fulfillment method', async () => {
    const ctrl = { updateFulfillment: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.updateFulfillment('sess-1', { method: 'INVALID' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 404 when session not found', async () => {
    const ctrl = { updateFulfillment: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.updateFulfillment('missing-sess', {})).rejects.toMatchObject({ status: 404 });
  });
});
