import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
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
    @InjectQueue('billing-plan-changes')
    private readonly planChangeQueue: Queue,
  ) {}

  async execute(
    input: ChangeSubscriptionPlanInput,
  ): Promise<ChangeSubscriptionPlanOutput> {
    const subscription = await this.billingRepository.findSubscription(input.tenantId);

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const currentPlan = subscription.plan;
    if (currentPlan === input.targetPlan) {
      return {
        tenantId: input.tenantId,
        currentPlan,
        targetPlan: input.targetPlan,
        plan: subscription.plan,
        status: subscription.status,
        mode: 'NO_CHANGE',
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
      const subscriptionModules = await this.billingRepository.listSubscriptionModules(
        subscription.id.toString(),
      );
      const commercialState = buildSubscriptionCommercialState(
        targetPlanDefinition,
        subscriptionModules,
        subscription.config,
      );

      await this.ensureCustomer(input.tenantId, subscription);
      const paymentLink = await this.paymentService.createPaymentLink({
        name: `Upgrade para ${input.targetPlan}`,
        description: `Upgrade de plano ${currentPlan} para ${input.targetPlan} no AtendeAi`,
        value: commercialState.totalMonthlyPrice,
        externalReference: `billing-upgrade|${input.tenantId}|${input.targetPlan}`,
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
      };
    }

    subscription.schedulePlanChange(input.targetPlan);

    if (input.targetPlan === 'ESSENCIAL') {
      if (subscription.asaasSubscriptionId) {
        await this.paymentService.cancelSubscription(subscription.asaasSubscriptionId);
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
      };
    }

    if (subscription.asaasSubscriptionId) {
      const targetPlanDefinition = await this.billingRepository.findPlanByCode(
        input.targetPlan,
      );
      if (!targetPlanDefinition) {
        throw new EntityNotFoundException('BillingPlan', input.targetPlan);
      }
      const subscriptionModules = await this.billingRepository.listSubscriptionModules(
        subscription.id.toString(),
      );
      const commercialState = buildSubscriptionCommercialState(
        targetPlanDefinition,
        subscriptionModules,
        subscription.config,
      );

      await this.paymentService.updateSubscription(
        subscription.asaasSubscriptionId,
        {
          value: commercialState.totalMonthlyPrice,
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
    };
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
