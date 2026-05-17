import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  SchedulingRecurringReservationDueIntegrationEvent,
  SchedulingRecurringReservationDuePayload,
} from '../../domain/events/integration/SchedulingRecurringReservationDueIntegrationEvent';
import { ProcessSchedulingRecurringReservationUseCase } from '../use-cases/ProcessSchedulingRecurringReservationUseCase';

@Injectable()
export class SchedulingRecurringReservationDueHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly processSchedulingRecurringReservationUseCase: ProcessSchedulingRecurringReservationUseCase,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<SchedulingRecurringReservationDueIntegrationEvent>(
      'scheduling.recurring-reservation.due',
      async (event) => {
        const payload =
          event.payload as SchedulingRecurringReservationDuePayload;
        await this.processSchedulingRecurringReservationUseCase.execute({
          tenantId: payload.tenantId,
          recurrenceId: payload.recurrenceId,
        });
      },
      {
        consumerName: 'scheduling-recurring-reservation-due',
        concurrency: 5,
      },
    );
  }
}
