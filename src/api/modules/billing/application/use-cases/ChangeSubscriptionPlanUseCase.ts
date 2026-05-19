import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { PaymentService } from '../../../payment/application/services/PaymentService';
import { Subscription } from '../../domain/entities/Subscription';
import { PlanType } from '../../domain/value-objects/Quotas';
import {
  BillingCycleType,
  ChangeSubscriptionPlanInput,
  ChangeSubscriptionPlanOutput,
  IChangeSubscriptionPlanUseCase,
} from './interfaces/IChangeSubscriptionPlanUseCase';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';

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
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly paymentService: PaymentService,
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

      await this.ensureCustomer(input.tenantId, subscription);
      const paymentLink = await this.paymentService.createPaymentLink({
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
        await this.paymentService.cancelSubscription(
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

      const updatedMonthlyValue = Math.round(
        commercialState.totalMonthlyPrice * (1 - this.getPromoDiscountPercent(billingCycle) / 100) * 100,
      ) / 100;
      await this.paymentService.updateSubscription(
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

  private getPromoDiscountPercent(billingCycle: BillingCycleType = 'MONTHLY'): number {
    const envKey = billingCycle === 'YEARLY' ? 'PROMO_DISCOUNT_ANNUAL' : 'PROMO_DISCOUNT_MONTHLY';
    const raw = this.configService.get<string>(envKey, '0');
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 0;
    return parsed;
  }

  private async ensureCustomer(
    tenantId: string,
    subscription: Subscription,
  ): Promise<string> {
    if (subscription.asaasCustomerId) {
      return subscription.asaasCustomerId;
    }

    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant || !tenant.owner) {
      throw new EntityNotFoundException('Tenant', tenantId);
    }

    const customer = await this.paymentService.createCustomer({
      name: tenant.owner.name,
      email: tenant.owner.email.value,
      cpfCnpj: tenant.cnpj.value,
      phone: tenant.owner.phone.value,
      externalReference: tenantId,
    });

    subscription.updateAsaasCustomer(customer.id);
    return customer.id;
  }
}
