import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { UpdateTenantPlanStatusUseCase } from '../use-cases/UpdateTenantPlanStatusUseCase.js';

@Injectable()
export class TenantSubscriptionStatusHandler implements OnModuleInit {
  private readonly logger = new Logger(TenantSubscriptionStatusHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly updateTenantPlanStatusUseCase: UpdateTenantPlanStatusUseCase,
  ) {}

  onModuleInit() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.eventBus.subscribe(
      'payment.confirmed',
      async (event: any) => {
        const { tenantId } = event.payload || event;
        if (!tenantId) return;

        try {
          await this.updateTenantPlanStatusUseCase.execute({
            tenantId,
            status: 'ACTIVE',
          });
          this.logger.log(
            `Tenant ${tenantId} plan status updated to ACTIVE due to payment confirmation.`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update tenant ${tenantId} status on payment confirmation`,
            error,
          );
        }
      },
      { consumerName: 'tenant-plan-status-payment-confirmed' },
    );

    this.eventBus.subscribe(
      'payment.overdue',
      async (event: any) => {
        const { tenantId } = event.payload || event;
        if (!tenantId) return;

        try {
          await this.updateTenantPlanStatusUseCase.execute({
            tenantId,
            status: 'EXPIRED',
          });
          this.logger.log(
            `Tenant ${tenantId} plan status updated to EXPIRED due to overdue payment.`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update tenant ${tenantId} status on payment overdue`,
            error,
          );
        }
      },
      { consumerName: 'tenant-plan-status-payment-overdue' },
    );

    this.eventBus.subscribe(
      'payment.trial-expired.v1',
      async (event: any) => {
        const { tenantId } = event.payload || event;
        if (!tenantId) return;

        try {
          await this.updateTenantPlanStatusUseCase.execute({
            tenantId,
            status: 'TRIAL_EXPIRED',
          });
          this.logger.log(
            `Tenant ${tenantId} plan status updated to TRIAL_EXPIRED.`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update tenant ${tenantId} status on trial expiration`,
            error,
          );
        }
      },
      { consumerName: 'tenant-plan-status-trial-expired' },
    );
  }
}
