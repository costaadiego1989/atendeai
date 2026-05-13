import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import { UsageRecord } from '../../domain/entities/UsageRecord';
import { TenantId } from '../../../../shared/domain/TenantId';
import { PlanType } from '../../domain/value-objects/Quotas';
import {
  PaymentConfirmedIntegrationEvent,
  PaymentOverdueIntegrationEvent,
  PaymentRefundedIntegrationEvent,
} from '../../../payment/application/integration-events/PaymentIntegrationEvents';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentService } from '../../../payment/application/services/PaymentService';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
  BillingSubscriptionOverdueIntegrationEvent,
} from '../integration-events/BillingIntegrationEvents';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';
import { ADDON_PACKAGE_MODULE_CODE } from '../../domain/constants/AddonPackages';
import { Subscription } from '../../domain/entities/Subscription';

@Injectable()
export class BillingPaymentHandlers implements OnModuleInit {
  private readonly logger = new Logger(BillingPaymentHandlers.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    private readonly paymentService: PaymentService,
    @InjectQueue('billing-provisioning')
    private readonly provisioningQueue: Queue,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe('payment.confirmed', async (event) => {
      const payload =
        event.payload as PaymentConfirmedIntegrationEvent['payload'];
      const tenantId = payload.tenantId;
      const confirmedAt = new Date(payload.confirmedAt);

      this.logger.log(`Handling cycle renewal for tenant ${tenantId}`);

      const subscription =
        await this.billingRepository.findSubscription(tenantId);
      if (subscription) {
        const planUpgradeRequest = this.parseBillingUpgradeReference(
          payload.rawReference,
        );

        const addonPackageRequest = this.parseBillingAddonReference(
          payload.rawReference,
        );

        // Handle addon package payment confirmation
        if (addonPackageRequest) {
          await this.handleAddonPackagePaymentConfirmed(
            addonPackageRequest.tenantId,
            subscription,
          );
          return;
        }

        if (planUpgradeRequest) {
          const oldPlan = subscription.plan;
          const targetPlanDefinition = await this.billingRepository.findPlanByCode(
            planUpgradeRequest.targetPlan,
          );
          const subscriptionModules =
            await this.billingRepository.listSubscriptionModules(
              subscription.id.toString(),
            );
          subscription.changePlan(
            planUpgradeRequest.targetPlan,
            targetPlanDefinition
              ? buildSubscriptionCommercialState(
                  targetPlanDefinition,
                  subscriptionModules,
                  subscription.config,
                )
              : undefined,
          );
          subscription.clearScheduledPlan();
          subscription.renewCycleFrom(confirmedAt);

          // Expire addon package from previous cycle
          await this.expireAddonPackageOnRenewal(tenantId, subscription);

          await this.syncRecurringBillingAfterUpgrade(
            tenantId,
            subscription.plan,
            subscription.asaasCustomerId,
            subscription.asaasSubscriptionId,
            confirmedAt,
          ).then((result) => {
            if (result.customerId && result.subscriptionId) {
              subscription.updateAsaasInfo(result.customerId, result.subscriptionId);
            }
          });

          await this.billingRepository.saveSubscription(subscription);

          await this.billingRepository.saveAuditLog({
            tenantId,
            event: 'CYCLE_RENEWED_UPGRADE',
            oldPlan,
            newPlan: subscription.plan,
            metadata: { confirmedAt, rawReference: payload.rawReference },
          });

          const usage = UsageRecord.create(
            TenantId.create(tenantId),
            subscription.billingCycleStart,
            subscription.billingCycleEnd,
          );
          await this.billingRepository.saveUsage(usage);

          await this.eventBus.publish(
            new BillingSubscriptionActivatedIntegrationEvent({
              tenantId,
              plan: subscription.plan,
              billingCycleStart: subscription.billingCycleStart.toISOString(),
              billingCycleEnd: subscription.billingCycleEnd.toISOString(),
            }),
          );
          await this.eventBus.publish(
            new BillingCycleRenewedIntegrationEvent({
              tenantId,
              plan: subscription.plan,
              billingCycleStart: subscription.billingCycleStart.toISOString(),
              billingCycleEnd: subscription.billingCycleEnd.toISOString(),
              confirmedAt: confirmedAt.toISOString(),
            }),
          );
          return;
        }

        if (
          subscription.status === 'ACTIVE' &&
          subscription.isInCurrentCycle(confirmedAt)
        ) {
          return;
        }

        const oldPlan = subscription.plan;
        if (subscription.scheduledPlan) {
          const scheduledPlanDefinition =
            await this.billingRepository.findPlanByCode(
              subscription.scheduledPlan,
            );
          const subscriptionModules =
            await this.billingRepository.listSubscriptionModules(
              subscription.id.toString(),
            );
          subscription.changePlan(
            subscription.scheduledPlan,
            scheduledPlanDefinition
              ? buildSubscriptionCommercialState(
                  scheduledPlanDefinition,
                  subscriptionModules,
                  subscription.config,
                )
              : undefined,
          );
          subscription.clearScheduledPlan();
        }

        subscription.renewCycleFrom(confirmedAt);

        // Expire addon package from previous cycle
        await this.expireAddonPackageOnRenewal(tenantId, subscription);

        await this.billingRepository.saveSubscription(subscription);

        await this.billingRepository.saveAuditLog({
          tenantId,
          event: 'CYCLE_RENEWED',
          oldPlan,
          newPlan: subscription.plan,
          metadata: { confirmedAt },
        });

        const usage = UsageRecord.create(
          TenantId.create(tenantId),
          subscription.billingCycleStart,
          subscription.billingCycleEnd,
        );
        await this.billingRepository.saveUsage(usage);

        this.logger.log(`Usage reset and cycle renewed for tenant ${tenantId}`);

        await this.eventBus.publish(
          new BillingSubscriptionActivatedIntegrationEvent({
            tenantId,
            plan: subscription.plan,
            billingCycleStart: subscription.billingCycleStart.toISOString(),
            billingCycleEnd: subscription.billingCycleEnd.toISOString(),
          }),
        );
        await this.eventBus.publish(
          new BillingCycleRenewedIntegrationEvent({
            tenantId,
            plan: subscription.plan,
            billingCycleStart: subscription.billingCycleStart.toISOString(),
            billingCycleEnd: subscription.billingCycleEnd.toISOString(),
            confirmedAt: confirmedAt.toISOString(),
          }),
        );
      }
    }, { consumerName: 'billing-payment-confirmed' });

    this.eventBus.subscribe('payment.overdue', async (event) => {
      const payload = event.payload as PaymentOverdueIntegrationEvent['payload'];
      const tenantId = payload.tenantId;
      const subscription = await this.billingRepository.findSubscription(tenantId);

      if (subscription && subscription.status !== 'OVERDUE') {
        subscription.markAsOverdue();
        await this.billingRepository.saveSubscription(subscription);

        await this.billingRepository.saveAuditLog({
          tenantId,
          event: 'SUBSCRIPTION_OVERDUE',
          metadata: { reason: 'payment.overdue' },
        });

        await this.eventBus.publish(
          new BillingSubscriptionOverdueIntegrationEvent({
            tenantId,
            plan: subscription.plan,
            overdueReason: 'PAYMENT_OVERDUE',
            status: subscription.status,
          }),
        );
      }
    }, { consumerName: 'billing-payment-overdue' });

    this.eventBus.subscribe('payment.refunded', async (event) => {
      const payload = event.payload as PaymentRefundedIntegrationEvent['payload'];
      const tenantId = payload.tenantId;
      const subscription = await this.billingRepository.findSubscription(tenantId);

      if (!subscription) return;

      // Check if this refund is for an addon package
      const addonRef = this.parseBillingAddonReference(payload.rawReference);
      if (addonRef) {
        await this.rollbackAddonPackage(tenantId, subscription);
        return;
      }

      if (subscription.status !== 'OVERDUE') {
        subscription.markAsOverdue();
        await this.billingRepository.saveSubscription(subscription);

        await this.billingRepository.saveAuditLog({
          tenantId,
          event: 'SUBSCRIPTION_OVERDUE',
          metadata: { reason: 'payment.refunded' },
        });

        await this.eventBus.publish(
          new BillingSubscriptionOverdueIntegrationEvent({
            tenantId,
            plan: subscription.plan,
            overdueReason: 'PAYMENT_REFUNDED',
            status: subscription.status,
          }),
        );
      }
    }, { consumerName: 'billing-payment-refunded' });
  }

  private parseBillingUpgradeReference(rawReference?: unknown): {
    tenantId: string;
    targetPlan: PlanType;
  } | null {
    if (typeof rawReference !== 'string') {
      return null;
    }

    const match = /^billing-upgrade\|([^|]+)\|(ESSENCIAL|PROFISSIONAL|ESCALA)$/.exec(
      rawReference,
    );

    if (!match) {
      return null;
    }

    return {
      tenantId: match[1],
      targetPlan: match[2] as PlanType,
    };
  }

  private parseBillingAddonReference(rawReference?: unknown): {
    tenantId: string;
    moduleCode: string;
  } | null {
    if (typeof rawReference !== 'string') {
      return null;
    }

    const match = /^billing-addon\|([^|]+)\|([^|]+)$/.exec(rawReference);

    if (!match) {
      return null;
    }

    return {
      tenantId: match[1],
      moduleCode: match[2],
    };
  }

  /**
   * Confirms addon package payment. The quotas were already applied optimistically
   * at purchase time, so we just mark the module as PAID and log it.
   */
  private async handleAddonPackagePaymentConfirmed(
    tenantId: string,
    subscription: Subscription,
  ): Promise<void> {
    const activeModule = await this.billingRepository.findActiveSubscriptionModule(
      tenantId,
      ADDON_PACKAGE_MODULE_CODE,
    );

    if (!activeModule) {
      this.logger.warn(
        `Addon package payment confirmed for tenant ${tenantId} but no active module found`,
      );
      return;
    }

    await this.billingRepository.saveAuditLog({
      tenantId,
      event: 'ADDON_PACKAGE_PAYMENT_CONFIRMED',
      metadata: {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        plan: subscription.plan,
        price: activeModule.monthlyPrice,
      },
    });

    this.logger.log(`Addon package payment confirmed for tenant ${tenantId}`);
  }

  /**
   * Rollbacks addon package quotas when payment is refunded.
   * Reverts the optimistic quota adjustment and marks module as REFUNDED.
   */
  private async rollbackAddonPackage(
    tenantId: string,
    subscription: Subscription,
  ): Promise<void> {
    const activeModule = await this.billingRepository.findActiveSubscriptionModule(
      tenantId,
      ADDON_PACKAGE_MODULE_CODE,
    );

    if (!activeModule) {
      this.logger.warn(
        `Addon package refund for tenant ${tenantId} but no active module found`,
      );
      return;
    }

    const quotaImpact = activeModule.quotaImpact || {};

    // Revert quotas
    subscription.adjustQuotas({
      messages: -(quotaImpact.messages ?? 0),
      aiTokens: -(quotaImpact.aiTokens ?? 0),
      contacts: -(quotaImpact.contacts ?? 0),
    });

    // Revert pricing
    subscription.updatePricing({
      baseMonthlyPrice: subscription.baseMonthlyPrice,
      addonsMonthlyPrice: Math.max(
        0,
        subscription.addonsMonthlyPrice - activeModule.monthlyPrice,
      ),
    });

    await this.billingRepository.saveSubscription(subscription);

    // Mark module as refunded
    await this.billingRepository.updateSubscriptionModuleStatus(
      tenantId,
      ADDON_PACKAGE_MODULE_CODE,
      'REFUNDED',
      new Date(),
    );

    await this.billingRepository.saveAuditLog({
      tenantId,
      event: 'ADDON_PACKAGE_REFUNDED',
      metadata: {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        revertedQuotas: quotaImpact,
        revertedPrice: activeModule.monthlyPrice,
      },
    });

    this.logger.log(`Addon package refunded and rolled back for tenant ${tenantId}`);
  }

  private async syncRecurringBillingAfterUpgrade(
    tenantId: string,
    targetPlan: PlanType,
    customerId: string | undefined,
    asaasSubscriptionId: string | undefined,
    confirmedAt: Date,
  ): Promise<{ customerId?: string; subscriptionId?: string }> {
    const targetPlanDefinition = await this.billingRepository.findPlanByCode(
      targetPlan,
    );
    const subscription = await this.billingRepository.findSubscription(tenantId);
    const subscriptionModules = subscription
      ? await this.billingRepository.listSubscriptionModules(subscription.id.toString())
      : [];

    if (!targetPlanDefinition) {
      return {};
    }

    const commercialState = buildSubscriptionCommercialState(
      targetPlanDefinition,
      subscriptionModules,
      subscription?.config,
    );

    const nextDueDate = new Date(confirmedAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    const nextDueDateIso = nextDueDate.toISOString().split('T')[0];

    if (asaasSubscriptionId) {
      await this.paymentService.updateSubscription(asaasSubscriptionId, {
        value: commercialState.totalMonthlyPrice,
        description: `Plano ${targetPlan} - AtendeAi`,
        nextDueDate: nextDueDateIso,
        updatePendingPayments: false,
      });

      return {
        customerId,
        subscriptionId: asaasSubscriptionId,
      };
    }

    if (!customerId) {
      await this.provisioningQueue.add(
        'provision-tenant',
        {
          tenantId,
          plan: targetPlan,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      return {};
    }

    const remoteSubscription = await this.paymentService.createSubscription({
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: commercialState.totalMonthlyPrice,
      nextDueDate: nextDueDateIso,
      cycle: 'MONTHLY',
      description: `Plano ${targetPlan} - AtendeAi`,
      externalReference: tenantId,
    });

    return {
      customerId,
      subscriptionId: remoteSubscription.id,
    };
  }

  /**
   * Expires any active addon package (quota-boost) on cycle renewal.
   * Reverts the quota deltas and marks the module as EXPIRED.
   */
  private async expireAddonPackageOnRenewal(
    tenantId: string,
    subscription: Subscription,
  ): Promise<void> {
    const activeModule = await this.billingRepository.findActiveSubscriptionModule(
      tenantId,
      ADDON_PACKAGE_MODULE_CODE,
    );

    if (!activeModule) return;

    const quotaImpact = activeModule.quotaImpact || {};

    // Revert quotas added by the addon package
    subscription.adjustQuotas({
      messages: -(quotaImpact.messages ?? 0),
      aiTokens: -(quotaImpact.aiTokens ?? 0),
      contacts: -(quotaImpact.contacts ?? 0),
    });

    // Revert pricing
    subscription.updatePricing({
      baseMonthlyPrice: subscription.baseMonthlyPrice,
      addonsMonthlyPrice: Math.max(
        0,
        subscription.addonsMonthlyPrice - activeModule.monthlyPrice,
      ),
    });

    // Mark module as expired
    await this.billingRepository.updateSubscriptionModuleStatus(
      tenantId,
      ADDON_PACKAGE_MODULE_CODE,
      'EXPIRED',
      new Date(),
    );

    await this.billingRepository.saveAuditLog({
      tenantId,
      event: 'ADDON_PACKAGE_EXPIRED',
      metadata: {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        revertedQuotas: quotaImpact,
        revertedPrice: activeModule.monthlyPrice,
      },
    });

    this.logger.log(`Addon package expired for tenant ${tenantId}`);
  }
}
