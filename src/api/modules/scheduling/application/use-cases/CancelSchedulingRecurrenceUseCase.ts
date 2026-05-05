import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class CancelSchedulingRecurrenceUseCase {
  constructor(
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string | null;
  }) {
    return this.recurringReservationRepository.cancel({
      tenantId: input.tenantId,
      recurrenceId: input.recurrenceId,
      reason: input.reason ?? undefined,
    });
  }
}
