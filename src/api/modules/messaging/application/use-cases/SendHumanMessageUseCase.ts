import { Inject, Injectable } from '@nestjs/common';
import {
    IConversationRepository,
    CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import { MESSAGE_QUEUE, IMessageQueue } from '../../domain/ports/IMessageQueue';
import { Message } from '../../domain/entities/Message';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import {
    ISendHumanMessageUseCase,
    SendHumanMessageInput,
    SendHumanMessageOutput,
} from './interfaces/ISendHumanMessageUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { FollowUpService } from '../services/FollowUpService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { MessageQueuedIntegrationEvent } from '../integration-events/publishers/MessageQueuedIntegrationEvent';
import { ConversationIntelligenceService } from '../services/ConversationIntelligenceService';

@Injectable()
export class SendHumanMessageUseCase implements ISendHumanMessageUseCase {
    constructor(
        @Inject(CONVERSATION_REPOSITORY)
        private readonly conversationRepository: IConversationRepository,
        @Inject(MESSAGE_QUEUE)
        private readonly messageQueue: IMessageQueue,
        private readonly followUpService: FollowUpService,
        @Inject(EVENT_BUS)
        private readonly eventBus: IEventBus,
        private readonly conversationIntelligenceService: ConversationIntelligenceService,
    ) { }

    async execute(input: SendHumanMessageInput): Promise<SendHumanMessageOutput> {
        const conversation = await this.conversationRepository.findById(
            input.conversationId,
        );
        if (!conversation) {
            throw new EntityNotFoundException('Conversation', input.conversationId);
        }

        const contentType = input.content.type.toUpperCase() as
            | 'TEXT'
            | 'IMAGE'
            | 'AUDIO'
            | 'VIDEO'
            | 'DOCUMENT';
        const content = MessageContent.create({
            type: contentType,
            ...(input.content.text ? { text: input.content.text } : {}),
            ...(input.content.url ? { url: input.content.url } : {}),
        });
        const signalText = this.toSignalText(content.toPersistence());

        const message = Message.create({
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            contentType,
            content,
            sentBy: 'HUMAN',
        });

        conversation.markAsPendingHuman();
        conversation.addMessage(message);
        await this.conversationRepository.save(conversation);
        await this.conversationIntelligenceService.captureMessageSignal({
            tenantId: input.tenantId,
            conversationId: conversation.id.toString(),
            direction: 'OUTBOUND',
            sentBy: 'HUMAN',
            text: signalText,
        });
        if (input.actorUserId) {
            await this.conversationRepository.setAssignedUser(
                input.tenantId,
                input.conversationId,
                input.actorUserId,
            );
        }
        await this.followUpService.cancelFollowUps(
            input.conversationId,
            'human-message-sent',
        );

        await this.messageQueue.addJob({
            messageId: message.id.toString(),
        });
        await this.eventBus.publish(
            new MessageQueuedIntegrationEvent({
                tenantId: input.tenantId,
                conversationId: conversation.id.toString(),
                contactId: conversation.contactId.toString(),
                messageId: message.id.toString(),
                channel: conversation.channel,
                queuedBy: 'HUMAN',
                content: {
                    type: contentType,
                    ...(input.content.text ? { text: input.content.text } : {}),
                    ...(input.content.url ? { url: input.content.url } : {}),
                },
            }),
        );

        return {
            id: message.id.toString(),
            status: 'QUEUED',
        };
    }

    private toSignalText(content: { type: string; text?: string; url?: string }) {
        if (content.type === 'TEXT') {
            return content.text || '';
        }

        const labels: Record<string, string> = {
            IMAGE: 'imagem',
            AUDIO: 'audio',
            VIDEO: 'video',
            DOCUMENT: 'documento',
        };
        const label = labels[content.type] || 'arquivo';
        const parts = [`Atendente enviou ${label} pelo WhatsApp.`];

        if (content.text) {
            parts.push(`Mensagem: ${content.text}`);
        }
        if (content.url) {
            parts.push(`Arquivo: ${content.url}`);
        }

        return parts.join('\n');
    }
}
