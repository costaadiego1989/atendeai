import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import {
  ISchedulingGoogleCalendarEventLinkRepository,
  SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarEventLinkRepository';
import { GoogleCalendarOAuthService } from '../../infrastructure/services/GoogleCalendarOAuthService';
import { AvailabilitySlotRecord } from '../../domain/ports/ISchedulingStore';

@Injectable()
export class SchedulingGoogleCalendarSyncService {
  private readonly logger = new Logger(
    SchedulingGoogleCalendarSyncService.name,
  );
  private readonly timeZone = 'America/Sao_Paulo';

  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly connectionRepository: ISchedulingGoogleCalendarConnectionRepository,
    @Inject(SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY)
    private readonly eventLinkRepository: ISchedulingGoogleCalendarEventLinkRepository,
    private readonly googleCalendarOAuthService: GoogleCalendarOAuthService,
  ) {}

  async syncReservation(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    professionalName?: string;
    date: string;
    slot: AvailabilitySlotRecord;
    createGoogleMeet?: boolean;
  }): Promise<{ meetingUrl?: string } | undefined> {
    const connection = await this.connectionRepository.findBestForScope(
      input.tenantId,
      input.branchId,
    );
    if (!connection) {
      return;
    }

    if (
      input.slot.status !== 'PRE_RESERVED' &&
      input.slot.status !== 'RESERVED' &&
      input.slot.status !== 'COMPLETED' &&
      input.slot.status !== 'NO_SHOW'
    ) {
      await this.removeReservation({
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slot.id,
      });
      return;
    }

    try {
      const existingLink = await this.eventLinkRepository.findBySlot({
        tenantId: input.tenantId,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slot.id,
      });
      const shouldCreateGoogleMeet =
        Boolean(input.createGoogleMeet) ||
        Boolean(input.slot.reservedFor?.isOnline);
      const payload = this.buildEventPayload({
        ...input,
        createGoogleMeet: shouldCreateGoogleMeet,
      });

      if (existingLink) {
        const updatedEvent = await this.googleCalendarOAuthService.updateEvent(
          connection.refreshToken,
          connection.calendarId,
          existingLink.eventId,
          payload,
        );
        await this.eventLinkRepository.save({
          ...existingLink,
          updatedAt: new Date().toISOString(),
        });
        return {
          meetingUrl: updatedEvent?.meetingUrl,
        };
      }

      const createdEvent = await this.googleCalendarOAuthService.createEvent(
        connection.refreshToken,
        connection.calendarId,
        payload,
      );
      const now = new Date().toISOString();
      await this.eventLinkRepository.save({
        tenantId: input.tenantId,
        branchId: connection.branchId ?? null,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slot.id,
        eventId: createdEvent.id,
        createdAt: now,
        updatedAt: now,
      });
      return {
        meetingUrl: createdEvent.meetingUrl,
      };
    } catch (error: any) {
      this.logger.warn(
        `Google Calendar sync failed for slot ${input.slot.id}: ${error?.message || error}`,
      );
      return undefined;
    }
  }

  async removeReservation(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    date: string;
    slotId: string;
  }): Promise<{ meetingUrl?: string } | undefined> {
    const connection = await this.connectionRepository.findBestForScope(
      input.tenantId,
      input.branchId,
    );
    if (!connection) {
      return undefined;
    }

    const existingLink = await this.eventLinkRepository.findBySlot(input);
    if (!existingLink) {
      return;
    }

    try {
      await this.googleCalendarOAuthService.deleteEvent(
        connection.refreshToken,
        connection.calendarId,
        existingLink.eventId,
      );
    } catch (error: any) {
      this.logger.warn(
        `Google Calendar event removal failed for slot ${input.slotId}: ${error?.message || error}`,
      );
    } finally {
      await this.eventLinkRepository.deleteBySlot(input);
    }
  }

  async rescheduleReservation(input: {
    tenantId: string;
    branchId?: string | null;
    sourceProfessionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetProfessionalId: string;
    targetProfessionalName?: string;
    targetDate: string;
    targetSlot: AvailabilitySlotRecord;
  }): Promise<{ meetingUrl?: string } | undefined> {
    const connection = await this.connectionRepository.findBestForScope(
      input.tenantId,
      input.branchId,
    );
    if (!connection) {
      return undefined;
    }

    try {
      const existingLink = await this.eventLinkRepository.findBySlot({
        tenantId: input.tenantId,
        professionalId: input.sourceProfessionalId,
        date: input.sourceDate,
        slotId: input.sourceSlotId,
      });

      if (!existingLink) {
        return this.syncReservation({
          tenantId: input.tenantId,
          branchId: input.branchId,
          professionalId: input.targetProfessionalId,
          professionalName: input.targetProfessionalName,
          date: input.targetDate,
          slot: input.targetSlot,
          createGoogleMeet: Boolean(input.targetSlot.reservedFor?.isOnline),
        });
      }

      const updatedEvent = await this.googleCalendarOAuthService.updateEvent(
        connection.refreshToken,
        connection.calendarId,
        existingLink.eventId,
        this.buildEventPayload({
          professionalName: input.targetProfessionalName,
          date: input.targetDate,
          slot: input.targetSlot,
          createGoogleMeet: Boolean(input.targetSlot.reservedFor?.isOnline),
        }),
      );

      await this.eventLinkRepository.reassignSlot({
        tenantId: input.tenantId,
        sourceProfessionalId: input.sourceProfessionalId,
        sourceDate: input.sourceDate,
        sourceSlotId: input.sourceSlotId,
        targetProfessionalId: input.targetProfessionalId,
        targetDate: input.targetDate,
        targetSlotId: input.targetSlot.id,
        branchId: connection.branchId ?? null,
        updatedAt: new Date().toISOString(),
      });

      return {
        meetingUrl:
          updatedEvent?.meetingUrl ?? input.targetSlot.reservedFor?.meetingUrl,
      };
    } catch (error: any) {
      this.logger.warn(
        `Google Calendar reschedule failed for slot ${input.sourceSlotId}: ${error?.message || error}`,
      );
      return undefined;
    }
  }

  private buildEventPayload(input: {
    professionalName?: string;
    date: string;
    slot: AvailabilitySlotRecord;
    createGoogleMeet?: boolean;
  }) {
    const contactName =
      input.slot.reservedFor?.contactName || 'horário interno';
    const categoryName =
      input.slot.reservedFor?.categoryName || input.slot.label || 'Agendamento';
    const summaryPrefix =
      input.slot.status === 'PRE_RESERVED'
        ? '[Pendente] '
        : input.slot.status === 'COMPLETED'
          ? '[Concluido] '
          : input.slot.status === 'NO_SHOW'
            ? '[No-show] '
            : '';
    const statusLabel =
      input.slot.status === 'PRE_RESERVED'
        ? 'Aguardando pagamento'
        : input.slot.status === 'COMPLETED'
          ? 'Concluido'
          : input.slot.status === 'NO_SHOW'
            ? 'No-show'
            : 'Confirmado';
    const descriptionLines = [
      `Profissional: ${input.professionalName || 'não informado'}`,
      `Cliente: ${contactName}`,
      input.slot.reservedFor?.contactPhone
        ? `Telefone: ${input.slot.reservedFor.contactPhone}`
        : null,
      input.slot.reservedFor?.contactEmail
        ? `Email: ${input.slot.reservedFor.contactEmail}`
        : null,
      `Status: ${statusLabel}`,
      input.slot.payment?.amount != null
        ? `Valor: R$ ${input.slot.payment.amount.toFixed(2)}`
        : null,
      input.slot.payment?.linkUrl
        ? `Link de pagamento: ${input.slot.payment.linkUrl}`
        : null,
      input.slot.reservedFor?.meetingUrl
        ? `Link da teleconsulta: ${input.slot.reservedFor.meetingUrl}`
        : null,
      input.slot.payment?.expiresAt
        ? `Pagamento expira em: ${new Date(input.slot.payment.expiresAt).toISOString()}`
        : null,
      input.slot.reservedFor?.notes
        ? `Observações: ${input.slot.reservedFor.notes}`
        : null,
    ].filter(Boolean);

    return {
      summary: `${summaryPrefix}${categoryName} - ${contactName}`,
      description: descriptionLines.join('\n'),
      startDateTime: `${input.date}T${input.slot.startsAt}:00-03:00`,
      endDateTime: `${input.date}T${input.slot.endsAt}:00-03:00`,
      timeZone: this.timeZone,
      createGoogleMeet: Boolean(input.createGoogleMeet),
    };
  }
}
