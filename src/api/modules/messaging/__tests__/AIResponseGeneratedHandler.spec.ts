import { AIResponseGeneratedHandler } from '@modules/messaging/application/handlers/AIResponseGeneratedHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { SendAIMessageUseCase } from '@modules/messaging/application/use-cases/SendAIMessageUseCase';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';

describe('AIResponseGeneratedHandler', () => {
  let handler: AIResponseGeneratedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let sendAIMessageUseCase: jest.Mocked<SendAIMessageUseCase>;
  let followUpService: jest.Mocked<FollowUpService>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    sendAIMessageUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendAIMessageUseCase>;
    followUpService = {
      scheduleFollowUps: jest.fn(),
    } as unknown as jest.Mocked<FollowUpService>;

    handler = new AIResponseGeneratedHandler(
      eventBus,
      sendAIMessageUseCase,
      followUpService,
    );
  });

  it('should subscribe to ai.response-generated and send AI message plus follow-ups', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.response-generated') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'ai.response-generated',
      expect.any(Function),
      { consumerName: 'messaging-ai-response-generated' },
    );

    await subscribedHandler!({
      payload: {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        response: { type: 'TEXT', text: 'Resposta da IA' },
      },
    });

    expect(sendAIMessageUseCase.execute).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      text: 'Resposta da IA',
      type: 'TEXT',
    });
    expect(followUpService.scheduleFollowUps).toHaveBeenCalledWith(
      'conversation-1',
      'tenant-1',
      'contact-1',
    );
  });
});
