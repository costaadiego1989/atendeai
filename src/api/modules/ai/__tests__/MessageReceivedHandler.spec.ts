import { MessageReceivedHandler } from '../application/handlers/MessageReceivedHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';

describe('MessageReceivedHandler', () => {
  let handler: MessageReceivedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let processAIResponseUseCase: jest.Mocked<IProcessAIResponseUseCase>;
  let followUpService: jest.Mocked<FollowUpService>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    processAIResponseUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<IProcessAIResponseUseCase>;

    followUpService = {
      cancelFollowUps: jest.fn(),
    } as unknown as jest.Mocked<FollowUpService>;

    handler = new MessageReceivedHandler(
      eventBus,
      processAIResponseUseCase,
      followUpService,
    );
  });

  it('should subscribe to messaging.message-received and process payload after cancelling follow-ups', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'messaging.message-received') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'messaging.message-received',
      expect.any(Function),
      { consumerName: 'ai-message-received' },
    );

    const payload = {
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Oi' },
    };

    await subscribedHandler!({ payload });

    expect(followUpService.cancelFollowUps).toHaveBeenCalledWith('conversation-1');
    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(payload);
  });
});
