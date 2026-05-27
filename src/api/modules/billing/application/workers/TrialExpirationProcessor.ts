import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '@modules/payment/application/facades/IPaymentFacade';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TrialExpiringIntegrationEvent } from '../integration-events/TrialExpiringIntegrationEvent';
import { TrialExpiredIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';

@Processor('BILLING_QUEUE')
export class TrialExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(TrialExpirationProcessor.name);

  constructor(
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {
    super();
  }

  async process(
    job: Job<{ subscriptionId: string; tenantId: string }, any, string>,
  ): Promise<void> {
    if (job.name === 'check-trial-expiration') {
      await this.handleExpirationWarning(job);
    } else if (job.name === 'trial-expired') {
      await this.handleTrialExpired(job);
    }
  }

  private async handleExpirationWarning(
    job: Job<{ subscriptionId: string; tenantId: string }>,
  ) {
    const { subscriptionId, tenantId } = job.data;
    this.logger.log(
      `Processing trial expiration warning for sub: ${subscriptionId}, tenant: ${tenantId}`,
    );

    try {
      const subscription =
        await this.paymentFacade.getSubscription(subscriptionId);

      if (!subscription || subscription.status !== 'ACTIVE') {
        this.logger.log(
          `Subscription ${subscriptionId} is no longer active (Status: ${subscription?.status}). Skipping warning...`,
        );
        return;
      }

      if (!subscription.invoiceUrl) {
        this.logger.warn(
          `Subscription ${subscriptionId} has no invoiceUrl available yet, cannot notify properly.`,
        );
        return;
      }

      const event = new TrialExpiringIntegrationEvent({
        tenantId,
        subscriptionId,
        invoiceUrl: subscription.invoiceUrl,
      });

      await this.eventBus.publish(event);
      this.logger.log(
        `Dispatched TrialExpiringIntegrationEvent for tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing check-trial-expiration job for sub: ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  private async handleTrialExpired(
    job: Job<{ subscriptionId: string; tenantId: string }>,
  ) {
    const { subscriptionId, tenantId } = job.data;
    this.logger.log(
      `Processing final trial expiration for sub: ${subscriptionId}, tenant: ${tenantId}`,
    );

    try {
      const event = new TrialExpiredIntegrationEvent({
        tenantId,
        subscriptionId,
      });

      await this.eventBus.publish(event);
      this.logger.log(
        `Dispatched TrialExpiredIntegrationEvent for tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing trial-expired job for sub: ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }
}
