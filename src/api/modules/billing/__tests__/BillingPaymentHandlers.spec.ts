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
      findActiveSubscriptionModule: jest.fn().mockResolvedValue(null),
      updateSubscriptionModuleStatus: jest.fn(),
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
        subscriptionId: 'sub-new',
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

  describe('cycle renewal → quota reset and addon expiry', () => {
    it('should create a new UsageRecord on renewal to reset quota counters', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-quota-reset'),
        'ESSENCIAL',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-quota-reset',
          paymentId: 'pay-quota',
          amount: 99,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      const savedUsage = billingRepo.saveUsage.mock.calls[0][0];
      // UsageRecord created fresh — period starts at confirmedAt, counters are zero
      expect(savedUsage.periodStart).toEqual(new Date('2026-02-15T00:00:00.000Z'));
      expect(savedUsage.messagesUsed).toBe(0);
      expect(savedUsage.aiTokensUsed).toBe(0);
    });

    it('should expire active addon package on cycle renewal', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-addon-expire'),
        'PROFISSIONAL',
        { quotas: { messages: 75000, aiTokens: 7500000, contacts: 2500 } as any },
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        moduleCode: 'quota-boost',
        monthlyPrice: 148.5,
        quotaImpact: { messages: 37500, aiTokens: 3750000, contacts: 1250 },
      });

      await handler({
        payload: {
          tenantId: 'tenant-addon-expire',
          paymentId: 'pay-renewal-addon',
          amount: 297,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(billingRepo.updateSubscriptionModuleStatus).toHaveBeenCalledWith(
        'tenant-addon-expire',
        'quota-boost',
        'EXPIRED',
        expect.any(Date),
      );
    });

    it('should not expire addon when none is active on renewal', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-no-addon'),
        'ESSENCIAL',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
      billingRepo.findSubscription.mockResolvedValue(subscription);
      // default mock: findActiveSubscriptionModule returns null

      await handler({
        payload: {
          tenantId: 'tenant-no-addon',
          paymentId: 'pay-no-addon',
          amount: 99,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(billingRepo.updateSubscriptionModuleStatus).not.toHaveBeenCalled();
    });

    it('should set billingCycleEnd to +12 months for YEARLY upgrade payment', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-yearly'),
        'ESSENCIAL',
      );
      subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
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
        subscriptionId: 'sub-yearly',
      });

      const confirmedAt = '2026-02-15T00:00:00.000Z';
      await handler({
        payload: {
          tenantId: 'tenant-yearly',
          paymentId: 'pay-yearly',
          amount: 2138.4,
          confirmedAt,
          rawReference: 'billing-upgrade|tenant-yearly|PROFISSIONAL|YEARLY',
        },
      });

      expect(subscription.billingCycleType).toBe('YEARLY');
      const expectedEnd = new Date(confirmedAt);
      expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);
      expect(subscription.billingCycleEnd).toEqual(expectedEnd);
    });

    it('should handle billing-addon reference and confirm addon payment', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = Subscription.create(
        TenantId.create('tenant-addon-pay'),
        'PROFISSIONAL',
      );
      subscription.activate();
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        moduleCode: 'quota-boost',
        monthlyPrice: 148.5,
        quotaImpact: { messages: 37500, aiTokens: 3750000, contacts: 1250 },
      });

      await handler({
        payload: {
          tenantId: 'tenant-addon-pay',
          paymentId: 'pay-addon-confirm',
          amount: 148.5,
          confirmedAt: '2026-02-15T00:00:00.000Z',
          rawReference: 'billing-addon|tenant-addon-pay|quota-boost',
        },
      });

      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'ADDON_PACKAGE_PAYMENT_CONFIRMED' }),
      );
      // Addon payment confirmation should NOT trigger a full cycle renewal
      expect(billingRepo.saveUsage).not.toHaveBeenCalled();
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
