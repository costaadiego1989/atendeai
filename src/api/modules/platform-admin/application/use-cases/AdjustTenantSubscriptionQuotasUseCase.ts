import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '@modules/billing/domain/repositories/IBillingRepository';

@Injectable()
export class AdjustTenantSubscriptionQuotasUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billing: IBillingRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    messages?: number;
    aiTokens?: number;
    contacts?: number;
  }) {
    const sub = await this.billing.findSubscription(input.tenantId);
    if (!sub) {
      throw new NotFoundException('Subscription not found for tenant');
    }
    sub.adjustQuotas({
      messages: input.messages,
      aiTokens: input.aiTokens,
      contacts: input.contacts,
    });
    await this.billing.saveSubscription(sub);
    await this.billing.saveAuditLog({
      tenantId: input.tenantId,
      event: 'PLATFORM_QUOTA_ADJUST',
      metadata: {
        deltas: {
          messages: input.messages ?? 0,
          aiTokens: input.aiTokens ?? 0,
          contacts: input.contacts ?? 0,
        },
        resulting: {
          messages: sub.quotas.messages,
          aiTokens: sub.quotas.aiTokens,
          contacts: sub.quotas.contacts,
        },
      },
    });
    return {
      tenantId: input.tenantId,
      quotas: {
        messages: sub.quotas.messages,
        aiTokens: sub.quotas.aiTokens,
        contacts: sub.quotas.contacts,
      },
    };
  }
}
