import { SendAIMessageUseCase, SendAIMessageInput } from '@modules/messaging/application/use-cases/SendAIMessageUseCase';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { IMessageQueue } from '@modules/messaging/domain/ports/IMessageQueue';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TenantId } from '@shared/domain/TenantId';

describe('SendAIMessageUseCase', () => {
    let sut: SendAIMessageUseCase;
    let conversationRepository: jest.Mocked<IConversationRepository>;
    let messageQueue: jest.Mocked<IMessageQueue>;
    let conversationIntelligenceService: { captureMessageSignal: jest.Mock };

    beforeEach(() => {
        conversationRepository = {
            findById: jest.fn(),
            save: jest.fn(),
        } as any;
        messageQueue = {
            addJob: jest.fn(),
        } as any;
        conversationIntelligenceService = {
            captureMessageSignal: jest.fn(),
        };
        sut = new SendAIMessageUseCase(
            conversationRepository,
            messageQueue,
            conversationIntelligenceService as any,
        );
    });

    it('should create a message, save the conversation and add a job to the queue', async () => {
        const conversationId = new UniqueEntityID().toString();
        const conversation = Conversation.create({
            tenantId: TenantId.create(new UniqueEntityID().toString()),
            contactId: new UniqueEntityID(),
            channel: 'WHATSAPP',
        }, new UniqueEntityID(conversationId));

        conversationRepository.findById.mockResolvedValue(conversation);

        const input: SendAIMessageInput = {
            conversationId,
            text: 'Hello from AI',
            type: 'text',
        };

        await sut.execute(input);

        expect(conversationRepository.save).toHaveBeenCalled();
        expect(conversationIntelligenceService.captureMessageSignal).toHaveBeenCalledWith({
            tenantId: conversation.tenantId.toString(),
            conversationId,
            direction: 'OUTBOUND',
            sentBy: 'AI',
            text: 'Hello from AI',
        });
        expect(messageQueue.addJob).toHaveBeenCalledWith(
            expect.objectContaining({
                messageId: expect.any(String),
            })
        );
        expect(conversation.messages).toHaveLength(1);
        expect(conversation.messages[0].sentBy).toBe('AI');
        expect(conversation.messages[0].deliveryStatus).toBe('PENDING');
    });
});
