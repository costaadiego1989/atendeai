import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { RecoveryRecurringChargeDueIntegrationEvent } from '../../domain/events/integration/RecoveryRecurringChargeDueIntegrationEvent';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';

@Injectable()
export class RecoveryRecurringChargeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecoveryRecurringChargeScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
  ) {}

  onModuleInit(): void {
    if (this.configService.get<string>('RECOVERY_RECURRING_CHARGES_ENABLED', 'true') === 'false') {
      return;
    }

    const intervalMs = this.configService.get<number>(
      'RECOVERY_RECURRING_CHARGE_POLL_INTERVAL_MS',
      60_000,
    );

    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.isTicking) {
      return;
    }

    this.isTicking = true;
    try {
      const limit = this.configService.get<number>(
        'RECOVERY_RECURRING_CHARGE_CLAIM_LIMIT',
        50,
      );
      const dueRecurrences = await this.recurringChargeRepository.claimDue(
        new Date(),
        limit,
      );

      for (const recurrence of dueRecurrences) {
        await this.eventBus.publish(
          new RecoveryRecurringChargeDueIntegrationEvent({
            tenantId: recurrence.tenantId,
            recurrenceId: recurrence.id,
            caseId: recurrence.caseId,
            scheduledFor: (recurrence.nextRunAt ?? new Date()).toISOString(),
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `Recovery recurring charge scheduler failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } finally {
      this.isTicking = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
