import { SalesIntegrationHandlers } from '../application/handlers/SalesIntegrationHandlers';
import { IEventBus } from '../../../shared/application/ports/IEventBus';
import { IMessagingFacade } from '../application/facades/MessagingFacade';

describe('SalesIntegrationHandlers contract', () => {
  it('should process serialized payload events without instanceof checks', async () => {
    let subscribedHandler: ((event: unknown) => Promise<void>) | undefined;
    const eventBus = {
      subscribe: jest.fn((_: string, handler: (event: unknown) => Promise<void>) => {
        subscribedHandler = handler;
      }),
    } as unknown as IEventBus;

    const messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as IMessagingFacade;

    const sut = new SalesIntegrationHandlers(eventBus, messagingFacade);
    sut.onModuleInit();

    expect(subscribedHandler).toBeDefined();
    await subscribedHandler?.({
      payload: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        contactName: 'Maria',
        value: 125.9,
        invoiceUrl: 'https://pay.test/invoice',
        branchId: 'branch-1',
      },
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        branchId: 'branch-1',
        channel: 'WHATSAPP',
      }),
    );
  });

  it('should ignore invalid payload contracts', async () => {
    let subscribedHandler: ((event: unknown) => Promise<void>) | undefined;
    const eventBus = {
      subscribe: jest.fn((_: string, handler: (event: unknown) => Promise<void>) => {
        subscribedHandler = handler;
      }),
    } as unknown as IEventBus;

    const messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as IMessagingFacade;

    const sut = new SalesIntegrationHandlers(eventBus, messagingFacade);
    sut.onModuleInit();

    await subscribedHandler?.({ payload: { tenantId: 'tenant-1' } });
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });
});
