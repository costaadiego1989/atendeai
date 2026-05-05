import { CommerceSessionAbandonedHandler } from '../application/handlers/CommerceSessionAbandonedHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';

describe('CommerceSessionAbandonedHandler', () => {
  let handler: CommerceSessionAbandonedHandler;
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

    handler = new CommerceSessionAbandonedHandler(
      eventBus,
      processAIResponseUseCase,
    );
  });

  function registerAndGetHandler() {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;

    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'commerce.session.abandoned') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'commerce.session.abandoned',
      expect.any(Function),
      { consumerName: 'ai-commerce-session-abandoned' },
    );

    return subscribedHandler!;
  }

  it('should subscribe to commerce.session.abandoned and forward a checkout recovery prompt', async () => {
    const subscribedHandler = registerAndGetHandler();

    await subscribedHandler({
      payload: {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        interval: '1h',
        subtotalAmount: 28,
        totalAmount: 36,
        currentStep: 'READY_FOR_CHECKOUT',
      },
    });

    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      content: {
        type: 'TEXT',
        text: expect.stringContaining('carrinho conversacional'),
      },
    });
    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('Intervalo da retomada: 1h'),
        }),
      }),
    );
    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('R$ 36.00'),
        }),
      }),
    );
    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('primeiro lembrete'),
        }),
      }),
    );
  });

  it('should tailor the recovery prompt for 1d', async () => {
    const subscribedHandler = registerAndGetHandler();

    await subscribedHandler({
      payload: {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        interval: '1d',
        subtotalAmount: 28,
        totalAmount: 36,
        currentStep: 'READY_FOR_CHECKOUT',
      },
    });

    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('depois de 1 dia'),
        }),
      }),
    );
  });

  it('should tailor the recovery prompt for 7d', async () => {
    const subscribedHandler = registerAndGetHandler();

    await subscribedHandler({
      payload: {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        interval: '7d',
        subtotalAmount: 28,
        totalAmount: 36,
        currentStep: 'READY_FOR_CHECKOUT',
      },
    });

    expect(processAIResponseUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          text: expect.stringContaining('depois de 7 dias'),
        }),
      }),
    );
  });

  it('should ignore abandoned sessions without conversation or contact context', async () => {
    const subscribedHandler = registerAndGetHandler();

    await subscribedHandler({
      payload: {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        interval: '1h',
      },
    });

    expect(processAIResponseUseCase.execute).not.toHaveBeenCalled();
  });
});
