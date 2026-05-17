jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn(
    (
      _spanName: string,
      _attrs: Record<string, string>,
      fn: () => Promise<unknown>,
    ) => fn(),
  ),
}));

import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { RecordUsageUseCase } from '../application/use-cases/RecordUsageUseCase';
import { UsageType } from '../application/use-cases/interfaces/IRecordUsageUseCase';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';

describe('RecordUsageUseCase', () => {
  let useCase: RecordUsageUseCase;
  let billingRepo: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      getUsage: jest.fn(),
      saveUsage: jest.fn(),
    };
    useCase = new RecordUsageUseCase(billingRepo);
    jest.mocked(traceAsync).mockClear();
  });

  it('should create new usage record if none exists and record usage', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'ESSENCIAL',
    );
    billingRepo.findSubscription.mockResolvedValue(subscription);
    billingRepo.getUsage.mockResolvedValue(null);

    await useCase.execute({ tenantId: 'tenant-1', type: UsageType.MESSAGE });

    expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
    const savedUsage = billingRepo.saveUsage.mock.calls[0][0] as UsageRecord;
    expect(savedUsage.messagesUsed).toBe(1);
  });

  it('should update existing usage record', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'ESSENCIAL',
    );
    const existingUsage = UsageRecord.create(
      TenantId.create('tenant-1'),
      subscription.billingCycleStart,
      subscription.billingCycleEnd,
    );
    billingRepo.findSubscription.mockResolvedValue(subscription);
    billingRepo.getUsage.mockResolvedValue(existingUsage);

    await useCase.execute({
      tenantId: 'tenant-1',
      type: UsageType.AI_TOKEN,
      amount: 150,
    });

    expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
    const savedUsage = billingRepo.saveUsage.mock.calls[0][0] as UsageRecord;
    expect(savedUsage.aiTokensUsed).toBe(150);
  });

  it('delegates execution to traceAsync with billing.record_usage span', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'ESSENCIAL',
    );
    billingRepo.findSubscription.mockResolvedValue(subscription);
    billingRepo.getUsage.mockResolvedValue(null);

    await useCase.execute({ tenantId: 'tenant-1', type: UsageType.MESSAGE });

    expect(traceAsync).toHaveBeenCalledWith(
      'billing.record_usage',
      { 'tenant.id': 'tenant-1', 'usage.type': 'MESSAGE' },
      expect.any(Function),
    );
  });
});
