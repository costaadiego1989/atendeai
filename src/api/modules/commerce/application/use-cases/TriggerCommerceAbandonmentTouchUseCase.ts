import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { OrderNotFoundError } from '../../domain/errors/OrderNotFoundError';
import { CommerceSessionAbandonedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface TriggerCommerceAbandonmentTouchCommand {
  tenantId: string;
  orderId: string;
  interval?: string;
  userId?: string;
  userName?: string;
}

@Injectable()
export class TriggerCommerceAbandonmentTouchUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: TriggerCommerceAbandonmentTouchCommand) {
    const order = await this.commerceRepository.findOrderById(
      command.tenantId,
      command.orderId,
    );

    if (!order) {
      throw new OrderNotFoundError(command.orderId);
    }

    const session = await this.commerceRepository.findSessionById(
      command.tenantId,
      order.sessionId,
    );

    if (!session) {
      throw new OrderNotFoundError(command.orderId);
    }

    const interval = command.interval?.trim() || 'manual';

    await this.eventBus.publish(
      new CommerceSessionAbandonedIntegrationEvent({
        sessionId: session.id,
        tenantId: session.tenantId,
        conversationId: session.conversationId,
        contactId: session.contactId,
        interval,
        subtotalAmount: session.subtotalAmount,
        totalAmount: session.totalAmount,
        currentStep: session.currentStep,
      }),
    );

    await this.commerceRepository.saveAuditLog({
      tenantId: command.tenantId,
      userId: command.userId,
      userName: command.userName,
      event: 'SESSION_ABANDONMENT_TRIGGERED',
      entityId: session.id,
      entityType: 'SESSION',
      metadata: {
        interval,
        subtotalAmount: session.subtotalAmount,
        totalAmount: session.totalAmount,
        currentStep: session.currentStep,
        orderId: order.id,
        manual: true,
      },
    });

    return {
      order,
      session,
      interval,
    };
  }
}
