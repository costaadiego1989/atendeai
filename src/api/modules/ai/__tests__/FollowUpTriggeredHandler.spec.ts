import { FollowUpTriggeredHandler } from '../application/handlers/FollowUpTriggeredHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';

describe('FollowUpTriggeredHandler', () => {
  let handler: FollowUpTriggeredHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let processAIResponseUseCase: jest.Mocked<IProcessAIResponseUseCase>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    processAIResponseUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<IProcessAIResponseUseCase>;

    handler = new FollowUpTriggeredHandler(eventBus, processAIResponseUseCase);
  });

  it('should subscribe to messaging.follow-up-triggered and forward a system follow-up prompt', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'messaging.follow-up-triggered') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'messaging.follow-up-triggered',
      expect.any(Function),
      { consumerName: 'ai-follow-up-triggered' },
    );

    await subscribedHandler!({
      payload: {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        interval: '12h',
        intelligence: {
          summary: 'Cliente: Quero comprar cafe',
          sentiment: 'POSITIVE',
          tags: ['venda'],
          interests: ['produto'],
          nextStep: 'Enviar opcoes e confirmar checkout.',
          lossReason: null,
        },
      },
    });

    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      content: {
        type: 'TEXT',
        text: expect.stringContaining('Follow-up de 12h'),
      },
    });
    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('Cliente: Quero comprar cafe'),
        }),
      }),
    );
  });
});
