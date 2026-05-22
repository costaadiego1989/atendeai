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

  it('should subscribe to ai.response-failed and persist fallback message via sendAIMessageUseCase', async () => {
    let failedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.response-failed') {
        failedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'ai.response-failed',
      expect.any(Function),
      { consumerName: 'messaging-ai-response-failed' },
    );

    await failedHandler!({
      payload: {
        conversationId: 'conversation-2',
        fallbackMessage: 'Estou em configuração. Tente novamente em breve.',
      },
    });

    expect(sendAIMessageUseCase.execute).toHaveBeenCalledWith({
      conversationId: 'conversation-2',
      text: 'Estou em configuração. Tente novamente em breve.',
      type: 'TEXT',
    });
    expect(followUpService.scheduleFollowUps).not.toHaveBeenCalled();
  });

  it('should not call sendAIMessageUseCase when ai.response-failed has no fallbackMessage', async () => {
    let failedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.response-failed') {
        failedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    await failedHandler!({ payload: { conversationId: 'conversation-3' } });

    expect(sendAIMessageUseCase.execute).not.toHaveBeenCalled();
  });

  it('should not call sendAIMessageUseCase when ai.response-failed has no conversationId', async () => {
    let failedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.response-failed') {
        failedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    await failedHandler!({ payload: { fallbackMessage: 'some message' } });

    expect(sendAIMessageUseCase.execute).not.toHaveBeenCalled();
  });
});
