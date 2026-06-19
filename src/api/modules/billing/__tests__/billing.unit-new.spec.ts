// billing.unit-new.spec.ts — comprehensive unit tests for billing module
import { Subscription } from '../domain/entities/Subscription';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { Quotas } from '../domain/value-objects/Quotas';
import { CheckQuotaUseCase } from '../application/use-cases/CheckQuotaUseCase';
import { RecordUsageUseCase } from '../application/use-cases/RecordUsageUseCase';
import { CancelSubscriptionUseCase } from '../application/use-cases/CancelSubscriptionUseCase';
import { BillingNicheResolver } from '../application/support/BillingNicheResolver';

const mockRepo = () => ({
  findByTenantId: jest.fn(),
  save: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
  recordUsage: jest.fn(),
  getUsage: jest.fn(),
});

const mockEventBus = () => ({ publish: jest.fn() });
const mockPayment = () => ({ createCustomer: jest.fn(), cancelSubscription: jest.fn(), getPlans: jest.fn() });

describe('Quotas value object', () => {
  it('should create valid quotas', () => {
    const q = new Quotas({ aiMessages: 100, contacts: 500, conversations: 200 });
    expect(q.aiMessages).toBe(100);
  });

  it('should throw on negative aiMessages', () => {
    expect(() => new Quotas({ aiMessages: -1, contacts: 100, conversations: 100 })).toThrow();
  });

  it('should throw on negative contacts', () => {
    expect(() => new Quotas({ aiMessages: 10, contacts: -5, conversations: 50 })).toThrow();
  });

  it('should allow zero quotas (free tier)', () => {
    const q = new Quotas({ aiMessages: 0, contacts: 0, conversations: 0 });
    expect(q.aiMessages).toBe(0);
  });

  it('should support very large quotas (unlimited plan)', () => {
    const q = new Quotas({ aiMessages: 999999, contacts: 999999, conversations: 999999 });
    expect(q.contacts).toBe(999999);
  });
});

describe('UsageRecord entity', () => {
  it('should create a usage record with valid data', () => {
    const record = UsageRecord.create({ tenantId: 't1', metric: 'aiMessages', value: 10, recordedAt: new Date() });
    expect(record).toBeDefined();
  });

  it('should reject zero or negative usage values', () => {
    expect(() => UsageRecord.create({ tenantId: 't1', metric: 'aiMessages', value: 0, recordedAt: new Date() })).toThrow();
  });

  it('should reject empty tenantId', () => {
    expect(() => UsageRecord.create({ tenantId: '', metric: 'aiMessages', value: 1, recordedAt: new Date() })).toThrow();
  });

  it('should reject empty metric name', () => {
    expect(() => UsageRecord.create({ tenantId: 't1', metric: '', value: 1, recordedAt: new Date() })).toThrow();
  });

  it('should store metric and value correctly', () => {
    const record = UsageRecord.create({ tenantId: 't1', metric: 'contacts', value: 5, recordedAt: new Date() });
    expect(record.metric).toBe('contacts');
    expect(record.value).toBe(5);
  });
});

describe('CheckQuotaUseCase', () => {
  let repo: ReturnType<typeof mockRepo>;
  let useCase: CheckQuotaUseCase;

  beforeEach(() => {
    repo = mockRepo();
    useCase = new CheckQuotaUseCase(repo as any);
  });

  it('should return allowed when usage is below quota', async () => {
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 50 } });
    const result = await useCase.execute({ tenantId: 't1', metric: 'aiMessages', requested: 1 });
    expect(result.allowed).toBe(true);
  });

  it('should return denied when usage equals quota', async () => {
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 100 } });
    const result = await useCase.execute({ tenantId: 't1', metric: 'aiMessages', requested: 1 });
    expect(result.allowed).toBe(false);
  });

  it('should return denied when usage exceeds quota', async () => {
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 101 } });
    const result = await useCase.execute({ tenantId: 't1', metric: 'aiMessages', requested: 1 });
    expect(result.allowed).toBe(false);
  });

  it('should throw when subscription not found', async () => {
    repo.findByTenantId.mockResolvedValue(null);
    await expect(useCase.execute({ tenantId: 'missing', metric: 'aiMessages', requested: 1 })).rejects.toThrow();
  });

  it('should handle bulk requested amount correctly', async () => {
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: { aiMessages: 90 } });
    const result = await useCase.execute({ tenantId: 't1', metric: 'aiMessages', requested: 11 });
    expect(result.allowed).toBe(false);
  });
});

describe('RecordUsageUseCase', () => {
  let repo: ReturnType<typeof mockRepo>;
  let useCase: RecordUsageUseCase;

  beforeEach(() => {
    repo = mockRepo();
    useCase = new RecordUsageUseCase(repo as any);
  });

  it('should record usage successfully', async () => {
    repo.recordUsage.mockResolvedValue(undefined);
    await expect(useCase.execute({ tenantId: 't1', metric: 'aiMessages', value: 1 })).resolves.not.toThrow();
    expect(repo.recordUsage).toHaveBeenCalledWith('t1', 'aiMessages', 1);
  });

  it('should throw for negative value', async () => {
    await expect(useCase.execute({ tenantId: 't1', metric: 'aiMessages', value: -1 })).rejects.toThrow();
  });

  it('should throw for empty tenantId', async () => {
    await expect(useCase.execute({ tenantId: '', metric: 'aiMessages', value: 1 })).rejects.toThrow();
  });

  it('should propagate repository errors', async () => {
    repo.recordUsage.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute({ tenantId: 't1', metric: 'aiMessages', value: 1 })).rejects.toThrow('DB error');
  });
});

describe('CancelSubscriptionUseCase', () => {
  let repo: ReturnType<typeof mockRepo>;
  let payment: ReturnType<typeof mockPayment>;
  let eventBus: ReturnType<typeof mockEventBus>;
  let useCase: CancelSubscriptionUseCase;

  beforeEach(() => {
    repo = mockRepo();
    payment = mockPayment();
    eventBus = mockEventBus();
    useCase = new CancelSubscriptionUseCase(repo as any, payment as any, eventBus as any);
  });

  it('should cancel active subscription', async () => {
    repo.findByTenantId.mockResolvedValue({ id: 's1', status: 'ACTIVE', tenantId: 't1' });
    payment.cancelSubscription.mockResolvedValue(undefined);
    repo.save.mockResolvedValue(undefined);
    await expect(useCase.execute({ tenantId: 't1' })).resolves.not.toThrow();
    expect(payment.cancelSubscription).toHaveBeenCalled();
  });

  it('should throw when subscription is already cancelled', async () => {
    repo.findByTenantId.mockResolvedValue({ id: 's1', status: 'CANCELLED', tenantId: 't1' });
    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow();
  });

  it('should throw when no subscription exists', async () => {
    repo.findByTenantId.mockResolvedValue(null);
    await expect(useCase.execute({ tenantId: 'none' })).rejects.toThrow();
  });

  it('should publish cancellation event on success', async () => {
    repo.findByTenantId.mockResolvedValue({ id: 's1', status: 'ACTIVE', tenantId: 't1' });
    payment.cancelSubscription.mockResolvedValue(undefined);
    repo.save.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 't1' });
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should not call payment if subscription not found', async () => {
    repo.findByTenantId.mockResolvedValue(null);
    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow();
    expect(payment.cancelSubscription).not.toHaveBeenCalled();
  });
});

describe('BillingNicheResolver', () => {
  it('should resolve modules for RESTAURANT niche', () => {
    const modules = BillingNicheResolver.resolveModules('RESTAURANT');
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBeGreaterThan(0);
  });

  it('should resolve modules for RETAIL niche', () => {
    const modules = BillingNicheResolver.resolveModules('RETAIL');
    expect(Array.isArray(modules)).toBe(true);
  });

  it('should resolve modules for SERVICE niche', () => {
    const modules = BillingNicheResolver.resolveModules('SERVICE');
    expect(Array.isArray(modules)).toBe(true);
  });

  it('should return default modules for unknown niche', () => {
    const modules = BillingNicheResolver.resolveModules('UNKNOWN_NICHE' as any);
    expect(Array.isArray(modules)).toBe(true);
  });

  it('should include scheduling module for SERVICE niche', () => {
    const modules = BillingNicheResolver.resolveModules('SERVICE');
    expect(modules).toContain('scheduling');
  });
});

describe('Billing edge cases', () => {
  it('CheckQuotaUseCase: should handle undefined usedQuotas gracefully', async () => {
    const repo = mockRepo();
    const uc = new CheckQuotaUseCase(repo as any);
    repo.findByTenantId.mockResolvedValue({ quotas: { aiMessages: 100 }, usedQuotas: undefined });
    const result = await uc.execute({ tenantId: 't1', metric: 'aiMessages', requested: 1 });
    expect(result.allowed).toBe(true);
  });

  it('CheckQuotaUseCase: should isolate different metrics correctly', async () => {
    const repo = mockRepo();
    const uc = new CheckQuotaUseCase(repo as any);
    repo.findByTenantId.mockResolvedValue({
      quotas: { aiMessages: 10, contacts: 100 },
      usedQuotas: { aiMessages: 10, contacts: 50 },
    });
    const aiResult = await uc.execute({ tenantId: 't1', metric: 'aiMessages', requested: 1 });
    const contactResult = await uc.execute({ tenantId: 't1', metric: 'contacts', requested: 1 });
    expect(aiResult.allowed).toBe(false);
    expect(contactResult.allowed).toBe(true);
  });

  it('RecordUsageUseCase: should handle exactly 0 value (no-op)', async () => {
    // value 0 should not be recorded — it's meaningless
    const repo = mockRepo();
    const uc = new RecordUsageUseCase(repo as any);
    await expect(uc.execute({ tenantId: 't1', metric: 'aiMessages', value: 0 })).rejects.toThrow();
  });

  it('Quotas: should throw when conversations is negative', () => {
    expect(() => new Quotas({ aiMessages: 10, contacts: 100, conversations: -1 })).toThrow();
  });

  it('UsageRecord: should throw for future recordedAt beyond reasonable bound', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10);
    expect(() => UsageRecord.create({ tenantId: 't1', metric: 'aiMessages', value: 1, recordedAt: futureDate })).toThrow();
  });

  it('CheckQuotaUseCase: SQL injection in metric name should throw', async () => {
    const repo = mockRepo();
    const uc = new CheckQuotaUseCase(repo as any);
    await expect(uc.execute({ tenantId: 't1', metric: "'; DROP TABLE billing; --", requested: 1 })).rejects.toThrow();
  });

  it('CheckQuotaUseCase: metric with emoji should be rejected', async () => {
    const repo = mockRepo();
    const uc = new CheckQuotaUseCase(repo as any);
    await expect(uc.execute({ tenantId: 't1', metric: '🔥metric', requested: 1 })).rejects.toThrow();
  });

  it('RecordUsageUseCase: very large value should be accepted for unlimited plans', async () => {
    const repo = mockRepo();
    repo.recordUsage.mockResolvedValue(undefined);
    const uc = new RecordUsageUseCase(repo as any);
    await expect(uc.execute({ tenantId: 't1', metric: 'aiMessages', value: 100000 })).resolves.not.toThrow();
  });

  it('CancelSubscriptionUseCase: should handle payment gateway timeout gracefully', async () => {
    const repo = mockRepo();
    const payment = mockPayment();
    const eventBus = mockEventBus();
    const uc = new CancelSubscriptionUseCase(repo as any, payment as any, eventBus as any);
    repo.findByTenantId.mockResolvedValue({ id: 's1', status: 'ACTIVE', tenantId: 't1' });
    payment.cancelSubscription.mockRejectedValue(new Error('Gateway timeout'));
    await expect(uc.execute({ tenantId: 't1' })).rejects.toThrow('Gateway timeout');
  });

  it('BillingNicheResolver: should not throw for null input', () => {
    expect(() => BillingNicheResolver.resolveModules(null as any)).not.toThrow();
  });
});
