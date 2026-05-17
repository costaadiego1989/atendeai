import { IEventBus } from '@shared/infrastructure/event-bus';
import { ProspectMessageReceivedHandler } from '../application/handlers/ProspectMessageReceivedHandler';
import { IRegisterProspectResponseUseCase } from '../application/use-cases/interfaces/IRegisterProspectResponseUseCase';
import { IRegisterProspectStopUseCase } from '../application/use-cases/interfaces/IRegisterProspectStopUseCase';
import { ProspectOptOutPolicy } from '../application/services/ProspectOptOutPolicy';

describe('ProspectMessageReceivedHandler', () => {
  let handler: ProspectMessageReceivedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let registerProspectResponseUseCase: jest.Mocked<IRegisterProspectResponseUseCase>;
  let registerProspectStopUseCase: jest.Mocked<IRegisterProspectStopUseCase>;
  let prospectOptOutPolicy: jest.Mocked<ProspectOptOutPolicy>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    registerProspectResponseUseCase = {
      execute: jest.fn(),
    };

    registerProspectStopUseCase = {
      execute: jest.fn(),
    };

    prospectOptOutPolicy = {
      shouldStop: jest.fn(),
    } as unknown as jest.Mocked<ProspectOptOutPolicy>;

    handler = new ProspectMessageReceivedHandler(
      eventBus,
      registerProspectResponseUseCase,
      registerProspectStopUseCase,
      prospectOptOutPolicy,
    );
  });

  it('should subscribe to messaging.message-received and register the response', async () => {
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
      { consumerName: 'prospecting-message-received' },
    );

    const payload = {
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      content: { text: 'Tenho interesse' },
    };
    prospectOptOutPolicy.shouldStop.mockReturnValue(false);

    await subscribedHandler!({ payload });

    expect(registerProspectResponseUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      messageText: 'Tenho interesse',
    });
    expect(registerProspectStopUseCase.execute).not.toHaveBeenCalled();
  });

  it('should stop the execution when opt-out is detected', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'messaging.message-received') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    const payload = {
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      content: { text: 'pare de me mandar mensagem' },
    };
    prospectOptOutPolicy.shouldStop.mockReturnValue(true);

    await subscribedHandler!({ payload });

    expect(registerProspectStopUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      messageText: 'pare de me mandar mensagem',
    });
    expect(registerProspectResponseUseCase.execute).not.toHaveBeenCalled();
  });
});
