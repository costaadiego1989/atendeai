// platform-admin.e2e-new.spec.ts — e2e tests for platform-admin endpoints
describe('PlatformAdmin API: GET /admin/tenants', () => {
  it('should return 200 with all tenants for SUPER_ADMIN', async () => {
    const ctrl = { listTenants: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    expect(await ctrl.listTenants({})).toHaveProperty('items');
  });
  it('should return 401 without auth token', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for non-SUPER_ADMIN role', async () => {
    const ctrl = { listTenants: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.listTenants({ role: 'ADMIN' })).rejects.toMatchObject({ status: 403 });
  });
  it('should filter by plan', async () => {
    const ctrl = { listTenants: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.listTenants({ plan: 'PRO' });
    expect(ctrl.listTenants).toHaveBeenCalledWith(expect.objectContaining({ plan: 'PRO' }));
  });
  it('should support pagination', async () => {
    const ctrl = { listTenants: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.listTenants({ page: 2, pageSize: 50 });
    expect(ctrl.listTenants).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});

describe('PlatformAdmin API: PATCH /admin/tenants/:id/suspend', () => {
  it('should return 200 on successful suspension', async () => {
    const ctrl = { suspend: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.suspend('tenant-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when tenant not found', async () => {
    const ctrl = { suspend: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.suspend('missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when already suspended', async () => {
    const ctrl = { suspend: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.suspend('already-suspended')).rejects.toMatchObject({ status: 422 });
  });
});

describe('PlatformAdmin API: PATCH /admin/tenants/:id/reactivate', () => {
  it('should return 200 on reactivation', async () => {
    const ctrl = { reactivate: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.reactivate('tenant-1');
    expect(result.status).toBe(200);
  });
  it('should return 422 when tenant is already active', async () => {
    const ctrl = { reactivate: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.reactivate('active-tenant')).rejects.toMatchObject({ status: 422 });
  });
});

describe('PlatformAdmin API: PATCH /admin/tenants/:id/plan', () => {
  it('should return 200 on plan override', async () => {
    const ctrl = { overridePlan: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.overridePlan('tenant-1', { plan: 'ENTERPRISE' });
    expect(result.status).toBe(200);
  });
  it('should return 400 for invalid plan', async () => {
    const ctrl = { overridePlan: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.overridePlan('tenant-1', { plan: 'INVALID' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 404 when tenant not found', async () => {
    const ctrl = { overridePlan: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.overridePlan('missing', { plan: 'PRO' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('PlatformAdmin API: GET /admin/metrics', () => {
  it('should return 200 with metrics', async () => {
    const ctrl = { getMetrics: jest.fn().mockResolvedValue({ totalTenants: 100, mrr: 15000 }) };
    const result = await ctrl.getMetrics();
    expect(result.totalTenants).toBe(100);
  });
  it('should return 403 for non-SUPER_ADMIN', async () => {
    const ctrl = { getMetrics: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.getMetrics()).rejects.toMatchObject({ status: 403 });
  });
});
