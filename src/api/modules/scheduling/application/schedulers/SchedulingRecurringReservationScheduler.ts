import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SchedulingRecurringReservationDueIntegrationEvent } from '../../domain/events/integration/SchedulingRecurringReservationDueIntegrationEvent';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class SchedulingRecurringReservationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SchedulingRecurringReservationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
  ) {}

  onModuleInit(): void {
    if (
      this.configService.get<string>(
        'SCHEDULING_RECURRING_RESERVATIONS_ENABLED',
        'true',
      ) === 'false'
    ) {
      return;
    }

    const intervalMs = this.configService.get<number>(
      'SCHEDULING_RECURRING_RESERVATION_POLL_INTERVAL_MS',
      60_000,
    );

    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.isTicking) {
      return;
    }

    this.isTicking = true;
    try {
      const due = await this.recurringReservationRepository.claimDue(
        new Date(),
        this.configService.get<number>(
          'SCHEDULING_RECURRING_RESERVATION_CLAIM_LIMIT',
          50,
        ),
      );

      for (const recurrence of due) {
        await this.eventBus.publish(
          new SchedulingRecurringReservationDueIntegrationEvent({
            tenantId: recurrence.tenantId,
            recurrenceId: recurrence.id,
            professionalId: recurrence.professionalId,
            targetDate: recurrence.nextDate ?? recurrence.firstDate,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `Scheduling recurrence scheduler failed: ${
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
