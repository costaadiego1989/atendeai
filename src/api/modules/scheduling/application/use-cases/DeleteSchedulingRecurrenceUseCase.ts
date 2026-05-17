import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class DeleteSchedulingRecurrenceUseCase {
  constructor(
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    recurrenceId: string;
  }): Promise<void> {
    await this.recurringReservationRepository.delete(input);
  }
}
