import { AIEscalationRequestedHandler } from '@modules/messaging/application/handlers/AIEscalationRequestedHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { SendAIMessageUseCase } from '@modules/messaging/application/use-cases/SendAIMessageUseCase';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('AIEscalationRequestedHandler', () => {
  let handler: AIEscalationRequestedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let sendAIMessageUseCase: jest.Mocked<SendAIMessageUseCase>;
  let followUpService: jest.Mocked<FollowUpService>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    conversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByMessageId: jest.fn(),
      findByExternalMessageId: jest.fn(),
      findActiveByContact: jest.fn(),
      findLatestByContact: jest.fn(),
      findAllByTenant: jest.fn(),
      setAssignedUser: jest.fn(),
      findAssignedUsers: jest.fn(),
      findQueueState: jest.fn(),
      findMessagesByConversation: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;
    sendAIMessageUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendAIMessageUseCase>;
    followUpService = {
      cancelFollowUps: jest.fn(),
    } as unknown as jest.Mocked<FollowUpService>;

    handler = new AIEscalationRequestedHandler(
      eventBus,
      conversationRepository,
      sendAIMessageUseCase,
      followUpService,
    );
  });

  it('should ignore escalation when conversation does not exist', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.escalation-requested') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });
    conversationRepository.findById.mockResolvedValue(null);

    handler.onModuleInit();

    await subscribedHandler!({
      payload: {
        conversationId: 'conversation-1',
        escalationMessage: 'Vou transferir',
      },
    });

    expect(followUpService.cancelFollowUps).not.toHaveBeenCalled();
    expect(sendAIMessageUseCase.execute).not.toHaveBeenCalled();
    expect(conversationRepository.save).not.toHaveBeenCalled();
  });

  it('should mark conversation as pending human, cancel follow-ups and send escalation message', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.escalation-requested') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    const conversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-1'),
    );
    conversationRepository.findById.mockResolvedValue(conversation);

    handler.onModuleInit();

    await subscribedHandler!({
      payload: {
        conversationId: 'conversation-1',
        escalationMessage: 'Vou transferir para um especialista.',
      },
    });

    expect(conversation.status).toBe('PENDING_HUMAN');
    expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    expect(followUpService.cancelFollowUps).toHaveBeenCalledWith(
      'conversation-1',
      'human-handoff',
    );
    expect(sendAIMessageUseCase.execute).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      text: 'Vou transferir para um especialista.',
      type: 'TEXT',
    });
  });
});
