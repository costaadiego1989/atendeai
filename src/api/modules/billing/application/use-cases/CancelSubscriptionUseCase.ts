import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { PaymentService } from '../../../payment/application/services/PaymentService';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { Plan } from '../../../tenant/domain/value-objects/Plan';
import {
  CancelSubscriptionInput,
  CancelSubscriptionOutput,
  ICancelSubscriptionUseCase,
} from './interfaces/ICancelSubscriptionUseCase';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';

@Injectable()
export class CancelSubscriptionUseCase implements ICancelSubscriptionUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionOutput> {
    const subscription = await this.billingRepository.findSubscription(input.tenantId);

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    if (subscription.asaasSubscriptionId) {
      await this.paymentService.cancelSubscription(subscription.asaasSubscriptionId);
      subscription.clearAsaasSubscription();
    }

    await this.billingRepository.replaceSubscriptionModules(
      subscription.id.toString(),
      input.tenantId,
      [],
    );

    const essentialPlan = await this.billingRepository.findPlanByCode('ESSENCIAL');
    subscription.changePlan(
      'ESSENCIAL',
      essentialPlan
        ? buildSubscriptionCommercialState(
            essentialPlan,
            [],
            subscription.config,
          )
        : undefined,
    );
    subscription.clearScheduledPlan();
    subscription.activate();

    await this.billingRepository.saveSubscription(subscription);
    await this.syncTenantPlanToDefault(input.tenantId);

    return {
      tenantId: input.tenantId,
      status: subscription.status,
    };
  }

  private async syncTenantPlanToDefault(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant || tenant.plan.isEssencial()) {
      return;
    }

    tenant.changePlan(Plan.essencial());
    await this.tenantRepository.save(tenant);
  }
}
