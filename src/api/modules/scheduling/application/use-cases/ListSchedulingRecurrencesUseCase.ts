import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
  SchedulingRecurringReservationStatus,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class ListSchedulingRecurrencesUseCase {
  constructor(
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    professionalId?: string | null;
    status?: SchedulingRecurringReservationStatus | null;
  }) {
    return this.recurringReservationRepository.list(input);
  }
}
