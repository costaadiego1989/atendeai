import { ProcessOutboundMessageUseCase } from '../application/use-cases/ProcessOutboundMessageUseCase';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';
import { IMessagingGateway } from '../domain/ports/IMessagingGateway';
import { IMessagingGatewayRegistry } from '../domain/ports/IMessagingGatewayRegistry';
import { ITenantFacade } from '../../../modules/tenant/application/facades/ITenantFacade';
import { Conversation } from '../domain/entities/Conversation';
import { Message } from '../../../modules/messaging/domain/entities/Message';
import { MessageContent } from '../../../modules/messaging/domain/value-objects/MessageContent';
import { UniqueEntityID } from '../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../shared/domain/TenantId';
import { IContactFacade } from '../../../modules/contact/application/facades/ContactFacade';
import {
  MessageFailedIntegrationEvent,
  MessageSentIntegrationEvent,
} from '../../../modules/messaging/application/integration-events/publishers/MessageSentIntegrationEvent';

describe('ProcessOutboundMessageUseCase', () => {
  let sut: ProcessOutboundMessageUseCase;
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let messagingGateway: jest.Mocked<IMessagingGateway>;
  let messagingGatewayRegistry: jest.Mocked<IMessagingGatewayRegistry>;
  let tenantFacade: jest.Mocked<ITenantFacade>;
  let eventBus: { publish: jest.Mock };
  let structuredLog: { emit: jest.Mock };
  let retryService: { sendWithRetry: jest.Mock };

  beforeEach(() => {
    conversationRepository = {
      findByMessageId: jest.fn(),
      save: jest.fn(),
    } as any;
    contactFacade = {
      getContactById: jest.fn(),
    } as any;
    messagingGateway = {
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      sendMessage: jest.fn(),
    } as any;
    messagingGatewayRegistry = {
      resolve: jest.fn(),
    } as any;
    tenantFacade = {
      getChannelConfig: jest.fn(),
    } as any;
    eventBus = {
      publish: jest.fn(),
    };
    structuredLog = { emit: jest.fn() };
    retryService = { sendWithRetry: jest.fn() };
    sut = new ProcessOutboundMessageUseCase(
      conversationRepository,
      contactFacade,
      messagingGatewayRegistry,
      tenantFacade,
      eventBus as any,
      structuredLog as any,
      retryService as any,
      { send: jest.fn() } as any,
    );
  });

  it('should send the message and update status to SENT on success', async () => {
    const messageId = new UniqueEntityID();
    const conversation = Conversation.create({
      tenantId: TenantId.create(new UniqueEntityID().toString()),
      contactId: new UniqueEntityID(),
      channel: 'WHATSAPP',
    });
    const message = Message.create(
      {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'text',
        content: MessageContent.createText('Hello'),
        sentBy: 'AI',
      },
      messageId,
    );
    conversation.addMessage(message);

    conversationRepository.findByMessageId.mockResolvedValue(conversation);
    contactFacade.getContactById.mockResolvedValue({
      phone: '5521993001883',
    } as any);
    messagingGatewayRegistry.resolve.mockReturnValue(messagingGateway);
    tenantFacade.getChannelConfig.mockResolvedValue({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      externalAccountId: '123',
      status: 'ACTIVE',
    });
    messagingGateway.sendMessage.mockResolvedValue({
      success: true,
      messageId: 'ext-123',
    });
    retryService.sendWithRetry.mockResolvedValue({
      success: true,
      messageId: 'ext-123',
      attempts: 1,
      exhaustedRetries: false,
    });

    await sut.execute({ messageId: messageId.toString() });

    expect(retryService.sendWithRetry).toHaveBeenCalledWith(
      messagingGateway,
      expect.objectContaining({
        provider: 'BUBBLEWHATS',
        credentials: expect.objectContaining({
          token: 'tenant-token',
        }),
      }),
      '5521993001883',
      expect.any(Object),
      expect.objectContaining({
        messageId: messageId.toString(),
      }),
    );
    expect(message.deliveryStatus).toBe('SENT');
    expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const publishedEvent = eventBus.publish.mock.calls[0][0];
    expect(publishedEvent).toBeInstanceOf(MessageSentIntegrationEvent);
    expect(publishedEvent.eventId).toBe(
      `messaging:sent:${messageId.toString()}`,
    );
    expect(publishedEvent.payload).toEqual({
      tenantId: conversation.tenantId.toString(),
      conversationId: conversation.id.toString(),
      contactId: conversation.contactId.toString(),
      messageId: messageId.toString(),
      channel: 'WHATSAPP',
      content: {
        type: 'text',
        text: 'Hello',
      },
    });
  });

  it('should throw error on gateway failure to trigger retry', async () => {
    const messageId = new UniqueEntityID();
    const conversation = Conversation.create({
      tenantId: TenantId.create(new UniqueEntityID().toString()),
      contactId: new UniqueEntityID(),
      channel: 'WHATSAPP',
    });
    const message = Message.create(
      {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'text',
        content: MessageContent.createText('Hello'),
        sentBy: 'AI',
      },
      messageId,
    );
    conversation.addMessage(message);

    conversationRepository.findByMessageId.mockResolvedValue(conversation);
    contactFacade.getContactById.mockResolvedValue({
      phone: '5521993001883',
    } as any);
    messagingGatewayRegistry.resolve.mockReturnValue(messagingGateway);
    tenantFacade.getChannelConfig.mockResolvedValue({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      externalAccountId: '123',
      status: 'ACTIVE',
    });
    messagingGateway.sendMessage.mockResolvedValue({
      success: false,
      error: 'API Down',
    });
    retryService.sendWithRetry.mockResolvedValue({
      success: false,
      error: 'API Down',
      attempts: 1,
      exhaustedRetries: false,
    });

    await expect(
      sut.execute({ messageId: messageId.toString() }),
    ).rejects.toThrow('Failed to send message after 1 attempt(s): API Down');

    expect(message.deliveryStatus).toBe('FAILED');
    expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should mark instagram messages as failed when the tenant has no instagram configuration yet', async () => {
    const messageId = new UniqueEntityID();
    const conversation = Conversation.create({
      tenantId: TenantId.create(new UniqueEntityID().toString()),
      contactId: new UniqueEntityID(),
      channel: 'INSTAGRAM',
    });
    const message = Message.create(
      {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'text',
        content: MessageContent.createText('Hello on Instagram'),
        sentBy: 'AI',
      },
      messageId,
    );
    conversation.addMessage(message);

    conversationRepository.findByMessageId.mockResolvedValue(conversation);
    messagingGatewayRegistry.resolve.mockReturnValue(null);
    tenantFacade.getChannelConfig.mockResolvedValue(null);

    await sut.execute({ messageId: messageId.toString() });

    expect(message.deliveryStatus).toBe('FAILED');
    expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    expect(messagingGateway.sendMessage).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const publishedEvent = eventBus.publish.mock.calls[0][0];
    expect(publishedEvent).toBeInstanceOf(MessageFailedIntegrationEvent);
    expect(publishedEvent.payload).toEqual({
      tenantId: conversation.tenantId.toString(),
      conversationId: conversation.id.toString(),
      contactId: conversation.contactId.toString(),
      messageId: messageId.toString(),
      channel: 'INSTAGRAM',
      reason: 'CHANNEL_NOT_CONFIGURED',
      content: {
        type: 'text',
        text: 'Hello on Instagram',
      },
    });
  });

  it('should mark the message as failed when the contact phone is missing', async () => {
    const messageId = new UniqueEntityID();
    const conversation = Conversation.create({
      tenantId: TenantId.create(new UniqueEntityID().toString()),
      contactId: new UniqueEntityID(),
      channel: 'WHATSAPP',
    });
    const message = Message.create(
      {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'text',
        content: MessageContent.createText('Hello'),
        sentBy: 'AI',
      },
      messageId,
    );
    conversation.addMessage(message);

    conversationRepository.findByMessageId.mockResolvedValue(conversation);
    contactFacade.getContactById.mockResolvedValue(null);
    messagingGatewayRegistry.resolve.mockReturnValue(messagingGateway);
    tenantFacade.getChannelConfig.mockResolvedValue({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      externalAccountId: '123',
      status: 'ACTIVE',
    });

    await sut.execute({ messageId: messageId.toString() });

    expect(message.deliveryStatus).toBe('FAILED');
    expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    expect(messagingGateway.sendMessage).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const publishedEvent = eventBus.publish.mock.calls[0][0];
    expect(publishedEvent).toBeInstanceOf(MessageFailedIntegrationEvent);
    expect(publishedEvent.payload).toEqual({
      tenantId: conversation.tenantId.toString(),
      conversationId: conversation.id.toString(),
      contactId: conversation.contactId.toString(),
      messageId: messageId.toString(),
      channel: 'WHATSAPP',
      reason: 'CONTACT_PHONE_MISSING',
      content: {
        type: 'text',
        text: 'Hello',
      },
    });
  });
});
