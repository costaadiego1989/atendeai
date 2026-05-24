import { MessagingFacade } from '../application/facades/MessagingFacade';
import { Conversation } from '../domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { MessageQueuedIntegrationEvent } from '../application/integration-events/publishers/MessageSentIntegrationEvent';

describe('MessagingFacade', () => {
  let sut: MessagingFacade;
  let conversationRepository: {
    findById: jest.Mock;
    findLatestByContact: jest.Mock;
    save: jest.Mock;
    setAssignedUser: jest.Mock;
  };
  let contactFacade: { getContactById: jest.Mock };
  let messageQueue: { addJob: jest.Mock };
  let eventBus: { publish: jest.Mock };
  beforeEach(() => {
    conversationRepository = {
      findById: jest.fn(),
      findLatestByContact: jest.fn(),
      save: jest.fn(),
      setAssignedUser: jest.fn(),
    };
    contactFacade = {
      getContactById: jest.fn(),
    };
    messageQueue = {
      addJob: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
    };

    sut = new MessagingFacade(
      conversationRepository as any,
      contactFacade as any,
      messageQueue as any,
      eventBus as any,
    );
  });

  it('should create a new conversation and queue a system message when no existing conversation is found', async () => {
    conversationRepository.findLatestByContact.mockResolvedValue(null);
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-1',
      branchId: 'branch-1',
    });

    const result = await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'Olá, tudo bem?',
    });

    expect(conversationRepository.save).toHaveBeenCalledTimes(1);
    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation.contactId.toString()).toBe('contact-1');
    expect(savedConversation.channel).toBe('WHATSAPP');
    expect(savedConversation.messages).toHaveLength(1);
    expect(savedConversation.messages[0].sentBy).toBe('SYSTEM');
    expect(savedConversation.messages[0].content.text).toBe('Olá, tudo bem?');

    expect(messageQueue.addJob).toHaveBeenCalledWith({
      messageId: expect.any(String),
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(MessageQueuedIntegrationEvent),
    );
    expect(result).toEqual({
      conversationId: expect.any(String),
      messageId: expect.any(String),
    });
  });

  it('should reuse an existing active conversation for the contact', async () => {
    const existingConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-existing'),
    );

    conversationRepository.findLatestByContact.mockResolvedValue(
      existingConversation,
    );

    const result = await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'Follow-up message',
    });

    expect(conversationRepository.save).toHaveBeenCalledWith(
      existingConversation,
    );
    expect(existingConversation.messages).toHaveLength(1);
    expect(result.conversationId).toBe('conversation-existing');
  });

  it('should reactivate an archived conversation and release assignment', async () => {
    const archivedConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-archived'),
    );
    archivedConversation.archive();

    conversationRepository.findLatestByContact.mockResolvedValue(
      archivedConversation,
    );

    await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'Reactivation message',
    });

    expect(archivedConversation.status).toBe('ACTIVE');
    expect(conversationRepository.setAssignedUser).toHaveBeenCalledWith(
      'tenant-1',
      'conversation-archived',
      null,
    );
  });

  it('should use provided conversationId to find existing conversation', async () => {
    const existingConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-specific'),
    );

    conversationRepository.findById.mockResolvedValue(existingConversation);

    const result = await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'Targeted message',
      conversationId: 'conversation-specific',
    });

    expect(conversationRepository.findById).toHaveBeenCalledWith(
      'conversation-specific',
    );
    expect(conversationRepository.findLatestByContact).not.toHaveBeenCalled();
    expect(result.conversationId).toBe('conversation-specific');
  });

  it('should create a new conversation when provided conversationId belongs to a different tenant', async () => {
    const otherTenantConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-other'),
        contactId: new UniqueEntityID('contact-other'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-other-tenant'),
    );

    conversationRepository.findById.mockResolvedValue(otherTenantConversation);
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-1',
      branchId: 'branch-1',
    });

    const result = await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'New conversation needed',
      conversationId: 'conversation-other-tenant',
    });

    expect(result.conversationId).not.toBe('conversation-other-tenant');
    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation.tenantId.toString()).toBe('tenant-1');
  });

  it('should use branchId from input when provided instead of looking up contact', async () => {
    conversationRepository.findLatestByContact.mockResolvedValue(null);

    await sut.queueSystemMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'With branch',
      branchId: 'branch-explicit',
    });

    expect(contactFacade.getContactById).not.toHaveBeenCalled();
    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation.branchId).toBe('branch-explicit');
  });

  it('should persist a TEMPLATE message and queue a job (outbox pattern)', async () => {
    conversationRepository.findLatestByContact.mockResolvedValue(null);

    const result = await sut.queueTemplateMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      phone: '+5511999999999',
      channel: 'WHATSAPP',
      templateName: 'welcome',
      languageCode: 'pt_BR',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'Cliente' }] },
      ],
      renderedBody: 'Olá Cliente',
    });

    // Message persisted before any external send
    expect(conversationRepository.save).toHaveBeenCalledTimes(1);
    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation.messages).toHaveLength(1);
    expect(savedConversation.messages[0].contentType).toBe('TEMPLATE');

    // Job queued with internal message id
    expect(messageQueue.addJob).toHaveBeenCalledWith({
      messageId: expect.any(String),
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(MessageQueuedIntegrationEvent),
    );
    expect(result).toEqual({
      conversationId: expect.any(String),
      messageId: expect.any(String),
    });
    // Internal messageId, not provider id
    expect(result.messageId).not.toBe('wa-123');
  });
});
