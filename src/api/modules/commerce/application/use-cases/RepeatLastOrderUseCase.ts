import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceSessionRecord,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceSessionStartedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface RepeatLastOrderCommand {
  tenantId: string;
  contactId: string;
  conversationId: string;
  branchId?: string | null;
}

export interface RepeatLastOrderResult {
  session: CommerceSessionRecord;
  previousOrderId: string;
  itemsCopied: number;
}

@Injectable()
export class RepeatLastOrderUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: RepeatLastOrderCommand): Promise<RepeatLastOrderResult> {
    const lastOrder = await this.findLastCompletedOrder(
      input.tenantId,
      input.contactId,
    );

    const oldSession = await this.commerceRepository.findSessionById(
      input.tenantId,
      lastOrder.sessionId,
    );

    if (!oldSession || oldSession.items.length === 0) {
      throw new NotFoundException(
        'Não encontrei itens no seu pedido anterior para repetir.',
      );
    }

    const { session, isNew } = await this.getOrCreateSession(input);

    for (const item of oldSession.items) {
      await this.commerceRepository.addSessionItem({
        sessionId: session.id,
        tenantId: input.tenantId,
        source: item.source,
        inventoryItemId: item.inventoryItemId,
        catalogItemId: item.catalogItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice ?? 0),
        currency: item.currency,
      });
    }

    const subtotalAmount = oldSession.items.reduce(
      (total, item) => total + Number(item.lineTotal),
      0,
    );

    const updatedSession = await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      currentStep: 'ASKING_MORE_ITEMS',
      subtotalAmount,
      totalAmount: subtotalAmount,
    });

    if (isNew) {
      await this.eventBus.publish(
        new CommerceSessionStartedIntegrationEvent({
          sessionId: session.id,
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          contactId: input.contactId,
        }),
      );
    }

    return {
      session: updatedSession,
      previousOrderId: lastOrder.id,
      itemsCopied: oldSession.items.length,
    };
  }

  private async findLastCompletedOrder(tenantId: string, contactId: string) {
    const orders = await this.commerceRepository.findOrdersByContact(
      tenantId,
      contactId,
      10,
    );

    const completedOrder = orders.find(
      (order) => order.status === 'PAID' || order.status === 'DELIVERED',
    );

    if (!completedOrder) {
      throw new NotFoundException(
        'Não encontrei pedidos anteriores para repetir.',
      );
    }

    return completedOrder;
  }

  private async getOrCreateSession(
    input: RepeatLastOrderCommand,
  ): Promise<{ session: CommerceSessionRecord; isNew: boolean }> {
    const existing =
      await this.commerceRepository.findActiveSessionByConversation(
        input.tenantId,
        input.conversationId,
      );

    if (existing) {
      return { session: existing, isNew: false };
    }

    const session = await this.commerceRepository.createSession({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      conversationId: input.conversationId,
      contactId: input.contactId,
    });

    return { session, isNew: true };
  }
}
