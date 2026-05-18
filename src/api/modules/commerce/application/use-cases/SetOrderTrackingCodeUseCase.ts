import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
  CommerceOrderRecord,
  CommerceOrderStatus,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { OrderNotFoundError } from '../../domain/errors/OrderNotFoundError';
import { CommerceOrderTrackingSetIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface SetOrderTrackingCodeCommand {
  tenantId: string;
  orderId: string;
  trackingCode: string;
  trackingUrl?: string;
  userId?: string;
  userName?: string;
}

const ALLOWED_STATUSES_FOR_TRACKING: CommerceOrderStatus[] = [
  'PAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

@Injectable()
export class SetOrderTrackingCodeUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: SetOrderTrackingCodeCommand): Promise<CommerceOrderRecord> {
    const order = await this.commerceRepository.findOrderById(
      command.tenantId,
      command.orderId,
    );

    if (!order) {
      throw new OrderNotFoundError(command.orderId);
    }

    if (!ALLOWED_STATUSES_FOR_TRACKING.includes(order.status)) {
      throw new ConflictException(
        `Cannot set tracking code for order with status ${order.status}`,
      );
    }

    const updatedOrder = await this.commerceRepository.updateOrderTracking({
      tenantId: command.tenantId,
      orderId: command.orderId,
      trackingCode: command.trackingCode,
      trackingUrl: command.trackingUrl,
    });

    await this.commerceRepository.saveAuditLog({
      tenantId: command.tenantId,
      userId: command.userId,
      userName: command.userName,
      event: 'ORDER_TRACKING_SET',
      entityId: command.orderId,
      entityType: 'ORDER',
      metadata: {
        trackingCode: command.trackingCode,
        trackingUrl: command.trackingUrl ?? null,
      },
    });

    await this.eventBus.publish(
      new CommerceOrderTrackingSetIntegrationEvent({
        orderId: order.id,
        tenantId: order.tenantId,
        contactId: order.contactId,
        trackingCode: command.trackingCode,
        trackingUrl: command.trackingUrl ?? null,
      }),
    );

    return updatedOrder;
  }
}
