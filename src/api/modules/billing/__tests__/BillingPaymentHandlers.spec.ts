import { BillingPaymentHandlers } from '../application/handlers/BillingPaymentHandlers';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
  BillingSubscriptionOverdueIntegrationEvent,
} from '../application/integration-events/BillingIntegrationEvents';

describe('BillingPaymentHandlers', () => {
  let handlers: BillingPaymentHandlers;
  let eventBus: any;
  let billingRepo: any;
  let paymentService: any;
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
    };
    paymentService = {
      updateSubscription: jest.fn(),
      createSubscription: jest.fn(),
    };
    provisioningQueue = { add: jest.fn() };

    handlers = new BillingPaymentHandlers(
      eventBus,
      billingRepo,
      paymentService,
      provisioningQueue,
    );
    handlers.onModuleInit();
  });

  function getHandler(eventName: string) {
    return eventBus.subscribe.mock.calls.find(
      (call: any[]) => call[0] === eventName,
    )[1];
  }

  describe('payment.confirmed → activates subscription / renews cycle', () => {
    it('should renew cycle when confirmation is outside current cycle', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-1'),
        'ESSENCIAL',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-1',
          paymentId: 'pay-1',
          amount: 99,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'CYCLE_RENEWED' }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingCycleRenewedIntegrationEvent),
      );
    });

    it('should ignore duplicate confirmation inside the active cycle (idempotency)', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-2'),
        'ESSENCIAL',
      );
      subscription.activate();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-2',
          paymentId: 'pay-dup',
          amount: 99,
          confirmedAt: subscription.billingCycleStart.toISOString(),
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(billingRepo.saveUsage).not.toHaveBeenCalled();
    });

    it('should apply billing-upgrade reference and change plan', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-3'),
        'ESSENCIAL',
      );
      subscription.updateAsaasCustomer('cus-123');
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
      paymentService.createSubscription.mockResolvedValue({
        id: 'sub-new',
        status: 'ACTIVE',
      });

      await handler({
        payload: {
          tenantId: 'tenant-3',
          paymentId: 'pay-upgrade',
          amount: 297,
          confirmedAt: '2026-02-15T00:00:00.000Z',
          rawReference: 'billing-upgrade|tenant-3|PROFISSIONAL',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(subscription.asaasSubscriptionId).toBe('sub-new');
      expect(billingRepo.saveSubscription).toHaveBeenCalled();
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'CYCLE_RENEWED_UPGRADE' }),
      );
    });

    it('should do nothing when subscription does not exist', async () => {
      const handler = getHandler('payment.confirmed');
      billingRepo.findSubscription.mockResolvedValue(null);

      await handler({
        payload: {
          tenantId: 'tenant-missing',
          paymentId: 'pay-x',
          amount: 99,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
    });
  });

  describe('payment.overdue → marks subscription overdue', () => {
    it('should mark subscription as overdue and publish event', async () => {
      const handler = getHandler('payment.overdue');
      const subscription = Subscription.create(
        TenantId.create('tenant-4'),
        'PROFISSIONAL',
      );
      subscription.activate();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-4',
          paymentId: 'pay-overdue',
          overdueAt: new Date().toISOString(),
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'SUBSCRIPTION_OVERDUE' }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should not change status if already OVERDUE (idempotency)', async () => {
      const handler = getHandler('payment.overdue');
      const subscription = Subscription.create(
        TenantId.create('tenant-5'),
        'PROFISSIONAL',
      );
      subscription.markAsOverdue();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-5',
          paymentId: 'pay-overdue-2',
          overdueAt: new Date().toISOString(),
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
    });
  });

  describe('payment.refunded → marks subscription overdue', () => {
    it('should mark subscription as overdue on refund', async () => {
      const handler = getHandler('payment.refunded');
      const subscription = Subscription.create(
        TenantId.create('tenant-6'),
        'ESCALA',
      );
      subscription.activate();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-6',
          paymentId: 'pay-refund',
          refundedAt: new Date().toISOString(),
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });
  });
});
