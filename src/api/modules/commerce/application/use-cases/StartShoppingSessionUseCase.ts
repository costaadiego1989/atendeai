import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceSessionStartedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface StartShoppingSessionInput {
  tenantId: string;
  branchId?: string | null;
  conversationId: string;
  contactId?: string | null;
}

@Injectable()
export class StartShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: StartShoppingSessionInput) {
    const existing =
      await this.commerceRepository.findActiveSessionByConversation(
        input.tenantId,
        input.conversationId,
      );

    if (existing) {
      return existing;
    }

    const session = await this.commerceRepository.createSession(input);

    await this.eventBus.publish(
      new CommerceSessionStartedIntegrationEvent({
        sessionId: session.id,
        tenantId: session.tenantId,
        conversationId: session.conversationId,
        contactId: session.contactId,
      }),
    );

    return session;
  }
}
