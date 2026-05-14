import { BillingTenantHandlers } from '../application/handlers/BillingTenantHandlers';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import { BillingSubscriptionActivatedIntegrationEvent } from '../application/integration-events/BillingIntegrationEvents';

describe('BillingTenantHandlers', () => {
  let handlers: BillingTenantHandlers;
  let eventBus: any;
  let billingRepo: any;
  let provisioningQueue: any;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn(), publish: jest.fn() };
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      saveAuditLog: jest.fn(),
      findPlanByCode: jest.fn(),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
      getUsage: jest.fn(),
    };
    provisioningQueue = { add: jest.fn() };

    handlers = new BillingTenantHandlers(
      eventBus,
      billingRepo,
      provisioningQueue,
    );
    handlers.onModuleInit();
  });

  function getHandler(eventName: string) {
    return eventBus.subscribe.mock.calls.find(
      (call: any[]) => call[0] === eventName,
    )[1];
  }

  describe('tenant.created → provisions subscription', () => {
    it('should create a new subscription and enqueue provisioning', async () => {
      const handler = getHandler('tenant.created');
      billingRepo.findSubscription.mockResolvedValue(null);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await handler({
        payload: {
          aggregateId: 'tenant-1',
          companyName: 'Acme',
          cnpj: '12345678000100',
          plan: 'PROFISSIONAL',
          ownerName: 'John',
          ownerEmail: 'john@acme.com',
          ownerPhone: '11999999999',
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          event: 'SUBSCRIPTION_CREATED',
          newPlan: 'PROFISSIONAL',
        }),
      );
      expect(provisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        expect.objectContaining({
          tenantId: 'tenant-1',
          plan: 'PROFISSIONAL',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should publish BillingSubscriptionActivated for ESSENCIAL plan (auto-active)', async () => {
      const handler = getHandler('tenant.created');
      billingRepo.findSubscription.mockResolvedValue(null);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await handler({
        payload: {
          aggregateId: 'tenant-2',
          companyName: 'Acme',
          cnpj: '12345678000100',
          plan: 'ESSENCIAL',
          ownerName: 'John',
          ownerEmail: 'john@acme.com',
          ownerPhone: '11999999999',
        },
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
    });

    it('should skip (idempotent) when subscription already provisioned with asaas info', async () => {
      const handler = getHandler('tenant.created');
      const existing = Subscription.create(
        TenantId.create('tenant-3'),
        'PROFISSIONAL',
      );
      existing.updateAsaasInfo('cus-1', 'sub-1');
      billingRepo.findSubscription.mockResolvedValue(existing);
      billingRepo.findPlanByCode.mockResolvedValue(null);
      billingRepo.listSubscriptionModules.mockResolvedValue([]);

      await handler({
        payload: {
          aggregateId: 'tenant-3',
          companyName: 'Acme',
          cnpj: '12345678000100',
          plan: 'PROFISSIONAL',
          ownerName: 'John',
          ownerEmail: 'john@acme.com',
          ownerPhone: '11999999999',
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(provisioningQueue.add).not.toHaveBeenCalled();
    });

    it('should update plan when existing subscription has no asaas info', async () => {
      const handler = getHandler('tenant.created');
      const existing = Subscription.create(
        TenantId.create('tenant-4'),
        'ESSENCIAL',
      );
      billingRepo.findSubscription.mockResolvedValue(existing);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
        messagesQuota: 75000,
        aiTokensQuota: 7500000,
        contactsQuota: 2500,
        config: {},
      });
      billingRepo.listSubscriptionModules.mockResolvedValue([]);

      await handler({
        payload: {
          aggregateId: 'tenant-4',
          companyName: 'Acme',
          cnpj: '12345678000100',
          plan: 'PROFISSIONAL',
          ownerName: 'John',
          ownerEmail: 'john@acme.com',
          ownerPhone: '11999999999',
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(existing.plan).toBe('PROFISSIONAL');
    });

    it('should NOT enqueue provision-tenant when isTrial is true', async () => {
      const handler = getHandler('tenant.created');
      billingRepo.findSubscription.mockResolvedValue(null);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await handler({
        payload: {
          aggregateId: 'tenant-trial',
          companyName: 'Trial Co',
          cnpj: '12345678000100',
          plan: 'PROFISSIONAL',
          ownerName: 'John',
          ownerEmail: 'john@trial.com',
          ownerPhone: '11999999999',
          isTrial: true,
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(provisioningQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('tenant.plan-changed → updates subscription plan', () => {
    it('should change plan and enqueue provisioning when no asaas subscription', async () => {
      const handler = getHandler('tenant.plan-changed');
      const subscription = Subscription.create(
        TenantId.create('tenant-5'),
        'ESSENCIAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue(null);
      billingRepo.listSubscriptionModules.mockResolvedValue([]);

      await handler({
        payload: {
          aggregateId: 'tenant-5',
          oldPlan: 'ESSENCIAL',
          newPlan: 'PROFISSIONAL',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-5',
          event: 'PLAN_CHANGED',
          oldPlan: 'ESSENCIAL',
          newPlan: 'PROFISSIONAL',
        }),
      );
      expect(provisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        expect.objectContaining({ tenantId: 'tenant-5', plan: 'PROFISSIONAL' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should gracefully skip when subscription does not exist', async () => {
      const handler = getHandler('tenant.plan-changed');
      billingRepo.findSubscription.mockResolvedValue(null);

      await handler({
        payload: {
          aggregateId: 'tenant-missing',
          oldPlan: 'ESSENCIAL',
          newPlan: 'PROFISSIONAL',
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(provisioningQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('payment.trial-subscription-initiated → activates subscription', () => {
    it('should create subscription and activate when none exists', async () => {
      const handler = getHandler('payment.trial-subscription-initiated.v1');
      billingRepo.findSubscription.mockResolvedValue(null);
      billingRepo.findPlanByCode.mockResolvedValue(null);
      billingRepo.getUsage.mockResolvedValue(null);

      await handler({
        payload: {
          tenantId: 'tenant-6',
          asaasCustomerId: 'cus-trial',
          asaasSubscriptionId: 'sub-trial',
          plan: 'PROFISSIONAL',
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      const savedSub = billingRepo.saveSubscription.mock.calls[0][0];
      expect(savedSub.status).toBe('ACTIVE');
      expect(savedSub.asaasCustomerId).toBe('cus-trial');
      expect(savedSub.asaasSubscriptionId).toBe('sub-trial');
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-6',
          event: 'TRIAL_ACTIVATED',
        }),
      );
    });

    it('should update existing subscription with asaas info and activate', async () => {
      const handler = getHandler('payment.trial-subscription-initiated.v1');
      const existing = Subscription.create(
        TenantId.create('tenant-7'),
        'ESSENCIAL',
      );
      billingRepo.findSubscription.mockResolvedValue(existing);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
        messagesQuota: 75000,
        aiTokensQuota: 7500000,
        contactsQuota: 2500,
        config: {},
      });
      billingRepo.listSubscriptionModules.mockResolvedValue([]);
      billingRepo.getUsage.mockResolvedValue(null);

      await handler({
        payload: {
          tenantId: 'tenant-7',
          asaasCustomerId: 'cus-trial-2',
          asaasSubscriptionId: 'sub-trial-2',
          plan: 'PROFISSIONAL',
        },
      });

      expect(existing.status).toBe('ACTIVE');
      expect(existing.asaasCustomerId).toBe('cus-trial-2');
      expect(existing.plan).toBe('PROFISSIONAL');
    });
  });
});
