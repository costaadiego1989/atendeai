import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
  CommerceOrderStatus,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { OrderNotFoundError } from '../../domain/errors/OrderNotFoundError';
import {
  CommerceOrderCancelledIntegrationEvent,
  CommerceOrderDeliveredIntegrationEvent,
  CommerceOrderPreparingIntegrationEvent,
  CommerceOrderReadyForPickupIntegrationEvent,
  CommerceOrderShippedIntegrationEvent,
} from '../integration-events/CheckoutIntegrationEvents';

export interface UpdateCommerceOrderStatusCommand {
  tenantId: string;
  orderId: string;
  status: CommerceOrderStatus;
  userId?: string;
  userName?: string;
}

@Injectable()
export class UpdateCommerceOrderStatusUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: UpdateCommerceOrderStatusCommand) {
    const order = await this.commerceRepository.findOrderById(
      command.tenantId,
      command.orderId,
    );

    if (!order) {
      throw new OrderNotFoundError(command.orderId);
    }

    // Business Logic: Only update if status is different
    if (order.status === command.status) {
      return order;
    }

    this.assertValidTransition(order.status, command.status);

    const updatedOrder = await this.commerceRepository.updateOrderStatus({
      tenantId: command.tenantId,
      orderId: command.orderId,
      status: command.status,
    });

    // Save Audit Log
    await this.commerceRepository.saveAuditLog({
      tenantId: command.tenantId,
      userId: command.userId,
      userName: command.userName,
      event: 'ORDER_STATUS_CHANGED',
      entityId: command.orderId,
      entityType: 'ORDER',
      metadata: {
        previousStatus: order.status,
        newStatus: command.status,
      },
    });

    if (command.status === 'PREPARING') {
      await this.eventBus.publish(
        new CommerceOrderPreparingIntegrationEvent({
          orderId: order.id,
          tenantId: order.tenantId,
        }),
      );
    } else if (command.status === 'READY_FOR_PICKUP') {
      await this.eventBus.publish(
        new CommerceOrderReadyForPickupIntegrationEvent({
          orderId: order.id,
          tenantId: order.tenantId,
        }),
      );
    } else if (command.status === 'OUT_FOR_DELIVERY') {
      await this.eventBus.publish(
        new CommerceOrderShippedIntegrationEvent({
          orderId: order.id,
          tenantId: order.tenantId,
        }),
      );
    } else if (command.status === 'DELIVERED') {
      await this.eventBus.publish(
        new CommerceOrderDeliveredIntegrationEvent({
          orderId: order.id,
          tenantId: order.tenantId,
        }),
      );
    } else if (command.status === 'CANCELLED') {
      await this.eventBus.publish(
        new CommerceOrderCancelledIntegrationEvent({
          orderId: order.id,
          tenantId: order.tenantId,
        }),
      );
    }

    return updatedOrder;
  }

  private assertValidTransition(
    currentStatus: CommerceOrderStatus,
    nextStatus: CommerceOrderStatus,
  ) {
    const transitions: Record<CommerceOrderStatus, CommerceOrderStatus[]> = {
      AWAITING_PAYMENT: ['CANCELLED'],
      PAID: [
        'PREPARING',
        'READY_FOR_PICKUP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      PREPARING: [
        'READY_FOR_PICKUP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!transitions[currentStatus].includes(nextStatus)) {
      throw new ConflictException(
        `Cannot change order status from ${currentStatus} to ${nextStatus}`,
      );
    }
  }
}
