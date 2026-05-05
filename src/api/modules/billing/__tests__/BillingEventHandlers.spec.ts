import { BillingEventHandlers } from '../application/handlers/BillingEventHandlers';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
  BillingSubscriptionOverdueIntegrationEvent,
} from '../application/integration-events/BillingIntegrationEvents';

describe('BillingEventHandlers', () => {
  let handlers: BillingEventHandlers;
  let eventBus: any;
  let billingRepo: any;
  let recordUsageUseCase: any;
  let paymentService: any;
  let provisioningQueue: any;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn(), publish: jest.fn() };
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      findPlanByCode: jest.fn(),
    };
    recordUsageUseCase = { execute: jest.fn() };
    paymentService = {
      updateSubscription: jest.fn(),
      createSubscription: jest.fn(),
    };
    provisioningQueue = { add: jest.fn() };

    handlers = new BillingEventHandlers(
      eventBus,
      billingRepo,
      recordUsageUseCase,
      paymentService,
      provisioningQueue,
    );
    handlers.onModuleInit();
  });

  describe('tenant.created event', () => {
    let tenantCreatedHandler: any;

    beforeEach(() => {
      tenantCreatedHandler = eventBus.subscribe.mock.calls.find(
        (call: any[]) => call[0] === 'tenant.created',
      )[1];
    });

    it('should successfully enqueue provisioning job on Asaas', async () => {
      const payload = {
        aggregateId: 'tenant-123',
        companyName: 'Company',
        plan: 'PROFISSIONAL',
        ownerName: 'Test',
        ownerEmail: 'test@t.com',
        cnpj: '123',
        ownerPhone: '123',
      };

      billingRepo.findSubscription.mockResolvedValue(null);

      await tenantCreatedHandler({ payload });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(provisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        expect.objectContaining({
          tenantId: 'tenant-123',
          companyName: 'Company',
          plan: 'PROFISSIONAL',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should skip queueing when the existing subscription is already provisioned', async () => {
      const existing = Subscription.create(
        TenantId.create('tenant-123'),
        'PROFISSIONAL',
      );
      existing.updateAsaasInfo('cus-1', 'sub-1');
      billingRepo.findSubscription.mockResolvedValue(existing);

      await tenantCreatedHandler({
        payload: {
          aggregateId: 'tenant-123',
          companyName: 'Company',
          plan: 'PROFISSIONAL',
          ownerName: 'Test',
          ownerEmail: 'test@t.com',
          cnpj: '123',
          ownerPhone: '123',
        },
      });

      expect(provisioningQueue.add).not.toHaveBeenCalled();
    });

    it('should publish subscription activated and enqueue customer provisioning for ESSENCIAL tenants', async () => {
      billingRepo.findSubscription.mockResolvedValue(null);

      await tenantCreatedHandler({
        payload: {
          aggregateId: 'tenant-123',
          companyName: 'Company',
          plan: 'ESSENCIAL',
          ownerName: 'Test',
          ownerEmail: 'test@t.com',
          cnpj: '123',
          ownerPhone: '123',
        },
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
      expect(provisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        expect.objectContaining({
          tenantId: 'tenant-123',
          plan: 'ESSENCIAL',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('tenant.plan-changed event', () => {
    let tenantPlanChangedHandler: any;

    beforeEach(() => {
      tenantPlanChangedHandler = eventBus.subscribe.mock.calls.find(
        (call: any[]) => call[0] === 'tenant.plan-changed',
      )[1];
    });

    it('should update plan and enqueue provisioning for paid plans without external subscription', async () => {
      const subscription = Subscription.create(TenantId.create('tenant-123'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await tenantPlanChangedHandler({
        payload: {
          aggregateId: 'tenant-123',
          oldPlan: 'ESSENCIAL',
          newPlan: 'PROFISSIONAL',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(provisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        expect.objectContaining({
          tenantId: 'tenant-123',
          plan: 'PROFISSIONAL',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('payment.confirmed event', () => {
    let paymentConfirmedHandler: any;

    beforeEach(() => {
      paymentConfirmedHandler = eventBus.subscribe.mock.calls.find(
        (call: any[]) => call[0] === 'payment.confirmed',
      )[1];
    });

    it('should ignore duplicate confirmation inside the active cycle', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-123'),
        'ESSENCIAL',
      );
      subscription.activate();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await paymentConfirmedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-1',
          amount: 99,
          confirmedAt: new Date(subscription.billingCycleStart),
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(billingRepo.saveUsage).not.toHaveBeenCalled();
    });

    it('should renew the cycle and recreate usage when confirmation is outside the current cycle', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-123'),
        'ESSENCIAL',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await paymentConfirmedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-2',
          amount: 99,
          confirmedAt: new Date('2026-02-15T00:00:00.000Z'),
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingCycleRenewedIntegrationEvent),
      );
    });

    it('should apply scheduled downgrade on the next paid renewal', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-123'),
        'ESCALA',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      subscription.schedulePlanChange('PROFISSIONAL');
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await paymentConfirmedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-3',
          amount: 199,
          confirmedAt: new Date('2026-02-15T00:00:00.000Z'),
          rawReference: 'tenant-123',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(subscription.scheduledPlan).toBeUndefined();
      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
    });

    it('should activate upgraded plan only after payment confirmation', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-123'),
        'ESSENCIAL',
      );
      subscription.updateAsaasCustomer('cus_123');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue({
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
      });
      paymentService.createSubscription.mockResolvedValue({
        id: 'sub_new',
        status: 'ACTIVE',
        value: 199,
        billingType: 'CREDIT_CARD',
        nextDueDate: '2026-03-15',
      });

      await paymentConfirmedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-upgrade',
          amount: 199,
          confirmedAt: new Date('2026-02-15T00:00:00.000Z'),
          rawReference: 'billing-upgrade|tenant-123|PROFISSIONAL',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(paymentService.createSubscription).toHaveBeenCalled();
      expect(subscription.asaasSubscriptionId).toBe('sub_new');
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
    });
  });

  describe('payment.overdue and payment.refunded events', () => {
    let paymentOverdueHandler: any;
    let paymentRefundedHandler: any;

    beforeEach(() => {
      paymentOverdueHandler = eventBus.subscribe.mock.calls.find(
        (call: any[]) => call[0] === 'payment.overdue',
      )[1];
      paymentRefundedHandler = eventBus.subscribe.mock.calls.find(
        (call: any[]) => call[0] === 'payment.refunded',
      )[1];
    });

    it('should mark the subscription as overdue for overdue payments', async () => {
      const subscription = Subscription.create(TenantId.create('tenant-123'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await paymentOverdueHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-3',
          overdueAt: new Date(),
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should mark the subscription as overdue for refunded payments', async () => {
      const subscription = Subscription.create(TenantId.create('tenant-123'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await paymentRefundedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-4',
          refundedAt: new Date(),
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should ignore overdue and refunded events when the subscription does not exist', async () => {
      billingRepo.findSubscription.mockResolvedValue(null);

      await paymentOverdueHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-5',
          overdueAt: new Date(),
        },
      });
      await paymentRefundedHandler({
        payload: {
          tenantId: 'tenant-123',
          paymentId: 'pay-6',
          refundedAt: new Date(),
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
    });
  });
});
