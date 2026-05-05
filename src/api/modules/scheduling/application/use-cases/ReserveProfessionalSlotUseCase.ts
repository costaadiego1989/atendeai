import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { PaymentService } from '@modules/payment/application/services/PaymentService';
import {
  ISchedulingFacade,
  SCHEDULING_FACADE,
} from '../facades/SchedulingFacade';
import {
  AvailabilitySlotRecord,
  ISchedulingStore,
  ReserveAvailabilitySlotInput,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { buildSchedulingPaymentReference } from '../services/SchedulingPaymentReference';
import {
  ISchedulingReservationExpirationQueue,
  SCHEDULING_RESERVATION_EXPIRATION_QUEUE,
} from '../../domain/ports/ISchedulingReservationExpirationQueue';
import {
  ISchedulingReminderQueue,
  SCHEDULING_REMINDER_QUEUE,
} from '../../domain/ports/ISchedulingReminderQueue';
import { SchedulingGoogleCalendarSyncService } from '../services/SchedulingGoogleCalendarSyncService';
import { EVENT_BUS, IEventBus } from '../../../../shared/application/ports/IEventBus';
import { ProfessionalSlotReservedIntegrationEvent } from '../../domain/events/integration/ProfessionalSlotReservedIntegrationEvent';
import { ProfessionalSlotPaymentPendingIntegrationEvent } from '../../domain/events/integration/ProfessionalSlotPaymentPendingIntegrationEvent';
import {
  ISchedulingRecurringReservationRepository,
  SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
  SchedulingRecurrencePeriod,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';
import { SchedulingRecurrenceDateService } from '../services/SchedulingRecurrenceDateService';

@Injectable()
export class ReserveProfessionalSlotUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(SCHEDULING_FACADE)
    private readonly schedulingFacade: ISchedulingFacade,
    private readonly paymentService: PaymentService,
    @Inject(SCHEDULING_RESERVATION_EXPIRATION_QUEUE)
    private readonly schedulingReservationExpirationQueue: ISchedulingReservationExpirationQueue,
    @Inject(SCHEDULING_REMINDER_QUEUE)
    private readonly schedulingReminderQueue: ISchedulingReminderQueue,
    private readonly googleCalendarSyncService: SchedulingGoogleCalendarSyncService,
    @Inject(SCHEDULING_RECURRING_RESERVATION_REPOSITORY)
    private readonly recurringReservationRepository: ISchedulingRecurringReservationRepository,
    private readonly recurrenceDateService: SchedulingRecurrenceDateService,
    private readonly configService: ConfigService,
  ) { }

  private defaultPaymentHoldTimeoutHours(): number {
    const fallback = 3;
    const raw = this.configService.get<string>('SCHEDULING_PENDING_PAYMENT_TIMEOUT_HOURS')?.trim();
    if (!raw) {
      return fallback;
    }
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0.5) {
      return fallback;
    }
    const maxHold = 720;
    return Math.min(parsed, maxHold);
  }

  async execute(
    input: ReserveAvailabilitySlotInput & {
      branchId?: string | null;
      isFree?: boolean;
      paymentTimeoutHours?: number;
      suppressCustomerNotification?: boolean;
      isOnline?: boolean;
      isRecurring?: boolean;
      recurrencePeriod?: SchedulingRecurrencePeriod;
      recurrenceInterval?: number;
      recurrenceOccurrences?: number;
      skipRecurringSchedule?: boolean;
    },
  ): Promise<AvailabilitySlotRecord> {
    const linkedCategories = await this.resolveProfessionalCategories(
      input.tenantId,
      input.branchId,
      input.professionalId,
    );
    const contact =
      input.contactId
        ? await this.contactFacade.getContactById(input.tenantId, input.contactId)
        : null;
    const category = this.resolveCategoryForReservation(
      input,
      linkedCategories,
    );
    const professional = (
      await this.schedulingStore.listProfessionals(input.tenantId, input.branchId)
    ).find((entry) => entry.id === input.professionalId);
    const isFree = input.isFree ?? true;

    const reservedSlot = await this.schedulingStore.reserveSlot({
      ...input,
      status: isFree ? 'RESERVED' : 'PRE_RESERVED',
      contactName: contact?.name,
      contactPhone: contact?.phone,
      contactEmail: contact?.email,
      categoryName: category?.name,
      isOnline: input.isOnline,
    });

    if (!reservedSlot) {
      const slots = await this.schedulingStore.listAvailability(
        input.tenantId,
        input.professionalId,
        input.date,
      );

      const slotExists = slots.some((slot) => slot.id === input.slotId);

      if (!slotExists) {
        throw new NotFoundException('Availability slot not found');
      }

      throw new ConflictException('Availability slot is no longer available');
    }

    const finalSlot = isFree
      ? await this.finalizeFreeReservation({
        input,
        reservedSlot,
        contact,
        category,
        professionalName: professional?.name,
      })
      : await this.finalizePaidPreReservation({
        input,
        reservedSlot,
        contact,
        category,
        professionalName: professional?.name,
      });

    const calendarSync = await this.googleCalendarSyncService.syncReservation({
      tenantId: input.tenantId,
      branchId: input.branchId ?? professional?.branchId ?? null,
      professionalId: input.professionalId,
      professionalName: professional?.name,
      date: input.date,
      slot: finalSlot,
      createGoogleMeet: Boolean(input.isOnline || reservedSlot.isOnline || reservedSlot.reservedFor?.isOnline),
    });

    const slotWithMeeting =
      calendarSync?.meetingUrl
        ? await this.schedulingStore.attachMeetingLinkToReservedSlot({
          tenantId: input.tenantId,
          professionalId: input.professionalId,
          date: input.date,
          slotId: input.slotId,
          meetingProvider: 'GOOGLE_MEET',
          meetingUrl: calendarSync.meetingUrl,
        })
        : null;

    const persistedSlot = slotWithMeeting ?? finalSlot;

    if (
      isFree &&
      input.isOnline &&
      !input.suppressCustomerNotification &&
      persistedSlot.reservedFor?.contactId
    ) {
      await this.eventBus.publish(new ProfessionalSlotReservedIntegrationEvent({
        tenantId: input.tenantId,
        contactId: persistedSlot.reservedFor.contactId,
        professionalName: professional?.name || 'Profissional',
        categoryName: persistedSlot.reservedFor.categoryName || 'ServiÃ§o',
        date: input.date,
        startsAt: persistedSlot.startsAt,
        endsAt: persistedSlot.endsAt,
        branchId: input.branchId ?? professional?.branchId ?? null,
        meetingUrl: persistedSlot.reservedFor.meetingUrl,
      }));
    }

    if (input.isRecurring && !input.skipRecurringSchedule) {
      await this.scheduleRecurringReservations({
        input,
        slot: persistedSlot,
      });
    }

    await this.scheduleReservationReminders({
      tenantId: input.tenantId,
      branchId: input.branchId ?? professional?.branchId ?? null,
      professionalId: input.professionalId,
      date: input.date,
      slot: persistedSlot,
    });

    return persistedSlot;
  }

  private async resolveProfessionalCategories(
    tenantId: string,
    branchId: string | null | undefined,
    professionalId: string,
  ) {
    const categories = await this.schedulingFacade.listCategories(tenantId, branchId);
    const availabilityByCategory = await Promise.all(
      categories.map(async (category) => ({
        category,
        professionals: await this.schedulingStore.listProfessionalsByCategory(
          tenantId,
          category.id,
          branchId,
        ),
      })),
    );

    return availabilityByCategory
      .filter((entry) =>
        entry.professionals.some((professional) => professional.id === professionalId),
      )
      .map((entry) => entry.category);
  }

  private resolveCategoryForReservation(
    input: ReserveAvailabilitySlotInput,
    linkedCategories: Awaited<
      ReturnType<ReserveProfessionalSlotUseCase['resolveProfessionalCategories']>
    >,
  ) {
    if (!linkedCategories.length) {
      return null;
    }

    if (input.categoryId) {
      const explicitCategory =
        linkedCategories.find((entry) => entry.id === input.categoryId) ?? null;

      if (explicitCategory) {
        return explicitCategory;
      }
    }

    if (linkedCategories.length === 1) {
      return linkedCategories[0];
    }

    const categoryMatchedByName =
      linkedCategories.find(
        (entry) =>
          entry.name.trim().toLowerCase() ===
          (input.categoryName ?? '').trim().toLowerCase(),
      ) ?? null;

    if (categoryMatchedByName) {
      return categoryMatchedByName;
    }

    const categoryWithBasePrice =
      linkedCategories.find((entry) => entry.basePrice != null) ?? null;

    return categoryWithBasePrice ?? linkedCategories[0];
  }

  private async finalizeFreeReservation(input: {
    input: ReserveAvailabilitySlotInput & {
      suppressCustomerNotification?: boolean;
    };
    reservedSlot: AvailabilitySlotRecord;
    contact: { contactId: string; name: string; phone: string; email?: string } | null;
    category: { id: string; name: string } | null;
    professionalName?: string;
  }) {
    if (
      !input.contact?.contactId ||
      input.input.suppressCustomerNotification ||
      input.input.isOnline
    ) {
      return input.reservedSlot;
    }

    await this.eventBus.publish(new ProfessionalSlotReservedIntegrationEvent({
      tenantId: input.input.tenantId,
      contactId: input.contact.contactId,
      professionalName: input.professionalName || 'Profissional',
      categoryName: input.category?.name || 'Serviço',
      date: input.input.date,
      startsAt: input.reservedSlot.startsAt,
      endsAt: input.reservedSlot.endsAt,
      branchId: input.input.branchId ?? null,
    }));

    const updatedWithReservation = await this.schedulingStore.updateSlot({
      tenantId: input.input.tenantId,
      professionalId: input.input.professionalId,
      date: input.input.date,
      slotId: input.input.slotId,
      action: 'UPDATE_RESERVATION',
      contactId: input.contact.contactId,
      contactName: input.contact.name,
      contactPhone: input.contact.phone,
      contactEmail: input.contact.email,
      categoryId: input.category?.id,
      categoryName: input.category?.name,
      notes: input.input.notes,
      isOnline: input.input.isOnline,
    });

    return updatedWithReservation ?? input.reservedSlot;
  }

  private async finalizePaidPreReservation(input: {
    input: ReserveAvailabilitySlotInput & {
      paymentTimeoutHours?: number;
      suppressCustomerNotification?: boolean;
    };
    reservedSlot: AvailabilitySlotRecord;
    contact: { contactId: string; name: string; phone: string; email?: string } | null;
    category: { id: string; name: string; basePrice?: number | null } | null;
    professionalName?: string;
  }) {
    if (!input.contact?.contactId || !input.contact.phone) {
      await this.cancelReservationSilently(input.input);
      throw new BadRequestException(
        'Select a CRM contact with WhatsApp before sending the payment link',
      );
    }

    const amount = input.reservedSlot.customPrice ?? input.category?.basePrice ?? null;

    if (amount == null) {
      await this.cancelReservationSilently(input.input);
      throw new BadRequestException(
        'Configure a slot price or category base price before pre-booking with payment',
      );
    }

    const paymentTimeoutHours =
      input.input.paymentTimeoutHours && input.input.paymentTimeoutHours > 0
        ? input.input.paymentTimeoutHours
        : this.defaultPaymentHoldTimeoutHours();
    const paymentExpiresAt = new Date(
      Date.now() + paymentTimeoutHours * 60 * 60 * 1000,
    ).toISOString();
    const paymentReference = buildSchedulingPaymentReference({
      tenantId: input.input.tenantId,
      professionalId: input.input.professionalId,
      date: input.input.date,
      slotId: input.input.slotId,
    });
    const serviceName =
      input.category?.name || input.reservedSlot.label || 'Agendamento de serviço';

    let paymentLinkId: string | null = null;

    try {
      const paymentLink = await this.paymentService.createPaymentLink({
        name: serviceName,
        description: `${serviceName} pre-agendado para ${input.contact.name} em ${input.input.date}`,
        value: amount,
        externalReference: paymentReference,
        billingType: 'PIX',
        chargeType: 'DETACHED',
        dueDateLimitDays: Math.max(1, Math.ceil(paymentTimeoutHours / 24)),
      });
      paymentLinkId = paymentLink.id;

      const slotWithPayment =
        await this.schedulingStore.attachPaymentLinkToReservedSlot({
          tenantId: input.input.tenantId,
          professionalId: input.input.professionalId,
          date: input.input.date,
          slotId: input.input.slotId,
          reference: paymentReference,
          linkId: paymentLink.id,
          linkUrl: paymentLink.url,
          amount,
          billingType: 'PIX',
          expiresAt: paymentExpiresAt,
        });

      if (!slotWithPayment) {
        throw new ConflictException(
          'Could not attach payment link to pre-reserved slot',
        );
      }

      if (!input.input.suppressCustomerNotification) {
        await this.eventBus.publish(new ProfessionalSlotPaymentPendingIntegrationEvent({
          tenantId: input.input.tenantId,
          contactId: input.contact.contactId,
          professionalName: input.professionalName || 'Profissional',
          categoryName: input.category?.name || 'Serviço',
          date: input.input.date,
          startsAt: slotWithPayment.startsAt,
          endsAt: slotWithPayment.endsAt,
          paymentUrl: paymentLink.url,
          expiresAt: paymentExpiresAt,
          branchId: input.input.branchId ?? null,
        }));
      }

      const updatedWithReservation = await this.schedulingStore.updateSlot({
        tenantId: input.input.tenantId,
        professionalId: input.input.professionalId,
        date: input.input.date,
        slotId: input.input.slotId,
        action: 'UPDATE_RESERVATION',
        contactId: input.contact.contactId,
        contactName: input.contact.name,
        contactPhone: input.contact.phone,
        contactEmail: input.contact.email,
        categoryId: input.category?.id,
        categoryName: input.category?.name,
        notes: input.input.notes,
        isOnline: input.input.isOnline,
      });

      await this.schedulingReservationExpirationQueue.addJob({
        tenantId: input.input.tenantId,
        professionalId: input.input.professionalId,
        date: input.input.date,
        slotId: input.input.slotId,
        runAt: paymentExpiresAt,
      });

      return updatedWithReservation ?? slotWithPayment;
    } catch (error) {
      if (paymentLinkId) {
        try {
          await this.paymentService.removePaymentLink(paymentLinkId);
        } catch {
          // Keep rollback resilient even if the provider link cleanup fails.
        }
      }
      await this.cancelReservationSilently(input.input);
      throw error;
    }
  }

  private async cancelReservationSilently(input: ReserveAvailabilitySlotInput) {
    await this.schedulingStore.updateSlot({
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      date: input.date,
      slotId: input.slotId,
      action: 'CANCEL_RESERVATION',
    });
  }

  private async scheduleRecurringReservations(input: {
    input: ReserveAvailabilitySlotInput & {
      isFree?: boolean;
      isOnline?: boolean;
      recurrencePeriod?: SchedulingRecurrencePeriod;
      recurrenceInterval?: number;
      recurrenceOccurrences?: number;
      paymentTimeoutHours?: number;
    };
    slot: AvailabilitySlotRecord;
  }): Promise<void> {
    const maxOccurrences = input.input.recurrenceOccurrences ?? 4;
    if (maxOccurrences <= 1) {
      return;
    }

    const period = input.input.recurrencePeriod ?? 'WEEKLY';
    const interval = input.input.recurrenceInterval ?? 1;
    const nextDate = this.recurrenceDateService.getNextDate(
      input.input.date,
      period,
      interval,
    );

    await this.recurringReservationRepository.create({
      tenantId: input.input.tenantId,
      branchId: input.input.branchId ?? null,
      professionalId: input.input.professionalId,
      contactId: input.input.contactId ?? null,
      categoryId: input.input.categoryId ?? null,
      conversationId: input.input.conversationId ?? null,
      period,
      interval,
      maxOccurrences,
      occurrencesCreated: 1,
      startsAt: input.slot.startsAt,
      endsAt: input.slot.endsAt,
      firstDate: input.input.date,
      nextDate,
      nextRunAt: this.recurrenceDateService.getRunAt(nextDate),
      isFree: input.input.isFree ?? true,
      isOnline: Boolean(input.input.isOnline),
      paymentTimeoutHours: input.input.paymentTimeoutHours ?? null,
      notes: input.input.notes ?? null,
    });
  }

  private async scheduleReservationReminders(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    date: string;
    slot: AvailabilitySlotRecord;
  }): Promise<void> {
    if (!input.slot.reservedFor?.contactId || input.slot.status !== 'RESERVED') {
      return;
    }

    const appointmentAt = this.getAppointmentDate(input.date, input.slot.startsAt);
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
          slotId: input.slot.id,
          offsetHours,
          runAt: runAt.toISOString(),
        });
      }),
    );
  }

  private getAppointmentDate(date: string, startsAt: string): Date {
    return new Date(`${date}T${startsAt}:00-03:00`);
  }
}
