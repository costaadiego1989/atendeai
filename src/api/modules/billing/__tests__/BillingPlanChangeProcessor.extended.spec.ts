jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn(
    (
      _spanName: string,
      _attrs: Record<string, string>,
      fn: () => Promise<unknown>,
    ) => fn(),
  ),
}));

import { BillingPlanChangeProcessor } from '../application/processors/BillingPlanChangeProcessor';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
} from '../application/integration-events/BillingIntegrationEvents';

describe('BillingPlanChangeProcessor (extended)', () => {
  let processor: BillingPlanChangeProcessor;
  let billingRepo: any;
  let eventBus: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      findPlanByCode: jest.fn(),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
    };
    eventBus = {
      publish: jest.fn(),
    };

    processor = new BillingPlanChangeProcessor(billingRepo, eventBus);
  });

  function makeJob(data: any) {
    return { data } as any;
  }

  describe('process plan upgrade → adjusts quotas', () => {
    it('should apply upgrade from ESSENCIAL to PROFISSIONAL', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-1'),
        'ESSENCIAL',
      );
      subscription.schedulePlanChange('PROFISSIONAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
        messagesQuota: 75000,
        aiTokensQuota: 7500000,
        contactsQuota: 2500,
        config: {},
      });

      await processor.process(
        makeJob({
          tenantId: 'tenant-1',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(subscription.quotas.messages).toBe(75000);
      expect(subscription.quotas.contacts).toBe(2500);
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
    });
  });

  describe('process plan downgrade → adjusts quotas', () => {
    it('should apply downgrade from ESCALA to ESSENCIAL', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-2'),
        'ESCALA',
      );
      subscription.schedulePlanChange('ESSENCIAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'ESSENCIAL',
        displayName: 'Essencial',
        monthlyPrice: 97,
        messagesQuota: 15000,
        aiTokensQuota: 1500000,
        contactsQuota: 500,
        config: {},
      });

      await processor.process(
        makeJob({
          tenantId: 'tenant-2',
          targetPlan: 'ESSENCIAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(subscription.plan).toBe('ESSENCIAL');
      expect(subscription.quotas.messages).toBe(15000);
      expect(subscription.quotas.contacts).toBe(500);
      expect(subscription.scheduledPlan).toBeUndefined();
    });
  });

  describe('process with modules change', () => {
    it('should include addon modules in commercial state', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-3'),
        'ESSENCIAL',
      );
      subscription.schedulePlanChange('PROFISSIONAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
        messagesQuota: 75000,
        aiTokensQuota: 7500000,
        contactsQuota: 2500,
        config: { modules: { crm: true } },
      });
      billingRepo.listSubscriptionModules.mockResolvedValue([
        {
          moduleCode: 'prospecting',
          status: 'ACTIVE',
          monthlyPrice: 49,
          pricingVersion: null,
        },
      ]);

      await processor.process(
        makeJob({
          tenantId: 'tenant-3',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(subscription.totalMonthlyPrice).toBe(297 + 49);
    });
  });

  describe('publishes PlanChanged events', () => {
    it('should publish BillingSubscriptionActivated and BillingCycleRenewed', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-4'),
        'ESSENCIAL',
      );
      subscription.schedulePlanChange('PROFISSIONAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await processor.process(
        makeJob({
          tenantId: 'tenant-4',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingCycleRenewedIntegrationEvent),
      );
    });
  });

  describe('no-op when conditions not met', () => {
    it('should skip when subscription does not exist', async () => {
      billingRepo.findSubscription.mockResolvedValue(null);

      await processor.process(
        makeJob({
          tenantId: 'tenant-missing',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should skip when scheduledPlan does not match targetPlan (concurrent change)', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-5'),
        'ESSENCIAL',
      );
      subscription.schedulePlanChange('ESCALA');
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await processor.process(
        makeJob({
          tenantId: 'tenant-5',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-03-01T00:00:00.000Z',
        }),
      );

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(subscription.plan).toBe('ESSENCIAL');
    });
  });

  describe('usage reset on plan change', () => {
    it('should create new usage record after plan change', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-6'),
        'ESSENCIAL',
      );
      subscription.schedulePlanChange('PROFISSIONAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await processor.process(
        makeJob({
          tenantId: 'tenant-6',
          targetPlan: 'PROFISSIONAL',
          effectiveAt: '2026-04-01T00:00:00.000Z',
        }),
      );

      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      const savedUsage = billingRepo.saveUsage.mock.calls[0][0];
      expect(savedUsage.tenantId.toValue()).toBe('tenant-6');
    });
  });
});
