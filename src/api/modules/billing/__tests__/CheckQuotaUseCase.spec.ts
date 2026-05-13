import { CheckQuotaUseCase } from '../application/use-cases/CheckQuotaUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { TenantId } from '../../../shared/domain/TenantId';
import { UsageType } from '../application/use-cases/interfaces/IRecordUsageUseCase';
import { BillingQuotaExceededIntegrationEvent, BillingQuotaWarningIntegrationEvent } from '../application/integration-events/BillingIntegrationEvents';

describe('CheckQuotaUseCase', () => {
  let useCase: CheckQuotaUseCase;
  let billingRepo: any;
  let eventBus: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      getUsage: jest.fn(),
      saveAuditLog: jest.fn(),
      saveSubscription: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    useCase = new CheckQuotaUseCase(billingRepo, eventBus);
  });

  it('should decline if no subscription', async () => {
    billingRepo.findSubscription.mockResolvedValue(null);
    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });
    expect(result.canProceed).toBe(false);
  });

  it('should decline if subscription is OVERDUE', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    sub.markAsOverdue();
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });
    expect(result.canProceed).toBe(false);
  });

  it('should approve if usage is under quota', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage); // 0 used

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });
    expect(result.canProceed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.quota).toBe(sub.quotas.messages);
  });

  it('should decline if usage is over quota', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    for (let i = 0; i < sub.quotas.messages + 1; i++) usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });
    expect(result.canProceed).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.1: Quota exceeded publishes BillingQuotaExceededIntegrationEvent
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should publish BillingQuotaExceededIntegrationEvent when quota is exceeded', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Exceed the message quota
    for (let i = 0; i <= sub.quotas.messages; i++) usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    await useCase.execute({ tenantId: 't1', type: UsageType.MESSAGE });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = eventBus.publish.mock.calls[0][0];
    expect(event).toBeInstanceOf(BillingQuotaExceededIntegrationEvent);
    expect(event.payload.tenantId).toBe('t1');
    expect(event.payload.type).toBe(UsageType.MESSAGE);
    expect(event.payload.used).toBe(sub.quotas.messages + 1);
    expect(event.payload.quota).toBe(sub.quotas.messages);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.2: Quota warning 80% publishes BillingQuotaWarningIntegrationEvent
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should publish BillingQuotaWarningIntegrationEvent at 80% usage', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Set usage to exactly 80% of quota
    const target = Math.ceil(sub.quotas.messages * 0.8);
    for (let i = 0; i < target; i++) usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    await useCase.execute({ tenantId: 't1', type: UsageType.MESSAGE });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = eventBus.publish.mock.calls[0][0];
    expect(event).toBeInstanceOf(BillingQuotaWarningIntegrationEvent);
    expect(event.payload.tenantId).toBe('t1');
    expect(event.payload.type).toBe(UsageType.MESSAGE);
    expect(event.payload.percentUsed).toBeGreaterThanOrEqual(80);
    expect(billingRepo.saveSubscription).toHaveBeenCalledWith(sub);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.3: Warning debounce 24h — does not republish
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should NOT republish warning if lastQuotaAlertAt is within 24h', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    // Simulate alert sent 1 hour ago
    sub.recordQuotaAlert(new Date(Date.now() - 1 * 60 * 60 * 1000));

    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Set usage to 85% of quota (above 80% threshold)
    const target = Math.ceil(sub.quotas.messages * 0.85);
    for (let i = 0; i < target; i++) usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    await useCase.execute({ tenantId: 't1', type: UsageType.MESSAGE });

    // Should NOT publish any event due to debounce
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.4: AI_TOKEN type works correctly
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should check AI_TOKEN quota correctly', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Record some AI tokens (under quota)
    usage.recordTokens(1000);

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.AI_TOKEN,
    });

    expect(result.canProceed).toBe(true);
    expect(result.used).toBe(1000);
    expect(result.quota).toBe(sub.quotas.aiTokens);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.5: CONTACT type works correctly
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should check CONTACT quota correctly', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Record contacts up to quota limit
    for (let i = 0; i <= sub.quotas.contacts; i++) usage.recordContact();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.CONTACT,
    });

    expect(result.canProceed).toBe(false);
    expect(result.used).toBe(sub.quotas.contacts + 1);
    expect(result.quota).toBe(sub.quotas.contacts);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.6: Usage null returns used=0
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should return used=0 when usage record is null', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(null);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });

    expect(result.canProceed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.quota).toBe(sub.quotas.messages);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.7: Subscription with billingCycleEnd in the past → canProceed=false
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should decline if billingCycleEnd is in the past (expired cycle)', async () => {
    const tenantId = TenantId.create('t1');
    const sub = Subscription.create(tenantId, 'ESSENCIAL');
    // Force the billing cycle to be in the past
    const pastStart = new Date('2025-01-01');
    const pastEnd = new Date('2025-01-31');
    sub.renewCycleFrom(pastStart);
    // renewCycleFrom sets cycleEnd to +1 month from pastStart (2025-02-01)
    // but we need it truly in the past, so use reconstitute instead

    const expiredSub = Subscription.reconstitute(
      {
        tenantId,
        plan: 'ESSENCIAL',
        status: 'ACTIVE',
        quotas: sub.quotas,
        billingCycleStart: pastStart,
        billingCycleEnd: pastEnd,
        baseMonthlyPrice: 9700,
        addonsMonthlyPrice: 0,
        totalMonthlyPrice: 9700,
        pricingSnapshot: {},
        config: {},
        createdAt: pastStart,
      },
      sub.id,
    );

    const usage = UsageRecord.create(tenantId, pastStart, pastEnd);

    billingRepo.findSubscription.mockResolvedValue(expiredSub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });

    // isActive() checks status === 'ACTIVE' && new Date() <= billingCycleEnd
    // Since billingCycleEnd is in the past, isActive() returns false
    expect(result.canProceed).toBe(false);
    expect(result.status).toBe('ACTIVE');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2.8: Addon boost increases quota — canProceed=true when base exceeded
  // ═══════════════════════════════════════════════════════════════════════════════

  it('should allow usage when addon boost increases quota above used amount', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    // Simulate addon boost: add half of ESSENCIAL quotas (7500 messages)
    sub.adjustQuotas({ messages: 7500, aiTokens: 750000, contacts: 250 });

    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );

    // Use 16000 messages — exceeds base quota (15000) but within boosted quota (22500)
    for (let i = 0; i < 16000; i++) usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({
      tenantId: 't1',
      type: UsageType.MESSAGE,
    });

    expect(result.canProceed).toBe(true);
    expect(result.used).toBe(16000);
    expect(result.quota).toBe(15000 + 7500); // base + addon
  });
});
