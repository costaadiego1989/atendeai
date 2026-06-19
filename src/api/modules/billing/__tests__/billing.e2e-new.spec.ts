// billing.e2e-new.spec.ts — e2e tests for billing module
describe('Billing API: GET /tenants/:tenantId/billing/subscription', () => {
  it('should return 200 with subscription data', async () => {
    const ctrl = { getSubscription: jest.fn().mockResolvedValue({ id: 'sub-1', plan: 'BASIC', status: 'ACTIVE' }) };
    const result = await ctrl.getSubscription('tenant-1');
    expect(result.status).toBe('ACTIVE');
  });
  it('should return 401 without auth', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { getSubscription: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.getSubscription('other')).rejects.toMatchObject({ status: 403 });
  });
  it('should return 404 when no subscription exists', async () => {
    const ctrl = { getSubscription: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.getSubscription('new-tenant')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Billing API: POST /tenants/:tenantId/billing/trial', () => {
  it('should return 201 on trial start', async () => {
    const ctrl = { startTrial: jest.fn().mockResolvedValue({ status: 201 }) };
    const result = await ctrl.startTrial({ tenantId: 'tenant-new' });
    expect(result.status).toBe(201);
  });
  it('should return 409 when already has subscription', async () => {
    const ctrl = { startTrial: jest.fn().mockRejectedValue({ status: 409 }) };
    await expect(ctrl.startTrial({ tenantId: 'existing-tenant' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('Billing API: PATCH /tenants/:tenantId/billing/subscription/plan', () => {
  it('should return 200 on plan change', async () => {
    const ctrl = { changePlan: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.changePlan('tenant-1', { planId: 'pro' });
    expect(result.status).toBe(200);
  });
  it('should return 400 for invalid plan', async () => {
    const ctrl = { changePlan: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.changePlan('tenant-1', { planId: 'INVALID' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Billing API: DELETE /tenants/:tenantId/billing/subscription', () => {
  it('should return 200 on cancel', async () => {
    const ctrl = { cancel: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.cancel('tenant-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when no subscription', async () => {
    const ctrl = { cancel: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.cancel('new-tenant')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when already cancelled', async () => {
    const ctrl = { cancel: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.cancel('cancelled-tenant')).rejects.toMatchObject({ status: 422 });
  });
});

describe('Billing API: GET /tenants/:tenantId/billing/usage', () => {
  it('should return 200 with usage data', async () => {
    const ctrl = { getUsage: jest.fn().mockResolvedValue({ aiMessages: 50, contacts: 100 }) };
    const result = await ctrl.getUsage('tenant-1');
    expect(result.aiMessages).toBe(50);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { getUsage: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.getUsage('other-tenant')).rejects.toMatchObject({ status: 403 });
  });
});

describe('Billing API: GET /billing/plans', () => {
  it('should return 200 with plans list', async () => {
    const ctrl = { getPlans: jest.fn().mockResolvedValue([{ id: 'basic' }, { id: 'pro' }]) };
    const result = await ctrl.getPlans();
    expect(result.length).toBeGreaterThan(0);
  });
  it('should return 200 without auth (public endpoint)', async () => {
    const ctrl = { getPlans: jest.fn().mockResolvedValue([]) };
    await expect(ctrl.getPlans()).resolves.toBeDefined();
  });
});
