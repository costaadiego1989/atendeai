import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantId } from '@shared/domain/TenantId';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import { UsageRecord } from '../../domain/entities/UsageRecord';
import {
  BillingCycleRenewedIntegrationEvent,
  BillingSubscriptionActivatedIntegrationEvent,
} from '../integration-events/BillingIntegrationEvents';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { PlanType } from '../../domain/value-objects/Quotas';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

export interface ApplyScheduledPlanChangeJob {
  tenantId: string;
  targetPlan: PlanType;
  effectiveAt: string;
}

@Processor('billing-plan-changes')
export class BillingPlanChangeProcessor extends WorkerHost {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {
    super();
  }

  async process(
    job: Job<ApplyScheduledPlanChangeJob, any, string>,
  ): Promise<void> {
    return traceAsync(
      'billing.processor.plan_change.process',
      { 'tenant.id': job.data.tenantId },
      () => this.runPlanChangeJob(job),
    );
  }

  private async runPlanChangeJob(
    job: Job<ApplyScheduledPlanChangeJob, any, string>,
  ): Promise<void> {
    const subscription = await this.billingRepository.findSubscription(
      job.data.tenantId,
    );

    if (!subscription || subscription.scheduledPlan !== job.data.targetPlan) {
      return;
    }

    const effectiveAt = new Date(job.data.effectiveAt);
    const targetPlanDefinition = await this.billingRepository.findPlanByCode(
      job.data.targetPlan,
    );
    const subscriptionModules =
      await this.billingRepository.listSubscriptionModules(
        subscription.id.toString(),
      );

    subscription.changePlan(
      job.data.targetPlan,
      targetPlanDefinition
        ? buildSubscriptionCommercialState(
            targetPlanDefinition,
            subscriptionModules,
            subscription.config,
          )
        : undefined,
    );
    subscription.clearScheduledPlan();
    subscription.renewCycleFrom(effectiveAt);

    await this.billingRepository.saveSubscription(subscription);

    const usage = UsageRecord.create(
      TenantId.create(job.data.tenantId),
      subscription.billingCycleStart,
      subscription.billingCycleEnd,
    );
    await this.billingRepository.saveUsage(usage);

    await this.eventBus.publish(
      new BillingSubscriptionActivatedIntegrationEvent({
        tenantId: job.data.tenantId,
        plan: subscription.plan,
        billingCycleStart: subscription.billingCycleStart.toISOString(),
        billingCycleEnd: subscription.billingCycleEnd.toISOString(),
      }),
    );
    await this.eventBus.publish(
      new BillingCycleRenewedIntegrationEvent({
        tenantId: job.data.tenantId,
        plan: subscription.plan,
        billingCycleStart: subscription.billingCycleStart.toISOString(),
        billingCycleEnd: subscription.billingCycleEnd.toISOString(),
        confirmedAt: effectiveAt.toISOString(),
      }),
    );
  }
}
