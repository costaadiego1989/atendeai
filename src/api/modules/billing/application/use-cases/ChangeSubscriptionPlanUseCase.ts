import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import { IPaymentPort, BILLING_PAYMENT_PORT } from '../ports/IPaymentPort';
import { PlanType } from '../../domain/value-objects/Quotas';
import {
  BillingCycleType,
  ChangeSubscriptionPlanInput,
  ChangeSubscriptionPlanOutput,
  IChangeSubscriptionPlanUseCase,
} from './interfaces/IChangeSubscriptionPlanUseCase';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';
import { EnsureCustomerService } from '../services/EnsureCustomerService';

const PLAN_RANK: Record<PlanType, number> = {
  TRIAL: -1,
  ESSENCIAL: 0,
  PROFISSIONAL: 1,
  ESCALA: 2,
};

@Injectable()
export class ChangeSubscriptionPlanUseCase implements IChangeSubscriptionPlanUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    @Inject(BILLING_PAYMENT_PORT)
    private readonly paymentPort: IPaymentPort,
    private readonly ensureCustomerService: EnsureCustomerService,
    private readonly configService: ConfigService,
    @InjectQueue('billing-plan-changes')
    private readonly planChangeQueue: Queue,
  ) {}

  async execute(
    input: ChangeSubscriptionPlanInput,
  ): Promise<ChangeSubscriptionPlanOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const currentPlan = subscription.plan;
    const billingCycle: BillingCycleType = input.billingCycle ?? 'MONTHLY';

    if (currentPlan === input.targetPlan) {
      return {
        tenantId: input.tenantId,
        currentPlan,
        targetPlan: input.targetPlan,
        plan: subscription.plan,
        status: subscription.status,
        mode: 'NO_CHANGE',
        billingCycle,
      };
    }

    const isUpgrade = PLAN_RANK[input.targetPlan] > PLAN_RANK[currentPlan];

    if (isUpgrade) {
      const targetPlanDefinition = await this.billingRepository.findPlanByCode(
        input.targetPlan,
      );
      if (!targetPlanDefinition) {
        throw new EntityNotFoundException('BillingPlan', input.targetPlan);
      }
      const subscriptionModules =
        await this.billingRepository.listSubscriptionModules(
          subscription.id.toString(),
        );
      const commercialState = buildSubscriptionCommercialState(
        targetPlanDefinition,
        subscriptionModules,
        subscription.config,
      );

      const checkoutValue = this.calculateCheckoutValue(
        commercialState.totalMonthlyPrice,
        billingCycle,
      );

      await this.ensureCustomerService.ensure(input.tenantId, subscription);
      const paymentLink = await this.paymentPort.createPaymentLink({
        name: `${billingCycle === 'YEARLY' ? 'Assinatura anual' : 'Upgrade para'} ${input.targetPlan}`,
        description:
          billingCycle === 'YEARLY'
            ? `Plano ${input.targetPlan} anual no AtendeAi (12 meses)`
            : `Upgrade de plano ${currentPlan} para ${input.targetPlan} no AtendeAi`,
        value: checkoutValue,
        externalReference: `billing-upgrade|${input.tenantId}|${input.targetPlan}|${billingCycle}`,
        billingType: 'UNDEFINED',
        chargeType: 'DETACHED',
        dueDateLimitDays: 1,
      });

      await this.billingRepository.saveSubscription(subscription);

      return {
        tenantId: input.tenantId,
        currentPlan,
        targetPlan: input.targetPlan,
        plan: subscription.plan,
        status: subscription.status,
        mode: 'CHECKOUT_REQUIRED',
        checkoutUrl: paymentLink.url,
        billingCycle,
      };
    }

    subscription.schedulePlanChange(input.targetPlan);

    if (input.targetPlan === 'ESSENCIAL') {
      if (subscription.asaasSubscriptionId) {
        await this.paymentPort.cancelSubscription(
          subscription.asaasSubscriptionId,
        );
        subscription.clearAsaasSubscription();
      }

      const effectiveAt = subscription.billingCycleEnd;
      await this.billingRepository.saveSubscription(subscription);
      await this.planChangeQueue.add(
        'apply-scheduled-plan-change',
        {
          tenantId: input.tenantId,
          targetPlan: input.targetPlan,
          effectiveAt: effectiveAt.toISOString(),
        },
        {
          delay: Math.max(0, effectiveAt.getTime() - Date.now()),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      return {
        tenantId: input.tenantId,
        currentPlan,
        targetPlan: input.targetPlan,
        plan: subscription.plan,
        status: subscription.status,
        mode: 'DOWNGRADE_SCHEDULED',
        effectiveAt,
        billingCycle,
      };
    }

    if (subscription.asaasSubscriptionId) {
      const targetPlanDefinition = await this.billingRepository.findPlanByCode(
        input.targetPlan,
      );
      if (!targetPlanDefinition) {
        throw new EntityNotFoundException('BillingPlan', input.targetPlan);
      }
      const subscriptionModules =
        await this.billingRepository.listSubscriptionModules(
          subscription.id.toString(),
        );
      const commercialState = buildSubscriptionCommercialState(
        targetPlanDefinition,
        subscriptionModules,
        subscription.config,
      );

      const updatedMonthlyValue =
        Math.round(
          commercialState.totalMonthlyPrice *
            (1 - this.getPromoDiscountPercent(billingCycle) / 100) *
            100,
        ) / 100;
      await this.paymentPort.updateSubscription(
        subscription.asaasSubscriptionId,
        {
          value: updatedMonthlyValue,
          description: `Plano ${input.targetPlan} - AtendeAi`,
          updatePendingPayments: false,
        },
      );
    }

    await this.billingRepository.saveSubscription(subscription);

    return {
      tenantId: input.tenantId,
      currentPlan,
      targetPlan: input.targetPlan,
      plan: subscription.plan,
      status: subscription.status,
      mode: 'DOWNGRADE_SCHEDULED',
      effectiveAt: subscription.billingCycleEnd,
      billingCycle,
    };
  }

  private calculateCheckoutValue(
    monthlyPrice: number,
    billingCycle: BillingCycleType,
  ): number {
    const promoPercent = this.getPromoDiscountPercent(billingCycle);
    const discountedMonthly = monthlyPrice * (1 - promoPercent / 100);

    if (billingCycle === 'YEARLY') {
      return Math.round(discountedMonthly * 12 * 100) / 100;
    }

    return Math.round(discountedMonthly * 100) / 100;
  }

  private getPromoDiscountPercent(
    billingCycle: BillingCycleType = 'MONTHLY',
  ): number {
    const envKey =
      billingCycle === 'YEARLY'
        ? 'PROMO_DISCOUNT_ANNUAL'
        : 'PROMO_DISCOUNT_MONTHLY';
    const raw = this.configService.get<string>(envKey, '0');
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 0;
    return parsed;
  }
}
