import { BillingPlanChangeProcessor } from '../application/processors/BillingPlanChangeProcessor';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
} from '../application/integration-events/BillingIntegrationEvents';

describe('BillingPlanChangeProcessor', () => {
  let processor: BillingPlanChangeProcessor;
  let billingRepository: any;
  let eventBus: any;

  beforeEach(() => {
    billingRepository = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
    };

    processor = new BillingPlanChangeProcessor(
      billingRepository,
      eventBus,
    );
  });

  it('should apply scheduled downgrade to ESSENCIAL and reset usage', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'PROFISSIONAL',
    );
    subscription.schedulePlanChange('ESSENCIAL');
    billingRepository.findSubscription.mockResolvedValue(subscription);

    await processor.process({
      data: {
        tenantId: 'tenant-1',
        targetPlan: 'ESSENCIAL',
        effectiveAt: '2026-03-30T12:00:00.000Z',
      },
    } as any);

    expect(subscription.plan).toBe('ESSENCIAL');
    expect(subscription.scheduledPlan).toBeUndefined();
    expect(billingRepository.saveSubscription).toHaveBeenCalledWith(subscription);
    expect(billingRepository.saveUsage).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(BillingSubscriptionActivatedIntegrationEvent),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(BillingCycleRenewedIntegrationEvent),
    );
  });
});
