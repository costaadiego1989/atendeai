import { Inject, Injectable } from '@nestjs/common';
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
import {
  OrderStatus,
  InvalidOrderTransitionError,
} from '../../domain/value-objects/OrderStatus';

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

    if (order.status === command.status) {
      return order;
    }

    const currentStatus = OrderStatus.create(order.status);
    currentStatus.transitionTo(command.status, command.orderId);

    const updatedOrder = await this.commerceRepository.updateOrderStatus({
      tenantId: command.tenantId,
      orderId: command.orderId,
      status: command.status,
    });

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
}
