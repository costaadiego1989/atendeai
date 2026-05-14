import { Inject, Injectable } from '@nestjs/common';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
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
      const now = new Date();
      const cycleEnd = new Date(now);
      cycleEnd.setDate(now.getDate() + 7);

      return {
        tenantId: input.tenantId,
        plan: 'TRIAL',
        scheduledPlan: undefined,
        currentPeriod: {
          start: now,
          end: cycleEnd,
        },
        usage: {
          messages: { used: 0, quota: 50 },
          aiTokens: { used: 0, quota: 150000 },
          contacts: { used: 0, quota: 50 },
        },
      };
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
