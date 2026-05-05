import { RecoveryMessageReceivedHandler } from '../application/handlers/RecoveryMessageReceivedHandler';
import { RegisterRecoveryReplyUseCase } from '../application/use-cases/RegisterRecoveryReplyUseCase';

describe('RecoveryMessageReceivedHandler', () => {
  it('should subscribe to messaging.message-received and forward the reply to the use case', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    const eventBus = {
      subscribe: jest.fn((queue, handler) => {
        if (queue === 'messaging.message-received') {
          subscribedHandler = handler;
        }
      }),
    };
    const registerRecoveryReplyUseCase = {
      execute: jest.fn(),
    } as unknown as RegisterRecoveryReplyUseCase;

    const sut = new RecoveryMessageReceivedHandler(
      eventBus as any,
      registerRecoveryReplyUseCase,
    );

    sut.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'messaging.message-received',
      expect.any(Function),
      { consumerName: 'recovery-message-received' },
    );

    await subscribedHandler?.({
      payload: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        content: { text: 'vou pagar hoje' },
      },
    });

    expect(registerRecoveryReplyUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageText: 'vou pagar hoje',
    });
  });
});
