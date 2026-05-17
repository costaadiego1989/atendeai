import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import { MESSAGE_QUEUE, IMessageQueue } from '../../domain/ports/IMessageQueue';
import { Message } from '../../domain/entities/Message';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ConversationIntelligenceService } from '../services/ConversationIntelligenceService';

export interface SendAIMessageInput {
  conversationId: string;
  text: string;
  type: string;
}

@Injectable()
export class SendAIMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(MESSAGE_QUEUE)
    private readonly messageQueue: IMessageQueue,
    private readonly conversationIntelligenceService: ConversationIntelligenceService,
  ) {}

  async execute(input: SendAIMessageInput): Promise<void> {
    const conversation = await this.conversationRepository.findById(
      input.conversationId,
    );
    if (!conversation) {
      throw new EntityNotFoundException('Conversation', input.conversationId);
    }

    const message = Message.create({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      contentType: input.type,
      content: MessageContent.createText(input.text),
      sentBy: 'AI',
    });

    conversation.addMessage(message);
    await this.conversationRepository.save(conversation);
    await this.conversationIntelligenceService.captureMessageSignal({
      tenantId: conversation.tenantId.toString(),
      conversationId: conversation.id.toString(),
      direction: 'OUTBOUND',
      sentBy: 'AI',
      text: input.text,
    });

    await this.messageQueue.addJob({
      messageId: message.id.toString(),
    });
  }
}
