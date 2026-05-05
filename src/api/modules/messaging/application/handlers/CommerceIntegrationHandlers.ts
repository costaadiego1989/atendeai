import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceOrderStatus,
  ICommerceRepository,
} from '@modules/commerce/domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IMessagingFacade, MESSAGING_FACADE } from '../facades/MessagingFacade';

type CommerceOrderStatusEnvelope = {
  payload?: {
    tenantId?: string;
    orderId?: string;
  };
};

const STATUS_MESSAGES: Record<CommerceOrderStatus, string | null> = {
  AWAITING_PAYMENT: null,
  PAID: 'Recebemos o pagamento do seu pedido. Ja vamos iniciar o processamento por aqui.',
  PREPARING: 'Seu pedido ja esta em preparacao. Avisaremos por aqui assim que avancar para a proxima etapa.',
  READY_FOR_PICKUP: 'Seu pedido esta pronto para retirada. Quando chegar, e so informar seu nome ou numero do pedido.',
  OUT_FOR_DELIVERY: 'Seu pedido saiu para entrega. Fique de olho no WhatsApp para qualquer atualizacao do entregador.',
  DELIVERED: 'Seu pedido foi entregue. Obrigado pela preferencia!',
  CANCELLED: 'Seu pedido foi cancelado. Se quiser refazer ou ajustar algo, responda por aqui que ajudamos voce.',
};

@Injectable()
export class CommerceIntegrationHandlers implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  onModuleInit() {
    for (const eventName of [
      'commerce.order.paid',
      'commerce.order.preparing',
      'commerce.order.ready-for-pickup',
      'commerce.order.shipped',
      'commerce.order.delivered',
      'commerce.order.cancelled',
    ]) {
      this.eventBus.subscribe(
        eventName,
        async (event) =>
          this.handleOrderStatusChanged(event as CommerceOrderStatusEnvelope),
        { consumerName: `messaging-${eventName}` },
      );
    }
  }

  private async handleOrderStatusChanged(event: CommerceOrderStatusEnvelope) {
    const tenantId = event.payload?.tenantId;
    const orderId = event.payload?.orderId;

    if (!tenantId || !orderId) {
      return;
    }

    const order = await this.commerceRepository.findOrderById(tenantId, orderId);
    if (!order?.contactId) {
      return;
    }

    const text = STATUS_MESSAGES[order.status];
    if (!text) {
      return;
    }

    await this.messagingFacade.queueSystemMessage({
      tenantId,
      contactId: order.contactId,
      channel: 'WHATSAPP',
      text,
      branchId: order.branchId,
    });
  }
}
