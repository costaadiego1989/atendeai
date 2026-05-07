import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  SalesPaymentConfirmedConversationIntegrationEvent,
  SalesPaymentLinkOverdueRemarketingIntegrationEvent,
} from '@modules/sales/application/integration-events/SalesIntegrationEvents';
import { EVENT_BUS, IEventBus } from '../../../../shared/application/ports/IEventBus';
import { IMessagingFacade, MESSAGING_FACADE } from '../facades/MessagingFacade';

type SalesPaymentChargeCreatedEnvelope = {
  payload?: {
    tenantId: string;
    contactId: string;
    contactName: string;
    value: number;
    invoiceUrl: string;
    branchId?: string;
    conversationId?: string | null;
  };
};

@Injectable()
export class SalesIntegrationHandlers implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe('sales.messaging_integration', async (event) => {
      const payload = this.extractPayload(
        event as unknown as SalesPaymentChargeCreatedEnvelope,
      );
      if (payload) {
        await this.handleChargeCreated(payload);
      }
    });

    this.eventBus.subscribe(
      'sales.payment_link.overdue_remarketing',
      async (event) => {
        await this.handlePaymentLinkOverdueRemarketing(
          event as SalesPaymentLinkOverdueRemarketingIntegrationEvent,
        );
      },
      { consumerName: 'messaging-sales-payment-link-overdue-remarketing' },
    );

    this.eventBus.subscribe(
      'sales.payment_confirmed.conversation',
      async (event) => {
        await this.handlePaymentConfirmedConversation(
          event as SalesPaymentConfirmedConversationIntegrationEvent,
        );
      },
      { consumerName: 'messaging-sales-payment-confirmed-conversation' },
    );
  }

  private extractPayload(event: SalesPaymentChargeCreatedEnvelope) {
    const payload = event?.payload;
    if (!payload) return null;
    if (
      typeof payload.tenantId !== 'string' ||
      typeof payload.contactId !== 'string' ||
      typeof payload.contactName !== 'string' ||
      typeof payload.value !== 'number' ||
      typeof payload.invoiceUrl !== 'string'
    ) {
      return null;
    }
    return payload;
  }

  private async handleChargeCreated(
    payload: NonNullable<SalesPaymentChargeCreatedEnvelope['payload']>,
  ) {
    const formattedValue = payload.value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const text = `Olá, ${payload.contactName}! O seu link de pagamento foi gerado no valor de ${formattedValue}. Quando quiser concluir, pode seguir por aqui: ${payload.invoiceUrl}`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: payload.branchId,
      conversationId: payload.conversationId,
    });
  }

  private async handlePaymentLinkOverdueRemarketing(
    event: SalesPaymentLinkOverdueRemarketingIntegrationEvent,
  ) {
    const p = event.payload as {
      tenantId?: string;
      contactId?: string;
      contactName?: string;
      paymentLinkUrl?: string;
      linkTitle?: string;
      value?: number;
      branchId?: string | null;
      conversationId?: string | null;
    };

    if (
      typeof p.tenantId !== 'string' ||
      typeof p.contactId !== 'string' ||
      typeof p.paymentLinkUrl !== 'string' ||
      !p.paymentLinkUrl.trim()
    ) {
      return;
    }

    const contactName =
      typeof p.contactName === 'string' && p.contactName.trim()
        ? p.contactName.trim()
        : 'Cliente';
    const title =
      typeof p.linkTitle === 'string' && p.linkTitle.trim()
        ? p.linkTitle.trim()
        : 'seu pagamento';
    const value =
      typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
    const formattedValue =
      value != null
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null;

    const valuePhrase = formattedValue ? ` (${formattedValue})` : '';

    const text = `Olá, ${contactName}! O link "${title}"${valuePhrase} segue disponível. Se ainda quiser concluir, pode finalizar aqui: ${p.paymentLinkUrl}`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: p.tenantId,
      contactId: p.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: p.branchId ?? undefined,
      conversationId: p.conversationId ?? undefined,
    });
  }

  private async handlePaymentConfirmedConversation(
    event: SalesPaymentConfirmedConversationIntegrationEvent,
  ) {
    const p = event.payload as {
      tenantId?: string;
      contactId?: string;
      contactName?: string;
      paymentLinkUrl?: string;
      linkTitle?: string;
      value?: number;
      branchId?: string | null;
      conversationId?: string | null;
    };

    if (typeof p.tenantId !== 'string' || typeof p.contactId !== 'string') {
      return;
    }

    const contactName =
      typeof p.contactName === 'string' && p.contactName.trim()
        ? p.contactName.trim()
        : 'Cliente';
    const value =
      typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
    const formattedValue =
      value != null
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null;

    const amountLine = formattedValue ? ` no valor de ${formattedValue}` : '';
    const text = `Pagamento confirmado com sucesso, ${contactName}! Recebemos a confirmação${amountLine}. Seguimos com o seu atendimento e qualquer atualização importante vai aparecer por aqui.`;

    await this.messagingFacade.queueSystemMessage({
      tenantId: p.tenantId,
      contactId: p.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: p.branchId ?? undefined,
      conversationId: p.conversationId ?? undefined,
    });
  }
}
