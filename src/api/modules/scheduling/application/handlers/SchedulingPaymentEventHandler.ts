import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  PaymentOverdueIntegrationEvent,
  PaymentRefundedIntegrationEvent,
} from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { parseSchedulingPaymentReference } from '../services/SchedulingPaymentReference';
import { SchedulingGoogleCalendarSyncService } from '../services/SchedulingGoogleCalendarSyncService';
import {
  ProfessionalSlotPaymentAttentionRequiredIntegrationEvent,
  ProfessionalSlotPaymentConfirmedIntegrationEvent,
} from '../../domain/events/integration/ProfessionalSlotPaymentConfirmedIntegrationEvent';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  ISchedulingReminderQueue,
  SCHEDULING_REMINDER_QUEUE,
} from '../../domain/ports/ISchedulingReminderQueue';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Injectable()
export class SchedulingPaymentEventHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    private readonly googleCalendarSyncService: SchedulingGoogleCalendarSyncService,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    @Inject(SCHEDULING_REMINDER_QUEUE)
    private readonly schedulingReminderQueue: ISchedulingReminderQueue,
    private readonly structuredLog: StructuredLogEmitter,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'payment.confirmed',
      async (event) => {
        const payload =
          event.payload as PaymentConfirmedIntegrationEvent['payload'];
        const parsedReference = parseSchedulingPaymentReference(
          payload.rawReference,
        );

        if (!parsedReference || parsedReference.tenantId !== payload.tenantId) {
          return;
        }

        const markResult =
          await this.schedulingStore.markSlotPaymentConfirmedByReference(
            payload.tenantId,
            payload.rawReference!,
            new Date(payload.confirmedAt).toISOString(),
          );

        if (!markResult.slot?.reservedFor?.contactId) {
          this.structuredLog.emit({
            level: 'warn',
            event: 'scheduling.payment_confirmed.slot_unresolved',
            message:
              'Payment confirmed but scheduling slot not found or without contact',
            tenantId: payload.tenantId,
            attributes: {
              payment_id: payload.paymentId ?? '',
              raw_reference: payload.rawReference ?? '',
            },
          });
          return;
        }

        if (!markResult.appliedChange) {
          this.structuredLog.emit({
            level: 'info',
            event: 'scheduling.payment_confirmed.idempotent',
            message:
              'Payment confirmation repeated: slot already confirmed, effects omitted',
            tenantId: payload.tenantId,
            attributes: {
              payment_id: payload.paymentId ?? '',
              slot_id: markResult.slot.id,
              professional_id: parsedReference.professionalId,
              date: parsedReference.date,
            },
          });
          return;
        }

        const confirmedSlot = markResult.slot;
        const reservedFor = confirmedSlot.reservedFor;
        if (!reservedFor?.contactId) {
          return;
        }
        const contactId = reservedFor.contactId;

        const professional = (
          await this.schedulingStore.listProfessionals(payload.tenantId)
        ).find((entry) => entry.id === parsedReference.professionalId);

        const calendarSync =
          await this.googleCalendarSyncService.syncReservation({
            tenantId: payload.tenantId,
            branchId: professional?.branchId ?? null,
            professionalId: parsedReference.professionalId,
            professionalName: professional?.name,
            date: parsedReference.date,
            slot: confirmedSlot,
          });

        const slotWithMeeting = calendarSync?.meetingUrl
          ? await this.schedulingStore.attachMeetingLinkToReservedSlot({
              tenantId: payload.tenantId,
              professionalId: parsedReference.professionalId,
              date: parsedReference.date,
              slotId: confirmedSlot.id,
              meetingProvider: 'GOOGLE_MEET',
              meetingUrl: calendarSync.meetingUrl,
            })
          : null;
        const meetingUrl =
          slotWithMeeting?.reservedFor?.meetingUrl ??
          calendarSync?.meetingUrl ??
          reservedFor.meetingUrl;

        const notificationPayload = {
          tenantId: payload.tenantId,
          contactId,
          contactName: reservedFor.contactName,
          professionalName: professional?.name || 'Profissional',
          categoryName: reservedFor.categoryName || 'Serviço',
          date: parsedReference.date,
          startsAt: confirmedSlot.startsAt,
          endsAt: confirmedSlot.endsAt,
          branchId: professional?.branchId ?? null,
          meetingUrl,
        };

        await this.messagingFacade.queueSystemMessage({
          tenantId: notificationPayload.tenantId,
          contactId: notificationPayload.contactId,
          channel: 'WHATSAPP',
          text: this.buildPaymentConfirmedMessage(notificationPayload),
          branchId: notificationPayload.branchId,
        });

        await this.eventBus.publish(
          new ProfessionalSlotPaymentConfirmedIntegrationEvent(
            notificationPayload,
          ),
        );

        await this.scheduleReservationReminders({
          tenantId: payload.tenantId,
          branchId: professional?.branchId ?? null,
          professionalId: parsedReference.professionalId,
          date: parsedReference.date,
          slotId: confirmedSlot.id,
          startsAt: confirmedSlot.startsAt,
          contactId,
        });

        this.structuredLog.emit({
          level: 'info',
          event: 'scheduling.payment_confirmed.pipeline_completed',
          message: 'Post-payment scheduling pipeline completed',
          tenantId: payload.tenantId,
          attributes: {
            payment_id: payload.paymentId ?? '',
            slot_id: confirmedSlot.id,
            professional_id: parsedReference.professionalId,
            date: parsedReference.date,
            contact_id: contactId,
          },
        });
      },
      { consumerName: 'scheduling-payment-confirmed' },
    );

    this.eventBus.subscribe(
      'payment.overdue',
      async (event) => {
        const payload =
          event.payload as PaymentOverdueIntegrationEvent['payload'];
        await this.handlePaymentAttentionRequired({
          tenantId: payload.tenantId,
          rawReference: payload.rawReference,
          reason: 'OVERDUE',
        });
      },
      { consumerName: 'scheduling-payment-overdue' },
    );

    this.eventBus.subscribe(
      'payment.refunded',
      async (event) => {
        const payload =
          event.payload as PaymentRefundedIntegrationEvent['payload'];
        await this.handlePaymentAttentionRequired({
          tenantId: payload.tenantId,
          rawReference: payload.rawReference,
          reason: 'REFUNDED',
        });
      },
      { consumerName: 'scheduling-payment-refunded' },
    );
  }

  private async handlePaymentAttentionRequired(input: {
    tenantId: string;
    rawReference?: string;
    reason: 'OVERDUE' | 'REFUNDED';
  }) {
    const parsedReference = parseSchedulingPaymentReference(input.rawReference);

    if (!parsedReference || parsedReference.tenantId !== input.tenantId) {
      return;
    }

    const slot = await this.schedulingStore.getAvailabilitySlot(
      input.tenantId,
      parsedReference.professionalId,
      parsedReference.date,
      parsedReference.slotId,
    );

    if (!slot?.reservedFor?.contactId) {
      return;
    }

    const professional = (
      await this.schedulingStore.listProfessionals(input.tenantId)
    ).find((entry) => entry.id === parsedReference.professionalId);

    const branchId = professional?.branchId ?? null;

    await this.schedulingStore.updateSlot({
      tenantId: input.tenantId,
      professionalId: parsedReference.professionalId,
      date: parsedReference.date,
      slotId: parsedReference.slotId,
      action: 'CANCEL_RESERVATION',
    });

    await this.googleCalendarSyncService.removeReservation({
      tenantId: input.tenantId,
      branchId,
      professionalId: parsedReference.professionalId,
      date: parsedReference.date,
      slotId: parsedReference.slotId,
    });

    await this.eventBus.publish(
      new ProfessionalSlotPaymentAttentionRequiredIntegrationEvent({
        tenantId: input.tenantId,
        contactId: slot.reservedFor.contactId,
        contactName: slot.reservedFor.contactName,
        professionalName: professional?.name || 'Profissional',
        categoryName: slot.reservedFor.categoryName || 'serviço',
        date: parsedReference.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        branchId,
        reason: input.reason,
      }),
    );

    this.structuredLog.emit({
      level: 'info',
      event: 'scheduling.reservation.cancelled_payment_attention',
      message:
        'Reservation cancelled after payment event (overdue or refund) with attention published',
      tenantId: input.tenantId,
      attributes: {
        reason: input.reason,
        slot_id: parsedReference.slotId,
        professional_id: parsedReference.professionalId,
        date: parsedReference.date,
      },
    });
  }

  private buildPaymentConfirmedMessage(input: {
    categoryName: string;
    professionalName: string;
    date: string;
    startsAt: string;
    endsAt: string;
    meetingUrl?: string;
  }) {
    const formattedDate = new Date(`${input.date}T12:00:00`).toLocaleDateString(
      'pt-BR',
    );
    const timeLine =
      input.startsAt && input.endsAt
        ? `${input.startsAt} às ${input.endsAt}`
        : input.startsAt;
    const meetLine = input.meetingUrl
      ? `\n\nLink do Google Meet: ${input.meetingUrl}`
      : '';

    return `Hello! We have received your payment. Your appointment for ${input.categoryName} with ${input.professionalName} on ${formattedDate}, ${timeLine}, is confirmed!${meetLine}`;
  }

  private getReminderIanaZone(): string {
    return (
      this.configService.get<string>('SCHEDULING_REMINDER_TIMEZONE')?.trim() ||
      'America/Sao_Paulo'
    );
  }

  private parseAppointmentStartAsUtc(input: {
    date: string;
    startsAt: string;
  }): Date {
    const dt = DateTime.fromFormat(
      `${input.date} ${input.startsAt}`,
      'yyyy-MM-dd HH:mm',
      { zone: this.getReminderIanaZone() },
    );

    return dt.toUTC().toJSDate();
  }

  private async scheduleReservationReminders(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    date: string;
    slotId: string;
    startsAt: string;
    contactId?: string;
  }): Promise<void> {
    if (!input.contactId) {
      return;
    }

    const appointmentAtUtc = this.parseAppointmentStartAsUtc({
      date: input.date,
      startsAt: input.startsAt,
    });
    const offsets = [24, 3, 1] as const;
    const scheduledOffsets: number[] = [];

    for (const offsetHours of offsets) {
      const runAt = new Date(
        appointmentAtUtc.getTime() - offsetHours * 60 * 60 * 1000,
      );

      if (runAt.getTime() <= Date.now()) {
        continue;
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
      scheduledOffsets.push(offsetHours);
    }

    if (scheduledOffsets.length > 0) {
      this.structuredLog.emit({
        level: 'info',
        event: 'scheduling.reminders.queued_after_confirmation',
        message: 'Reminder jobs queued after confirmation',
        tenantId: input.tenantId,
        attributes: {
          slot_id: input.slotId,
          professional_id: input.professionalId,
          date: input.date,
          timezone: this.getReminderIanaZone(),
          offsets_hours: scheduledOffsets.join(','),
        },
      });
    }
  }
}
