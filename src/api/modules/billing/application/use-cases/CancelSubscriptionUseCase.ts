import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  ITenantQueryPort,
  BILLING_TENANT_QUERY_PORT,
} from '../ports/ITenantQueryPort';
import { IPaymentPort, BILLING_PAYMENT_PORT } from '../ports/IPaymentPort';
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
    @Inject(BILLING_TENANT_QUERY_PORT)
    private readonly tenantQueryPort: ITenantQueryPort,
    @Inject(BILLING_PAYMENT_PORT)
    private readonly paymentPort: IPaymentPort,
  ) {}

  async execute(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    if (subscription.asaasSubscriptionId) {
      await this.paymentPort.cancelSubscription(
        subscription.asaasSubscriptionId,
      );
      subscription.clearAsaasSubscription();
    }

    await this.billingRepository.replaceSubscriptionModules(
      subscription.id.toString(),
      input.tenantId,
      [],
    );

    const essentialPlan =
      await this.billingRepository.findPlanByCode('ESSENCIAL');
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
    await this.tenantQueryPort.updateTenantPlan(input.tenantId, 'ESSENCIAL');

    return {
      tenantId: input.tenantId,
      status: subscription.status,
    };
  }
}
