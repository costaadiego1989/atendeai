import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  MESSAGING_FACADE,
  IMessagingFacade,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { getCarrierLabel } from '../../domain/value-objects/TrackingUrl';

@Injectable()
export class OrderTrackingNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(OrderTrackingNotificationHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'commerce.order.tracking-set',
      async (event) => {
        await this.handle(event);
      },
      { consumerName: 'commerce-order-tracking-notification' },
    );
  }

  private async handle(event: any): Promise<void> {
    const payload = event.payload || event;
    const { orderId, tenantId, contactId, trackingCode, trackingUrl, carrier } =
      payload;

    if (!contactId) {
      this.logger.warn(
        `Skipping tracking notification for order ${orderId}: no contactId`,
      );
      return;
    }

    try {
      const order = await this.commerceRepository.findOrderById(
        tenantId,
        orderId,
      );

      if (!order) {
        this.logger.warn(
          `Skipping tracking notification: order ${orderId} not found`,
        );
        return;
      }

      const message = this.buildTrackingMessage(
        trackingCode,
        trackingUrl,
        carrier,
      );

      await this.messagingFacade.queueSystemMessage({
        tenantId,
        contactId,
        channel: 'WHATSAPP',
        text: message,
        branchId: order.branchId ?? null,
      });

      this.logger.log(
        `Tracking notification sent for order ${orderId} (code: ${trackingCode})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send tracking notification for order ${orderId}`,
        error,
      );
    }
  }

  private buildTrackingMessage(
    trackingCode: string,
    trackingUrl: string | null,
    carrier?: string | null,
  ): string {
    const carrierLabel = getCarrierLabel(carrier as any);
    let message =
      `Seu pedido foi enviado! 📦\n\n` +
      `Transportadora: ${carrierLabel}\n` +
      `Código de rastreio: ${trackingCode}`;

    if (trackingUrl) {
      message += `\nAcompanhe aqui: ${trackingUrl}`;
    }

    return message;
  }
}
