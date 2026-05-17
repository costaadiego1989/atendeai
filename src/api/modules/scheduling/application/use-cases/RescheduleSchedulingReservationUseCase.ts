import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  AvailabilitySlotRecord,
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { SchedulingGoogleCalendarSyncService } from '../services/SchedulingGoogleCalendarSyncService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { ProfessionalSlotRescheduledIntegrationEvent } from '../../domain/events/integration/ProfessionalSlotRescheduledIntegrationEvent';
import {
  ISchedulingReminderQueue,
  SCHEDULING_REMINDER_QUEUE,
} from '../../domain/ports/ISchedulingReminderQueue';

@Injectable()
export class RescheduleSchedulingReservationUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(SCHEDULING_REMINDER_QUEUE)
    private readonly schedulingReminderQueue: ISchedulingReminderQueue,
    private readonly googleCalendarSyncService: SchedulingGoogleCalendarSyncService,
  ) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetDate: string;
    targetSlotId: string;
  }): Promise<AvailabilitySlotRecord> {
    if (
      input.sourceDate === input.targetDate &&
      input.sourceSlotId === input.targetSlotId
    ) {
      throw new ConflictException(
        'Target slot must be different from source slot',
      );
    }

    const sourceSlot = await this.schedulingStore.getAvailabilitySlot(
      input.tenantId,
      input.professionalId,
      input.sourceDate,
      input.sourceSlotId,
    );
    if (!sourceSlot) {
      throw new NotFoundException('Source availability slot not found');
    }

    const targetAvailabilitySlot =
      await this.schedulingStore.getAvailabilitySlot(
        input.tenantId,
        input.professionalId,
        input.targetDate,
        input.targetSlotId,
      );
    if (!targetAvailabilitySlot) {
      throw new NotFoundException('Target availability slot not found');
    }

    const rescheduled = await this.schedulingStore.rescheduleReservation({
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      sourceDate: input.sourceDate,
      sourceSlotId: input.sourceSlotId,
      targetDate: input.targetDate,
      targetSlotId: input.targetSlotId,
    });

    if (!rescheduled) {
      throw new ConflictException('Reservation could not be rescheduled');
    }

    const professional = (
      await this.schedulingStore.listProfessionals(
        input.tenantId,
        input.branchId,
      )
    ).find((entry) => entry.id === input.professionalId);

    const calendarSync =
      await this.googleCalendarSyncService.rescheduleReservation({
        tenantId: input.tenantId,
        branchId: input.branchId ?? professional?.branchId ?? null,
        sourceProfessionalId: input.professionalId,
        sourceDate: input.sourceDate,
        sourceSlotId: input.sourceSlotId,
        targetProfessionalId: input.professionalId,
        targetProfessionalName: professional?.name,
        targetDate: input.targetDate,
        targetSlot: rescheduled.targetSlot,
      });
    const slotWithMeeting = calendarSync?.meetingUrl
      ? await this.schedulingStore.attachMeetingLinkToReservedSlot({
          tenantId: input.tenantId,
          professionalId: input.professionalId,
          date: input.targetDate,
          slotId: rescheduled.targetSlot.id,
          meetingProvider: 'GOOGLE_MEET',
          meetingUrl: calendarSync.meetingUrl,
        })
      : null;
    const targetSlot = slotWithMeeting ?? rescheduled.targetSlot;

    const reservedFor = targetSlot.reservedFor;
    const contact = reservedFor?.contactId
      ? await this.contactFacade.getContactById(
          input.tenantId,
          reservedFor.contactId,
        )
      : null;

    if (contact?.contactId) {
      await this.eventBus.publish(
        new ProfessionalSlotRescheduledIntegrationEvent({
          tenantId: input.tenantId,
          contactId: contact.contactId,
          contactName: reservedFor?.contactName,
          professionalName: professional?.name || 'Profissional',
          categoryName: reservedFor?.categoryName || 'Serviço',
          date: input.targetDate,
          startsAt: targetSlot.startsAt,
          endsAt: targetSlot.endsAt,
          branchId: input.branchId ?? professional?.branchId ?? null,
          pendingPayment: targetSlot.status === 'PRE_RESERVED',
          paymentUrl: targetSlot.payment?.linkUrl,
          paymentExpiresAt: targetSlot.payment?.expiresAt,
          meetingUrl: targetSlot.reservedFor?.meetingUrl,
        }),
      );

      await this.scheduleReservationReminders({
        tenantId: input.tenantId,
        branchId: input.branchId ?? professional?.branchId ?? null,
        professionalId: input.professionalId,
        date: input.targetDate,
        slotId: targetSlot.id,
        startsAt: targetSlot.startsAt,
        status: targetSlot.status,
        contactId: contact.contactId,
      });
    }

    return targetSlot;
  }

  private async scheduleReservationReminders(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    date: string;
    slotId: string;
    startsAt: string;
    status: AvailabilitySlotRecord['status'];
    contactId?: string;
  }): Promise<void> {
    if (!input.contactId || input.status !== 'RESERVED') {
      return;
    }

    const appointmentAt = new Date(`${input.date}T${input.startsAt}:00-03:00`);
    const offsets = [24, 3, 1] as const;

    await Promise.all(
      offsets.map(async (offsetHours) => {
        const runAt = new Date(
          appointmentAt.getTime() - offsetHours * 60 * 60 * 1000,
        );

        if (runAt.getTime() <= Date.now()) {
          return;
        }

        await this.schedulingReminderQueue.addJob({
          tenantId: input.tenantId,
          branchId: input.branchId ?? null,
          professionalId: input.professionalId,
          date: input.date,
          slotId: input.slotId,
          offsetHours,
          runAt: runAt.toISOString(),
        });
      }),
    );
  }
}
