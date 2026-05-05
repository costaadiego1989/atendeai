import { Inject, Injectable } from '@nestjs/common';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { UsageRecord } from '../../domain/entities/UsageRecord';
import {
  IRecordUsageUseCase,
  RecordUsageInput,
  UsageType,
} from './interfaces/IRecordUsageUseCase';
import { TenantId } from '../../../../shared/domain/TenantId';
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

    let usage = await this.billingRepository.getUsage(
      input.tenantId,
      subscription.billingCycleStart,
    );

    if (!usage) {
      usage = UsageRecord.create(
        TenantId.create(input.tenantId),
        subscription.billingCycleStart,
        subscription.billingCycleEnd,
      );
    }

    switch (input.type) {
      case UsageType.MESSAGE:
        usage.recordMessage();
        break;
      case UsageType.AI_TOKEN:
        usage.recordTokens(input.amount || 0);
        break;
      case UsageType.CONTACT:
        usage.recordContact();
        break;
    }

    await this.billingRepository.saveUsage(usage);
  }
}
