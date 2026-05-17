import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  IUpdateConversationStatusUseCase,
  UpdateConversationStatusInput,
  UpdateConversationStatusOutput,
} from './interfaces/IUpdateConversationStatusUseCase';
import {
  EntityNotFoundException,
  UnauthorizedException,
} from '@shared/domain/exceptions/DomainExceptions';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { ConversationStatusChangedIntegrationEvent } from '../integration-events/publishers/ConversationStatusChangedIntegrationEvent';
import { ConversationPendingHumanIntegrationEvent } from '../integration-events/publishers/ConversationPendingHumanIntegrationEvent';

@Injectable()
export class UpdateConversationStatusUseCase implements IUpdateConversationStatusUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(
    input: UpdateConversationStatusInput,
  ): Promise<UpdateConversationStatusOutput> {
    const conversation = await this.conversationRepository.findById(
      input.conversationId,
    );

    if (!conversation) {
      throw new EntityNotFoundException('Conversation', input.conversationId);
    }

    if (conversation.tenantId.toString() !== input.tenantId) {
      throw new UnauthorizedException(
        'Conversation does not belong to this tenant',
      );
    }

    if (input.status === 'ACTIVE') {
      conversation.activate();
    }

    if (input.status === 'PENDING_HUMAN') {
      conversation.markAsPendingHuman();
    }

    if (input.status === 'ARCHIVED') {
      conversation.archive();
    }

    await this.conversationRepository.save(conversation);
    if (input.status === 'PENDING_HUMAN') {
      await this.conversationRepository.setAssignedUser(
        input.tenantId,
        input.conversationId,
        input.actorUserId ?? null,
      );
    }

    if (input.status === 'ACTIVE') {
      await this.conversationRepository.setAssignedUser(
        input.tenantId,
        input.conversationId,
        null,
      );
    }

    if (input.status === 'ARCHIVED') {
      await this.conversationRepository.setAssignedUser(
        input.tenantId,
        input.conversationId,
        null,
      );
    }

    await this.eventBus.publish(
      new ConversationStatusChangedIntegrationEvent({
        tenantId: conversation.tenantId.toString(),
        conversationId: conversation.id.toString(),
        contactId: conversation.contactId.toString(),
        channel: conversation.channel,
        status: conversation.status,
      }),
    );

    if (input.status === 'PENDING_HUMAN') {
      await this.eventBus.publish(
        new ConversationPendingHumanIntegrationEvent({
          tenantId: conversation.tenantId.toString(),
          conversationId: conversation.id.toString(),
          contactId: conversation.contactId.toString(),
          channel: conversation.channel,
        }),
      );
    }

    return {
      id: conversation.id.toString(),
      status: conversation.status,
    };
  }
}
