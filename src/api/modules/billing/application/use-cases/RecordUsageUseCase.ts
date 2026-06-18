import { Inject, Injectable } from '@nestjs/common';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecordUsageUseCase,
  RecordUsageInput,
  UsageType,
} from './interfaces/IRecordUsageUseCase';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

@Injectable()
export class RecordUsageUseCase implements IRecordUsageUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  async execute(input: RecordUsageInput): Promise<void> {
    return traceAsync(
      'billing.record_usage',
      {
        'tenant.id': input.tenantId,
        'usage.type': String(input.type),
      },
      async () => this.doExecute(input),
    );
  }

  private async doExecute(input: RecordUsageInput): Promise<void> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );
    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const messagesIncrement = input.type === UsageType.MESSAGE ? 1 : 0;
    const aiTokensIncrement =
      input.type === UsageType.AI_TOKEN ? input.amount || 0 : 0;
    const contactsIncrement = input.type === UsageType.CONTACT ? 1 : 0;

    await this.billingRepository.atomicIncrementUsage({
      tenantId: input.tenantId,
      periodStart: subscription.billingCycleStart,
      periodEnd: subscription.billingCycleEnd,
      messagesIncrement,
      aiTokensIncrement,
      contactsIncrement,
    });
  }
}
