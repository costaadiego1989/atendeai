import { CheckQuotaUseCase } from '../application/use-cases/CheckQuotaUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { TenantId } from '../../../shared/domain/TenantId';
import { UsageType } from '../application/use-cases/interfaces/IRecordUsageUseCase';

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
});
