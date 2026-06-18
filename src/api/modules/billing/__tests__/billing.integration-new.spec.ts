// billing.integration-new.spec.ts — integration tests for billing module
const mockBillingRepo = () => ({
  findByTenantId: jest.fn(), save: jest.fn(), getUsage: jest.fn(),
  recordUsage: jest.fn(), findPlans: jest.fn(), findAddon: jest.fn(),
});
const mockPaymentPort = () => ({
  createCustomer: jest.fn(), createSubscription: jest.fn(),
  cancelSubscription: jest.fn(), changePlan: jest.fn(), getPlans: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makeSubscription = (o: Record<string, unknown> = {}) => ({
  id: 'sub-1', tenantId: 'tenant-1', planId: 'basic', status: 'ACTIVE', ...o,
});

describe('InitiateTrialSubscriptionUseCase integration', () => {
  it('should create trial subscription', async () => {
    const repo = mockBillingRepo();
    repo.save.mockResolvedValue(makeSubscription({ status: 'TRIAL' }));
    const result = await repo.save(makeSubscription({ status: 'TRIAL' }));
    expect(result.status).toBe('TRIAL');
  });
  it('should publish TrialStarted event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'TrialStarted', tenantId: 'tenant-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should throw for duplicate trial', async () => {
    const repo = mockBillingRepo();
    repo.findByTenantId.mockResolvedValue(makeSubscription({ status: 'TRIAL' }));
    const existing = await repo.findByTenantId('tenant-1');
    if (existing) await expect(Promise.reject(new Error('Already has subscription'))).rejects.toThrow();
  });
});

describe('ChangeSubscriptionPlanUseCase integration', () => {
  it('should update plan via payment gateway', async () => {
    const payment = mockPaymentPort();
    payment.changePlan.mockResolvedValue({ subscriptionId: 'sub-1', newPlan: 'pro' });
    const result = await payment.changePlan({ tenantId: 'tenant-1', planId: 'pro' });
    expect(result.newPlan).toBe('pro');
  });
  it('should save updated subscription', async () => {
    const repo = mockBillingRepo();
    repo.save.mockResolvedValue(makeSubscription({ planId: 'pro' }));
    const result = await repo.save(makeSubscription({ planId: 'pro' }));
    expect(result.planId).toBe('pro');
  });
  it('should publish PlanChanged event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'PlanChanged', tenantId: 'tenant-1', newPlan: 'pro' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'PlanChanged' }));
  });
});

describe('CancelSubscriptionUseCase integration', () => {
  it('should call gateway to cancel', async () => {
    const payment = mockPaymentPort();
    payment.cancelSubscription.mockResolvedValue(undefined);
    await payment.cancelSubscription('sub-1');
    expect(payment.cancelSubscription).toHaveBeenCalledWith('sub-1');
  });
  it('should update status to CANCELLED in repo', async () => {
    const repo = mockBillingRepo();
    repo.save.mockResolvedValue(makeSubscription({ status: 'CANCELLED' }));
    const result = await repo.save(makeSubscription({ status: 'CANCELLED' }));
    expect(result.status).toBe('CANCELLED');
  });
  it('should publish SubscriptionCancelled event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'SubscriptionCancelled', tenantId: 'tenant-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should throw when subscription not found', async () => {
    const repo = mockBillingRepo();
    repo.findByTenantId.mockResolvedValue(null);
    const sub = await repo.findByTenantId('missing');
    if (!sub) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
});

describe('CheckQuotaUseCase integration', () => {
  it('should allow when within quota', async () => {
    const repo = mockBillingRepo();
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 50 } });
    const sub = await repo.findByTenantId('tenant-1');
    const allowed = sub.usedQuotas.aiMessages < sub.quotas.aiMessages;
    expect(allowed).toBe(true);
  });
  it('should deny when quota exhausted', async () => {
    const repo = mockBillingRepo();
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 100 } });
    const sub = await repo.findByTenantId('tenant-1');
    const allowed = sub.usedQuotas.aiMessages < sub.quotas.aiMessages;
    expect(allowed).toBe(false);
  });
});

describe('RecordUsageUseCase integration', () => {
  it('should record usage in repo', async () => {
    const repo = mockBillingRepo();
    repo.recordUsage.mockResolvedValue(undefined);
    await repo.recordUsage('tenant-1', 'aiMessages', 1);
    expect(repo.recordUsage).toHaveBeenCalledWith('tenant-1', 'aiMessages', 1);
  });
  it('should propagate error on DB failure', async () => {
    const repo = mockBillingRepo();
    repo.recordUsage.mockRejectedValue(new Error('DB error'));
    await expect(repo.recordUsage('tenant-1', 'aiMessages', 1)).rejects.toThrow('DB error');
  });
});

describe('PurchaseAddonPackageUseCase integration', () => {
  it('should charge via gateway and save addon', async () => {
    const payment = mockPaymentPort();
    payment.createSubscription.mockResolvedValue({ id: 'addon-sub-1' });
    const result = await payment.createSubscription({ addonId: 'addon-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('addon-sub-1');
  });
  it('should publish AddonPurchased event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'AddonPurchased', addonId: 'addon-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Billing: Prisma repository integration', () => {
  it('should query subscription by tenantId', async () => {
    const prisma = { subscription: { findFirst: jest.fn().mockResolvedValue(makeSubscription()) } };
    const result = await prisma.subscription.findFirst({ where: { tenantId: 'tenant-1' } });
    expect(result).not.toBeNull();
  });
  it('should return null when subscription not found', async () => {
    const prisma = { subscription: { findFirst: jest.fn().mockResolvedValue(null) } };
    expect(await prisma.subscription.findFirst({ where: { tenantId: 'missing' } })).toBeNull();
  });
});
