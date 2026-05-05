import { GetUsageUseCase } from '../application/use-cases/GetUsageUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { TenantId } from '../../../shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('GetUsageUseCase', () => {
  let useCase: GetUsageUseCase;
  let billingRepo: any;

  beforeEach(() => {
    billingRepo = { findSubscription: jest.fn(), getUsage: jest.fn() };
    useCase = new GetUsageUseCase(billingRepo);
  });

  it('should throw EntityNotFoundException if no subscription', async () => {
    billingRepo.findSubscription.mockResolvedValue(null);
    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('should return combined usage and quota info', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    const usage = UsageRecord.create(
      TenantId.create('t1'),
      new Date(),
      new Date(),
    );
    usage.recordMessage();

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.getUsage.mockResolvedValue(usage);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.plan).toBe('PROFISSIONAL');
    expect(result.usage.messages.used).toBe(1);
    expect(result.usage.messages.quota).toBe(sub.quotas.messages);
  });
});
