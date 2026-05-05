import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { OrderNotFoundError } from '../../domain/errors/OrderNotFoundError';

export interface UpdateCommerceAbandonmentStateCommand {
  tenantId: string;
  orderId: string;
  paused: boolean;
  userId?: string;
  userName?: string;
}

@Injectable()
export class UpdateCommerceAbandonmentStateUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(command: UpdateCommerceAbandonmentStateCommand) {
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

    const updatedSession = await this.commerceRepository.updateSessionState({
      tenantId: command.tenantId,
      sessionId: session.id,
      abandonmentPaused: command.paused,
      abandonmentPausedAt: command.paused ? new Date() : null,
    });

    await this.commerceRepository.saveAuditLog({
      tenantId: command.tenantId,
      userId: command.userId,
      userName: command.userName,
      event: command.paused
        ? 'SESSION_ABANDONMENT_PAUSED'
        : 'SESSION_ABANDONMENT_RESUMED',
      entityId: session.id,
      entityType: 'SESSION',
      metadata: {
        orderId: order.id,
      },
    });

    return {
      order,
      session: updatedSession,
    };
  }
}
