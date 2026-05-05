import { Inject, Injectable } from '@nestjs/common';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import {
  ICheckQuotaUseCase,
  CheckQuotaInput,
  CheckQuotaOutput,
} from './interfaces/ICheckQuotaUseCase';
import { UsageType } from './interfaces/IRecordUsageUseCase';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  BillingQuotaExceededIntegrationEvent,
  BillingQuotaWarningIntegrationEvent,
} from '../integration-events/BillingIntegrationEvents';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { trace } from '@opentelemetry/api';

@Injectable()
export class CheckQuotaUseCase implements ICheckQuotaUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: IBillingRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) { }

  async execute(input: CheckQuotaInput): Promise<CheckQuotaOutput> {
    return traceAsync(
      'billing.CheckQuota.execute',
      {
        'tenant.id': input.tenantId,
        'usage.type': String(input.type),
      },
      async () => this.doExecute(input),
    );
  }

  private async doExecute(
    input: CheckQuotaInput,
  ): Promise<CheckQuotaOutput> {
    const subscription = await this.billingRepo.findSubscription(
      input.tenantId,
    );
    if (!subscription) {
      const out: CheckQuotaOutput = {
        canProceed: false,
        used: 0,
        quota: 0,
        status: 'NO_SUBSCRIPTION',
      };
      this.setQuotaSpanAttributes(out.canProceed, out.status, 0);
      return out;
    }

    const usage = await this.billingRepo.getUsage(
      input.tenantId,
      subscription.billingCycleStart,
    );
    const used = this.getUsedAmount(usage, input.type);
    const quota = this.getQuotaAmount(subscription, input.type);
    const canProceed = subscription.isActive() && used < quota;

    const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

    if (!canProceed && used >= quota && quota > 0) {
      await this.billingRepo.saveAuditLog({
        tenantId: input.tenantId,
        event: 'QUOTA_EXCEEDED',
        metadata: {
          type: input.type,
          used,
          quota,
        },
      });

      await this.eventBus.publish(
        new BillingQuotaExceededIntegrationEvent({
          tenantId: input.tenantId,
          type: input.type,
          used,
          quota,
        }),
      );
    } else if (percentUsed >= 80) {
      const lastAlert = subscription.lastQuotaAlertAt;
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (!lastAlert || lastAlert < dayAgo) {
        subscription.recordQuotaAlert();
        await this.billingRepo.saveSubscription(subscription);

        await this.eventBus.publish(
          new BillingQuotaWarningIntegrationEvent({
            tenantId: input.tenantId,
            type: input.type,
            percentUsed,
            used,
            quota,
          }),
        );

        await this.billingRepo.saveAuditLog({
          tenantId: input.tenantId,
          event: 'QUOTA_WARNING_80',
          metadata: {
            type: input.type,
            percentUsed,
            used,
            quota,
          },
        });
      }
    }

    this.setQuotaSpanAttributes(
      canProceed,
      subscription.status,
      percentUsed,
    );

    return {
      canProceed,
      used,
      quota,
      status: subscription.status,
    };
  }

  private setQuotaSpanAttributes(
    canProceed: boolean,
    subscriptionStatus: string,
    percentUsed: number,
  ): void {
    const span = trace.getActiveSpan();
    if (!span) return;

    span.setAttribute('billing.quota.allow', String(canProceed));
    span.setAttribute('billing.subscription.status', subscriptionStatus);

    if (!Number.isFinite(percentUsed)) {
      return;
    }

    span.setAttribute(
      'billing.quota.percent_used',
      Math.round(Math.min(Math.max(percentUsed, 0), 999_999)),
    );
  }

  private getUsedAmount(usage: any, type: UsageType): number {
    if (!usage) return 0;
    switch (type) {
      case UsageType.MESSAGE:
        return usage.messagesUsed;
      case UsageType.AI_TOKEN:
        return usage.aiTokensUsed;
      case UsageType.CONTACT:
        return usage.contactsUsed;
      default:
        return 0;
    }
  }

  private getQuotaAmount(subscription: any, type: UsageType): number {
    switch (type) {
      case UsageType.MESSAGE:
        return subscription.quotas.messages;
      case UsageType.AI_TOKEN:
        return subscription.quotas.aiTokens;
      case UsageType.CONTACT:
        return subscription.quotas.contacts;
      default:
        return 0;
    }
  }
}
