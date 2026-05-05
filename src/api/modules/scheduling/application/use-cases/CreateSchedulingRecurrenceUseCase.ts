import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
  SchedulingRecurrencePeriod,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';
import { SchedulingRecurrenceDateService } from '../services/SchedulingRecurrenceDateService';

type CreateSchedulingRecurrenceInput = {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  contactId?: string | null;
  categoryId?: string | null;
  conversationId?: string | null;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  startsAt: string;
  endsAt: string;
  frequency: SchedulingRecurrencePeriod;
  interval?: number;
  isFree?: boolean;
  isOnline?: boolean;
  paymentTimeoutHours?: number | null;
  notes?: string | null;
};

@Injectable()
export class CreateSchedulingRecurrenceUseCase {
  constructor(
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
    private readonly recurrenceDateService: SchedulingRecurrenceDateService,
  ) {}

  async execute(input: CreateSchedulingRecurrenceInput) {
    const interval = Math.max(1, input.interval ?? 1);
    if (input.endDate && input.endDate < input.startDate) {
      throw new BadRequestException('Periodo de recorrência invalido');
    }

    const maxOccurrences =
      input.maxOccurrences && input.maxOccurrences > 0
        ? Math.min(input.maxOccurrences, 370)
        : this.countOccurrences({
            startDate: input.startDate,
            endDate: input.endDate,
            frequency: input.frequency,
            interval,
          });

    if (maxOccurrences < 1) {
      throw new BadRequestException('Periodo de recorrência invalido');
    }

    return this.recurringReservationRepository.create({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      professionalId: input.professionalId,
      contactId: input.contactId ?? null,
      categoryId: input.categoryId ?? null,
      conversationId: input.conversationId ?? null,
      period: input.frequency,
      interval,
      maxOccurrences,
      occurrencesCreated: 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      firstDate: input.startDate,
      endDate: input.endDate ?? null,
      nextDate: input.startDate,
      nextRunAt: this.recurrenceDateService.getRunAt(input.startDate),
      isFree: input.isFree ?? true,
      isOnline: Boolean(input.isOnline),
      paymentTimeoutHours: input.paymentTimeoutHours ?? null,
      notes: input.notes ?? null,
    });
  }

  private countOccurrences(input: {
    startDate: string;
    endDate?: string | null;
    frequency: SchedulingRecurrencePeriod;
    interval: number;
  }): number {
    const endDate = input.endDate ?? input.startDate;
    if (endDate < input.startDate) {
      return 0;
    }

    let count = 0;
    let cursor = input.startDate;
    while (cursor <= endDate && count < 370) {
      count += 1;
      cursor = this.recurrenceDateService.getNextDate(
        cursor,
        input.frequency,
        input.interval,
      );
    }

    return count;
  }
}
