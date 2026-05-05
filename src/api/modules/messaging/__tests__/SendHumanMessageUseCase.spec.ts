import { SendHumanMessageUseCase } from '../application/use-cases/SendHumanMessageUseCase';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { IMessageQueue } from '@modules/messaging/domain/ports/IMessageQueue';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TenantId } from '@shared/domain/TenantId';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { MessageQueuedIntegrationEvent } from '../application/integration-events/publishers/MessageQueuedIntegrationEvent';

describe('SendHumanMessageUseCase', () => {
    let sut: SendHumanMessageUseCase;
    let conversationRepository: jest.Mocked<IConversationRepository>;
    let messageQueue: jest.Mocked<IMessageQueue>;
    let followUpService: any;
    let eventBus: jest.Mocked<IEventBus>;
    let conversationIntelligenceService: { captureMessageSignal: jest.Mock };

    beforeEach(() => {
        conversationRepository = {
            findById: jest.fn(),
            save: jest.fn(),
        } as any;
        messageQueue = {
            addJob: jest.fn(),
        } as any;
        followUpService = {
            cancelFollowUps: jest.fn(),
        };
        eventBus = {
            publish: jest.fn(),
            subscribe: jest.fn(),
        } as any;
        conversationIntelligenceService = {
            captureMessageSignal: jest.fn(),
        };
        sut = new SendHumanMessageUseCase(
            conversationRepository,
            messageQueue,
            followUpService,
            eventBus,
            conversationIntelligenceService as any,
        );
    });

    it('should create a HUMAN message, save it as PENDING and queue it', async () => {
        const conversationId = new UniqueEntityID().toString();
        const conversation = Conversation.create({
            tenantId: TenantId.create(new UniqueEntityID().toString()),
            contactId: new UniqueEntityID(),
            channel: 'WHATSAPP',
        }, new UniqueEntityID(conversationId));

        conversationRepository.findById.mockResolvedValue(conversation);

        const output = await sut.execute({
            tenantId: 'tenant-1',
            conversationId,
            content: { type: 'TEXT', text: 'Hello from Human' }
        });

        expect(conversationRepository.save).toHaveBeenCalled();
        expect(conversationIntelligenceService.captureMessageSignal).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            conversationId,
            direction: 'OUTBOUND',
            sentBy: 'HUMAN',
            text: 'Hello from Human',
        });
        expect(followUpService.cancelFollowUps).toHaveBeenCalledWith(
            conversationId,
            'human-message-sent',
        );
        expect(messageQueue.addJob).toHaveBeenCalled();
        expect(eventBus.publish).toHaveBeenCalledWith(
            expect.any(MessageQueuedIntegrationEvent),
        );
        const queuedEvent = (eventBus.publish as jest.Mock).mock.calls[0][0] as MessageQueuedIntegrationEvent;
        expect(queuedEvent.payload).toEqual({
            tenantId: 'tenant-1',
            conversationId,
            contactId: conversation.contactId.toString(),
            messageId: conversation.messages[0].id.toString(),
            channel: 'WHATSAPP',
            queuedBy: 'HUMAN',
            content: {
                type: 'TEXT',
                text: 'Hello from Human',
            },
        });
        expect(conversation.messages[0].sentBy).toBe('HUMAN');
        expect(conversation.messages[0].deliveryStatus).toBe('PENDING');
        expect(output).toEqual({
            id: conversation.messages[0].id.toString(),
            status: 'QUEUED',
        });
    });
});
