import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { ReserveProfessionalSlotUseCase } from './ReserveProfessionalSlotUseCase';
import { SchedulingRecurrenceDateService } from '../services/SchedulingRecurrenceDateService';

@Injectable()
export class ProcessSchedulingRecurringReservationUseCase {
  private readonly logger = new Logger(
    ProcessSchedulingRecurringReservationUseCase.name,
  );

  constructor(
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    private readonly reserveProfessionalSlotUseCase: ReserveProfessionalSlotUseCase,
    private readonly recurrenceDateService: SchedulingRecurrenceDateService,
  ) {}

  async execute(input: {
    tenantId: string;
    recurrenceId: string;
  }): Promise<void> {
    const recurrence = await this.recurringReservationRepository.findById(
      input.tenantId,
      input.recurrenceId,
    );

    if (!recurrence || recurrence.status !== 'ACTIVE' || !recurrence.nextDate) {
      return;
    }

    if (recurrence.occurrencesCreated >= recurrence.maxOccurrences) {
      await this.recurringReservationRepository.advanceAfterSuccess({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        occurrencesCreated: recurrence.occurrencesCreated,
        nextDate: null,
        nextRunAt: null,
      });
      return;
    }

    const occurrenceNumber = recurrence.occurrencesCreated + 1;
    const run = await this.recurringReservationRepository.startRun({
      recurrenceId: recurrence.id,
      tenantId: recurrence.tenantId,
      occurrenceNumber,
      targetDate: recurrence.nextDate,
    });

    if (!run) {
      await this.recurringReservationRepository.releaseLease({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
      });
      return;
    }

    const slotId = this.recurrenceDateService.makeSlotId(
      recurrence.nextDate,
      recurrence.startsAt,
      recurrence.endsAt,
    );
    const slot = await this.schedulingStore.getAvailabilitySlot(
      recurrence.tenantId,
      recurrence.professionalId,
      recurrence.nextDate,
      slotId,
    );

    if (!slot) {
      await this.schedulingStore.saveAvailability({
        tenantId: recurrence.tenantId,
        professionalId: recurrence.professionalId,
        date: recurrence.nextDate,
        slots: [
          {
            startsAt: recurrence.startsAt,
            endsAt: recurrence.endsAt,
            isOnline: recurrence.isOnline,
          },
        ],
      });
    } else if (slot.status !== 'AVAILABLE') {
      await this.recurringReservationRepository.markRunSkipped({
        runId: run.id,
        reason: 'slot_not_available',
      });
      const nextDate = this.recurrenceDateService.getNextDate(
        recurrence.nextDate,
        recurrence.period,
        recurrence.interval,
      );
      const hasNext =
        occurrenceNumber < recurrence.maxOccurrences &&
        (!recurrence.endDate || nextDate <= recurrence.endDate);

      await this.recurringReservationRepository.advanceAfterSuccess({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        occurrencesCreated: occurrenceNumber,
        nextDate: hasNext ? nextDate : null,
        nextRunAt: hasNext
          ? this.recurrenceDateService.getRunAt(nextDate)
          : null,
      });
      return;
    }

    try {
      await this.reserveProfessionalSlotUseCase.execute({
        tenantId: recurrence.tenantId,
        branchId: recurrence.branchId ?? null,
        professionalId: recurrence.professionalId,
        date: recurrence.nextDate,
        slotId,
        contactId: recurrence.contactId ?? undefined,
        categoryId: recurrence.categoryId ?? undefined,
        conversationId: recurrence.conversationId ?? undefined,
        notes: recurrence.notes ?? undefined,
        isFree: recurrence.isFree,
        isOnline: recurrence.isOnline,
        paymentTimeoutHours: recurrence.paymentTimeoutHours ?? undefined,
        skipRecurringSchedule: true,
      });

      await this.recurringReservationRepository.markRunSucceeded({
        runId: run.id,
        slotId,
      });

      const nextDate = this.recurrenceDateService.getNextDate(
        recurrence.nextDate,
        recurrence.period,
        recurrence.interval,
      );
      const hasNext =
        occurrenceNumber < recurrence.maxOccurrences &&
        (!recurrence.endDate || nextDate <= recurrence.endDate);
      await this.recurringReservationRepository.advanceAfterSuccess({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        occurrencesCreated: occurrenceNumber,
        nextDate: hasNext ? nextDate : null,
        nextRunAt: hasNext
          ? this.recurrenceDateService.getRunAt(nextDate)
          : null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao criar recorrência';
      this.logger.error(
        `Scheduling recurrence ${recurrence.id} failed: ${message}`,
      );
      await this.recurringReservationRepository.markRunFailed({
        runId: run.id,
        errorMessage: message,
      });
      await this.recurringReservationRepository.releaseLease({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        errorMessage: message,
      });
      throw error;
    }
  }
}
