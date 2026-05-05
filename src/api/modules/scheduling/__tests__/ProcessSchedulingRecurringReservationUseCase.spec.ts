import { ProcessSchedulingRecurringReservationUseCase } from '../application/use-cases/ProcessSchedulingRecurringReservationUseCase';
import { SchedulingRecurrenceDateService } from '../application/services/SchedulingRecurrenceDateService';
import { ISchedulingRecurringReservationRepository } from '../domain/ports/ISchedulingRecurringReservationRepository';
import { ISchedulingStore } from '../domain/ports/ISchedulingStore';
import { ReserveProfessionalSlotUseCase } from '../application/use-cases/ReserveProfessionalSlotUseCase';

describe('ProcessSchedulingRecurringReservationUseCase', () => {
  let repository: jest.Mocked<ISchedulingRecurringReservationRepository>;
  let schedulingStore: jest.Mocked<ISchedulingStore>;
  let reserveProfessionalSlotUseCase: jest.Mocked<ReserveProfessionalSlotUseCase>;
  let useCase: ProcessSchedulingRecurringReservationUseCase;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      claimDue: jest.fn(),
      releaseLease: jest.fn(),
      startRun: jest.fn(),
      markRunSucceeded: jest.fn(),
      markRunFailed: jest.fn(),
      markRunSkipped: jest.fn(),
      advanceAfterSuccess: jest.fn(),
      cancel: jest.fn(),
      delete: jest.fn(),
    };

    schedulingStore = {
      createProfessional: jest.fn(),
      listProfessionals: jest.fn(),
      createCategory: jest.fn(),
      listCategories: jest.fn(),
      assignCategoriesToProfessional: jest.fn(),
      listProfessionalsByCategory: jest.fn(),
      saveAvailability: jest.fn(),
      listAvailability: jest.fn(),
      getAvailabilitySlot: jest.fn(),
      listAvailabilityByCategory: jest.fn(),
      reserveSlot: jest.fn(),
      updateSlot: jest.fn(),
      rescheduleReservation: jest.fn(),
      attachPaymentLinkToReservedSlot: jest.fn(),
      markSlotPaymentConfirmedByReference: jest.fn(),
      attachMeetingLinkToReservedSlot: jest.fn(),
    };

    reserveProfessionalSlotUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ReserveProfessionalSlotUseCase>;

    useCase = new ProcessSchedulingRecurringReservationUseCase(
      repository,
      schedulingStore,
      reserveProfessionalSlotUseCase,
      new SchedulingRecurrenceDateService(),
    );
  });

  it('should reserve the next occurrence and advance the schedule', async () => {
    repository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      contactId: 'contact-1',
      categoryId: 'category-1',
      conversationId: 'conversation-1',
      period: 'WEEKLY',
      interval: 1,
      maxOccurrences: 4,
      occurrencesCreated: 1,
      startsAt: '09:00',
      endsAt: '09:30',
      firstDate: '2026-04-22',
      endDate: null,
      nextDate: '2026-04-29',
      nextRunAt: new Date('2026-04-29T03:00:00.000Z'),
      isFree: true,
      isOnline: true,
      paymentTimeoutHours: null,
      notes: 'teleconsulta recorrente',
      status: 'ACTIVE',
      lastError: null,
      leaseUntil: null,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      updatedAt: new Date('2026-04-22T10:00:00.000Z'),
      completedAt: null,
      cancelledAt: null,
    });
    repository.startRun.mockResolvedValue({
      id: 'run-1',
      recurrenceId: 'rec-1',
      tenantId: 'tenant-1',
      occurrenceNumber: 2,
      targetDate: '2026-04-29',
      status: 'PROCESSING',
      slotId: null,
      errorMessage: null,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      completedAt: null,
    });
    schedulingStore.getAvailabilitySlot.mockResolvedValue({
      id: '2026-04-29__09:00__09:30',
      startsAt: '09:00',
      endsAt: '09:30',
      status: 'AVAILABLE',
    });
    repository.advanceAfterSuccess.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      contactId: 'contact-1',
      categoryId: 'category-1',
      conversationId: 'conversation-1',
      period: 'WEEKLY',
      interval: 1,
      maxOccurrences: 4,
      occurrencesCreated: 2,
      startsAt: '09:00',
      endsAt: '09:30',
      firstDate: '2026-04-22',
      endDate: null,
      nextDate: '2026-05-06',
      nextRunAt: new Date('2026-05-06T03:00:00.000Z'),
      isFree: true,
      isOnline: true,
      paymentTimeoutHours: null,
      notes: 'teleconsulta recorrente',
      status: 'ACTIVE',
      lastError: null,
      leaseUntil: null,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      updatedAt: new Date('2026-04-22T10:00:00.000Z'),
      completedAt: null,
      cancelledAt: null,
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
    });

    expect(reserveProfessionalSlotUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        professionalId: 'professional-1',
        date: '2026-04-29',
        slotId: '2026-04-29__09:00__09:30',
        isOnline: true,
        skipRecurringSchedule: true,
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      slotId: '2026-04-29__09:00__09:30',
    });
    expect(repository.advanceAfterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recurrenceId: 'rec-1',
        occurrencesCreated: 2,
        nextDate: '2026-05-06',
      }),
    );
  });

  it('should skip the run when the target slot is no longer available', async () => {
    repository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      branchId: null,
      professionalId: 'professional-1',
      contactId: 'contact-1',
      categoryId: null,
      conversationId: null,
      period: 'WEEKLY',
      interval: 1,
      maxOccurrences: 4,
      occurrencesCreated: 1,
      startsAt: '09:00',
      endsAt: '09:30',
      firstDate: '2026-04-22',
      endDate: null,
      nextDate: '2026-04-29',
      nextRunAt: new Date('2026-04-29T03:00:00.000Z'),
      isFree: true,
      isOnline: false,
      paymentTimeoutHours: null,
      notes: null,
      status: 'ACTIVE',
      lastError: null,
      leaseUntil: null,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      updatedAt: new Date('2026-04-22T10:00:00.000Z'),
      completedAt: null,
      cancelledAt: null,
    });
    repository.startRun.mockResolvedValue({
      id: 'run-1',
      recurrenceId: 'rec-1',
      tenantId: 'tenant-1',
      occurrenceNumber: 2,
      targetDate: '2026-04-29',
      status: 'PROCESSING',
      slotId: null,
      errorMessage: null,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      completedAt: null,
    });
    schedulingStore.getAvailabilitySlot.mockResolvedValue({
      id: '2026-04-29__09:00__09:30',
      startsAt: '09:00',
      endsAt: '09:30',
      status: 'BLOCKED',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
    });

    expect(reserveProfessionalSlotUseCase.execute).not.toHaveBeenCalled();
    expect(repository.markRunSkipped).toHaveBeenCalledWith({
      runId: 'run-1',
      reason: 'slot_not_available',
    });
    expect(repository.advanceAfterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recurrenceId: 'rec-1',
        occurrencesCreated: 2,
        nextDate: '2026-05-06',
      }),
    );
  });

  it('should create the target slot when a recurrence has no availability yet', async () => {
    repository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      contactId: 'contact-1',
      categoryId: 'category-1',
      conversationId: null,
      period: 'WEEKLY',
      interval: 1,
      maxOccurrences: 4,
      occurrencesCreated: 0,
      startsAt: '09:00',
      endsAt: '09:30',
      firstDate: '2026-05-02',
      endDate: null,
      nextDate: '2026-05-02',
      nextRunAt: new Date('2026-05-02T03:00:00.000Z'),
      isFree: true,
      isOnline: true,
      paymentTimeoutHours: null,
      notes: null,
      status: 'ACTIVE',
      lastError: null,
      leaseUntil: null,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      updatedAt: new Date('2026-05-01T10:00:00.000Z'),
      completedAt: null,
      cancelledAt: null,
    });
    repository.startRun.mockResolvedValue({
      id: 'run-1',
      recurrenceId: 'rec-1',
      tenantId: 'tenant-1',
      occurrenceNumber: 1,
      targetDate: '2026-05-02',
      status: 'PROCESSING',
      slotId: null,
      errorMessage: null,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      completedAt: null,
    });
    schedulingStore.getAvailabilitySlot.mockResolvedValue(null);

    await useCase.execute({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
    });

    expect(schedulingStore.saveAvailability).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      professionalId: 'professional-1',
      date: '2026-05-02',
      slots: [
        {
          startsAt: '09:00',
          endsAt: '09:30',
          isOnline: true,
        },
      ],
    });
    expect(reserveProfessionalSlotUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-05-02',
        slotId: '2026-05-02__09:00__09:30',
        isOnline: true,
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      slotId: '2026-05-02__09:00__09:30',
    });
  });
});
