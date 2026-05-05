import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '../../../../shared/application/ports/IEventBus';
import { IMessagingFacade, MESSAGING_FACADE } from '../facades/MessagingFacade';
import { ProfessionalSlotReservedIntegrationEvent } from '../../../scheduling/domain/events/integration/ProfessionalSlotReservedIntegrationEvent';
import { ProfessionalSlotPaymentPendingIntegrationEvent } from '../../../scheduling/domain/events/integration/ProfessionalSlotPaymentPendingIntegrationEvent';
import { ProfessionalSlotRescheduledIntegrationEvent } from '../../../scheduling/domain/events/integration/ProfessionalSlotRescheduledIntegrationEvent';
import {
  ProfessionalSlotPaymentAttentionRequiredIntegrationEvent,
  ProfessionalSlotPaymentConfirmedIntegrationEvent,
} from '../../../scheduling/domain/events/integration/ProfessionalSlotPaymentConfirmedIntegrationEvent';

@Injectable()
export class SchedulingIntegrationHandlers implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe(
      'scheduling.professional_slot.reserved',
      async (event) =>
        this.handleReserved(event as ProfessionalSlotReservedIntegrationEvent),
      { consumerName: 'messaging-scheduling-reserved' },
    );
    this.eventBus.subscribe(
      'scheduling.professional_slot.payment_pending',
      async (event) =>
        this.handlePaymentPending(event as ProfessionalSlotPaymentPendingIntegrationEvent),
      { consumerName: 'messaging-scheduling-payment-pending' },
    );
    this.eventBus.subscribe(
      'scheduling.professional_slot.rescheduled',
      async (event) =>
        this.handleRescheduled(event as ProfessionalSlotRescheduledIntegrationEvent),
      { consumerName: 'messaging-scheduling-rescheduled' },
    );
    this.eventBus.subscribe(
      'scheduling.professional_slot.payment_attention_required',
      async (event) =>
        this.handlePaymentAttentionRequired(
          event as ProfessionalSlotPaymentAttentionRequiredIntegrationEvent,
        ),
      { consumerName: 'messaging-scheduling-payment-attention-required' },
    );
  }

  private async handleReserved(event: ProfessionalSlotReservedIntegrationEvent) {
    const { payload } = event;
    const formattedDate = this.formatDate(payload.date);
    const timeLine = payload.startsAt && payload.endsAt
      ? `${payload.startsAt} as ${payload.endsAt}`
      : payload.startsAt;
    const meetLine = payload.meetingUrl
      ? `\n\nLink do Google Meet: ${payload.meetingUrl}`
      : '';

    let text = `Olá! Seu agendamento foi confirmado para ${payload.categoryName} com ${payload.professionalName} para ${formattedDate}, as ${timeLine}. Se precisar ajustar o horário, e so responder por aqui.`;

    if (meetLine) {
      text += meetLine;
    }

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
    });
  }

  private async handlePaymentPending(event: ProfessionalSlotPaymentPendingIntegrationEvent) {
    const { payload } = event;
    const formattedDate = this.formatDate(payload.date);
    const formattedExpiry = new Date(payload.expiresAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const timeLine = payload.startsAt && payload.endsAt
      ? `${payload.startsAt} as ${payload.endsAt}`
      : payload.startsAt;

    const text = `Olá! Seu horário para ${payload.categoryName} com ${payload.professionalName} ficou pré-agendado para ${formattedDate}, as ${timeLine}. Para confirmar, conclua o pagamento por aqui: ${payload.paymentUrl}. Esse pré-agendamento fica reservado ate ${formattedExpiry}.`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
    });
  }

  private async handleRescheduled(event: ProfessionalSlotRescheduledIntegrationEvent) {
    const { payload } = event;
    const formattedDate = this.formatDate(payload.date);
    const timeLine = payload.startsAt && payload.endsAt
      ? `${payload.startsAt} as ${payload.endsAt}`
      : payload.startsAt;
    const meetLine = payload.meetingUrl
      ? `\n\nLink do Google Meet: ${payload.meetingUrl}`
      : '';

    let text: string;

    if (payload.pendingPayment && payload.paymentUrl) {
      const formattedExpiry = payload.paymentExpiresAt
        ? new Date(payload.paymentExpiresAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        : '';

      const expiryLine = formattedExpiry ? ` Ele segue reservado ate ${formattedExpiry}.` : '';

      text = `Olá! Seu pré-agendamento para ${payload.categoryName} com ${payload.professionalName} foi remarcado para ${formattedDate}, as ${timeLine}. O mesmo link de pagamento continua valido: ${payload.paymentUrl}.${expiryLine}`;
    } else {
      text = `Olá! Seu agendamento para ${payload.categoryName} com ${payload.professionalName} foi remarcado para ${formattedDate}, as ${timeLine}. Se precisar ajustar novamente, e so responder por aqui.`;
    }

    if (meetLine) {
      text += meetLine;
    }

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
    });
  }

  private async handlePaymentConfirmed(event: ProfessionalSlotPaymentConfirmedIntegrationEvent) {
    const { payload } = event;
    const formattedDate = this.formatDate(payload.date);
    const timeLine = payload.startsAt && payload.endsAt
      ? `${payload.startsAt} as ${payload.endsAt}`
      : payload.startsAt;

    const meetLine = payload.meetingUrl
      ? `\n\nLink do Google Meet: ${payload.meetingUrl}`
      : '';
    const text = `Olá! Recebemos o seu pagamento. Seu agendamento para ${payload.categoryName} com ${payload.professionalName} para ${formattedDate}, as ${timeLine} está confirmado!${meetLine}`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
    });
  }

  private async handlePaymentAttentionRequired(
    event: ProfessionalSlotPaymentAttentionRequiredIntegrationEvent,
  ) {
    const { payload } = event;
    const formattedDate = this.formatDate(payload.date);
    const timeLine = payload.startsAt && payload.endsAt
      ? `${payload.startsAt} as ${payload.endsAt}`
      : payload.startsAt;
    const reasonText =
      payload.reason === 'REFUNDED'
        ? 'o pagamento foi estornado'
        : 'o pagamento ficou vencido';

    const text = `Olá! Como ${reasonText}, o horário de ${payload.categoryName} com ${payload.professionalName} para ${formattedDate}, as ${timeLine}, foi liberado. Se quiser, posso te ajudar a escolher um novo horário.`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
    });
  }

  private getFirstName(name: string) {
    return name?.trim().split(/\s+/)[0] ?? 'cliente';
  }

  private formatDate(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
  }
}
