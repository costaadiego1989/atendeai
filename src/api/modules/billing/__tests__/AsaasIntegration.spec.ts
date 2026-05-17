import { BillingPaymentHandlers } from '../application/handlers/BillingPaymentHandlers';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import { ADDON_PACKAGE_MODULE_CODE } from '../domain/constants/AddonPackages';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
  BillingSubscriptionOverdueIntegrationEvent,
} from '../application/integration-events/BillingIntegrationEvents';

describe('Asaas Integration — BillingPaymentHandlers', () => {
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
      cancelSubscription: jest.fn(),
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

  function createActiveSubscription(
    tenantId: string,
    plan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA' = 'PROFISSIONAL',
  ) {
    const subscription = Subscription.create(TenantId.create(tenantId), plan);
    subscription.activate();
    subscription.renewCycleFrom(new Date('2026-01-01T00:00:00.000Z'));
    return subscription;
  }

  // ─── 1. Webhook Quota Grant (addon payment confirmed) ───────────────────────

  describe('Scenario 1: Webhook Quota Grant — addon payment confirmed', () => {
    it('should log addon payment confirmation when active module exists', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription('tenant-addon-1');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-addon-1',
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        status: 'ACTIVE',
        monthlyPrice: 49,
        quotaImpact: { messages: 5000, aiTokens: 1000000, contacts: 0 },
        startedAt: new Date('2026-01-15T00:00:00.000Z'),
      });

      await handler({
        payload: {
          tenantId: 'tenant-addon-1',
          paymentId: 'pay-addon-1',
          amount: 49,
          confirmedAt: '2026-01-16T10:00:00.000Z',
          rawReference: `billing-addon|tenant-addon-1|${ADDON_PACKAGE_MODULE_CODE}`,
        },
      });

      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-addon-1',
          event: 'ADDON_PACKAGE_PAYMENT_CONFIRMED',
          metadata: expect.objectContaining({
            moduleCode: ADDON_PACKAGE_MODULE_CODE,
            plan: 'PROFISSIONAL',
            price: 49,
          }),
        }),
      );
      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(billingRepo.saveUsage).not.toHaveBeenCalled();
    });

    it('should warn and do nothing when addon module not found', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription('tenant-addon-2');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);

      await handler({
        payload: {
          tenantId: 'tenant-addon-2',
          paymentId: 'pay-addon-2',
          amount: 49,
          confirmedAt: '2026-01-16T10:00:00.000Z',
          rawReference: `billing-addon|tenant-addon-2|${ADDON_PACKAGE_MODULE_CODE}`,
        },
      });

      expect(billingRepo.saveAuditLog).not.toHaveBeenCalled();
      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
    });
  });

  // ─── 2. Addon Contratação — addon reference takes priority ──────────────────

  describe('Scenario 2: Addon contratação — addon reference takes priority over cycle renewal', () => {
    it('should handle addon reference and NOT trigger cycle renewal', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription('tenant-contract-1');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-contract-1',
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        status: 'ACTIVE',
        monthlyPrice: 49,
        quotaImpact: { messages: 5000, aiTokens: 1000000, contacts: 0 },
        startedAt: new Date('2026-01-15T00:00:00.000Z'),
      });

      const originalCycleStart = subscription.billingCycleStart.toISOString();

      await handler({
        payload: {
          tenantId: 'tenant-contract-1',
          paymentId: 'pay-contract-1',
          amount: 49,
          confirmedAt: '2026-02-15T10:00:00.000Z',
          rawReference: `billing-addon|tenant-contract-1|${ADDON_PACKAGE_MODULE_CODE}`,
        },
      });

      expect(subscription.billingCycleStart.toISOString()).toBe(
        originalCycleStart,
      );
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.any(BillingCycleRenewedIntegrationEvent),
      );
    });
  });

  // ─── 3. Plan Change — upgrade via billing-upgrade reference ─────────────────

  describe('Scenario 3: Plan Change — upgrade confirmed via webhook', () => {
    it('should upgrade plan from ESSENCIAL to PROFISSIONAL on billing-upgrade reference', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription(
        'tenant-upgrade-1',
        'ESSENCIAL',
      );
      subscription.updateAsaasCustomer('cus-upgrade-1');
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
        id: 'sub-new-upgrade',
        status: 'ACTIVE',
      });

      await handler({
        payload: {
          tenantId: 'tenant-upgrade-1',
          paymentId: 'pay-upgrade-1',
          amount: 297,
          confirmedAt: '2026-02-15T00:00:00.000Z',
          rawReference: 'billing-upgrade|tenant-upgrade-1|PROFISSIONAL',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.asaasSubscriptionId).toBe('sub-new-upgrade');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-upgrade-1',
          event: 'CYCLE_RENEWED_UPGRADE',
          oldPlan: 'ESSENCIAL',
          newPlan: 'PROFISSIONAL',
        }),
      );
      expect(billingRepo.saveUsage).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionActivatedIntegrationEvent),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingCycleRenewedIntegrationEvent),
      );
    });

    it('should apply scheduled downgrade on next cycle renewal', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription(
        'tenant-downgrade-1',
        'ESCALA',
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

      await handler({
        payload: {
          tenantId: 'tenant-downgrade-1',
          paymentId: 'pay-cycle-1',
          amount: 297,
          confirmedAt: '2026-02-15T00:00:00.000Z',
        },
      });

      expect(subscription.plan).toBe('PROFISSIONAL');
      expect(subscription.scheduledPlan).toBeUndefined();
      expect(subscription.status).toBe('ACTIVE');
      expect(billingRepo.saveSubscription).toHaveBeenCalled();
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'CYCLE_RENEWED' }),
      );
    });

    it('should expire addon package on cycle renewal during upgrade', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription(
        'tenant-upgrade-expire',
        'ESSENCIAL',
      );
      subscription.updateAsaasCustomer('cus-expire-1');
      subscription.adjustQuotas({
        messages: 5000,
        aiTokens: 1000000,
        contacts: 0,
      });
      subscription.updatePricing({
        baseMonthlyPrice: 99,
        addonsMonthlyPrice: 49,
      });

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
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-upgrade-expire',
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        status: 'ACTIVE',
        monthlyPrice: 49,
        quotaImpact: { messages: 5000, aiTokens: 1000000, contacts: 0 },
        startedAt: new Date('2026-01-15T00:00:00.000Z'),
      });
      paymentService.createSubscription.mockResolvedValue({
        id: 'sub-new-2',
        status: 'ACTIVE',
      });

      await handler({
        payload: {
          tenantId: 'tenant-upgrade-expire',
          paymentId: 'pay-upgrade-expire',
          amount: 297,
          confirmedAt: '2026-02-15T00:00:00.000Z',
          rawReference: 'billing-upgrade|tenant-upgrade-expire|PROFISSIONAL',
        },
      });

      expect(billingRepo.updateSubscriptionModuleStatus).toHaveBeenCalledWith(
        'tenant-upgrade-expire',
        ADDON_PACKAGE_MODULE_CODE,
        'EXPIRED',
        expect.any(Date),
      );
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'ADDON_PACKAGE_EXPIRED' }),
      );
    });
  });

  // ─── 4. Cancellation — subscription deleted marks overdue ───────────────────

  describe('Scenario 4: Cancellation — payment.overdue marks subscription', () => {
    it('should mark active subscription as OVERDUE', async () => {
      const handler = getHandler('payment.overdue');
      const subscription = createActiveSubscription('tenant-cancel-1');
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-cancel-1',
          paymentId: 'pay-overdue-1',
          overdueAt: '2026-02-10T00:00:00.000Z',
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-cancel-1',
          event: 'SUBSCRIPTION_OVERDUE',
          metadata: { reason: 'payment.overdue' },
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should be idempotent — not save again if already OVERDUE', async () => {
      const handler = getHandler('payment.overdue');
      const subscription = createActiveSubscription('tenant-cancel-2');
      subscription.markAsOverdue();
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-cancel-2',
          paymentId: 'pay-overdue-2',
          overdueAt: '2026-02-10T00:00:00.000Z',
        },
      });

      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ─── 5. Split Payment Verification ─────────────────────────────────────────

  describe('Scenario 5: Split Payment — payment confirmed does not affect billing subscription', () => {
    it('should not alter subscription when externalReference is a plain tenantId (sales split)', async () => {
      const handler = getHandler('payment.confirmed');
      const subscription = createActiveSubscription('tenant-split-1');
      billingRepo.findSubscription.mockResolvedValue(subscription);

      // A sales split payment uses plain tenantId as externalReference
      // and confirmedAt is within the current cycle — should be idempotent
      await handler({
        payload: {
          tenantId: 'tenant-split-1',
          paymentId: 'pay-split-1',
          amount: 150,
          confirmedAt: '2026-01-15T10:00:00.000Z', // Within cycle
        },
      });

      // Should NOT renew cycle (already active and within cycle)
      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(billingRepo.saveUsage).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Refund Rollback — addon refund reverts quotas ──────────────────────

  describe('Scenario 6: Refund Rollback — addon package refund reverts quotas', () => {
    it('should revert addon quotas and mark module as REFUNDED', async () => {
      const handler = getHandler('payment.refunded');
      const subscription = createActiveSubscription('tenant-refund-1');
      subscription.adjustQuotas({
        messages: 5000,
        aiTokens: 1000000,
        contacts: 0,
      });
      subscription.updatePricing({
        baseMonthlyPrice: 297,
        addonsMonthlyPrice: 49,
      });

      const originalMessages = subscription.quotas.messages;
      const originalAiTokens = subscription.quotas.aiTokens;

      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-refund-1',
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        status: 'ACTIVE',
        monthlyPrice: 49,
        quotaImpact: { messages: 5000, aiTokens: 1000000, contacts: 0 },
        startedAt: new Date('2026-01-15T00:00:00.000Z'),
      });

      await handler({
        payload: {
          tenantId: 'tenant-refund-1',
          paymentId: 'pay-refund-1',
          refundedAt: '2026-01-20T00:00:00.000Z',
          rawReference: `billing-addon|tenant-refund-1|${ADDON_PACKAGE_MODULE_CODE}`,
        },
      });

      // Quotas should be reverted
      expect(subscription.quotas.messages).toBe(originalMessages - 5000);
      expect(subscription.quotas.aiTokens).toBe(originalAiTokens - 1000000);
      // Pricing should be reverted
      expect(subscription.addonsMonthlyPrice).toBe(0);
      // Subscription saved
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      // Module marked as REFUNDED
      expect(billingRepo.updateSubscriptionModuleStatus).toHaveBeenCalledWith(
        'tenant-refund-1',
        ADDON_PACKAGE_MODULE_CODE,
        'REFUNDED',
        expect.any(Date),
      );
      // Audit log
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-refund-1',
          event: 'ADDON_PACKAGE_REFUNDED',
          metadata: expect.objectContaining({
            moduleCode: ADDON_PACKAGE_MODULE_CODE,
            revertedQuotas: { messages: 5000, aiTokens: 1000000, contacts: 0 },
            revertedPrice: 49,
          }),
        }),
      );
      // Should NOT mark subscription as OVERDUE (addon refund != subscription refund)
      expect(subscription.status).toBe('ACTIVE');
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should mark subscription as OVERDUE on regular (non-addon) refund', async () => {
      const handler = getHandler('payment.refunded');
      const subscription = createActiveSubscription('tenant-refund-2');
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await handler({
        payload: {
          tenantId: 'tenant-refund-2',
          paymentId: 'pay-refund-2',
          refundedAt: '2026-01-20T00:00:00.000Z',
          // No rawReference or plain tenantId reference — regular subscription refund
        },
      });

      expect(subscription.status).toBe('OVERDUE');
      expect(billingRepo.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(BillingSubscriptionOverdueIntegrationEvent),
      );
    });

    it('should do nothing when addon module not found on refund', async () => {
      const handler = getHandler('payment.refunded');
      const subscription = createActiveSubscription('tenant-refund-3');
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);

      await handler({
        payload: {
          tenantId: 'tenant-refund-3',
          paymentId: 'pay-refund-3',
          refundedAt: '2026-01-20T00:00:00.000Z',
          rawReference: `billing-addon|tenant-refund-3|${ADDON_PACKAGE_MODULE_CODE}`,
        },
      });

      // No rollback, no overdue — just a warning log
      expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
      expect(billingRepo.updateSubscriptionModuleStatus).not.toHaveBeenCalled();
      expect(subscription.status).toBe('ACTIVE');
    });
  });
});
