import { Inject, Injectable } from '@nestjs/common';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IGetUsageUseCase,
  GetUsageInput,
  GetUsageOutput,
} from './interfaces/IGetUsageUseCase';

@Injectable()
export class GetUsageUseCase implements IGetUsageUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: IBillingRepository,
  ) {}

  async execute(input: GetUsageInput): Promise<GetUsageOutput> {
    const subscription = await this.billingRepo.findSubscription(
      input.tenantId,
    );
    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const usage = await this.billingRepo.getUsage(
      input.tenantId,
      subscription.billingCycleStart,
    );

    return {
      tenantId: subscription.tenantId.toString(),
      plan: subscription.plan,
      scheduledPlan: subscription.scheduledPlan,
      currentPeriod: {
        start: usage?.periodStart || subscription.billingCycleStart,
        end: usage?.periodEnd || subscription.billingCycleEnd,
      },
      usage: {
        messages: {
          used: usage?.messagesUsed || 0,
          quota: subscription.quotas.messages,
        },
        aiTokens: {
          used: usage?.aiTokensUsed || 0,
          quota: subscription.quotas.aiTokens,
        },
        contacts: {
          used: usage?.contactsUsed || 0,
          quota: subscription.quotas.contacts,
        },
      },
    };
  }
}
