import { ProcessInboundMessageUseCase } from '@modules/messaging/application/use-cases/ProcessInboundMessageUseCase';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { MessageReceivedIntegrationEvent } from '@modules/messaging/application/integration-events/publishers/MessageReceivedIntegrationEvent';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';

describe('ProcessInboundMessageUseCase', () => {
  let sut: ProcessInboundMessageUseCase;
  let conversationRepository: any;
  let contactFacade: any;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let conversationIntelligenceService: { captureMessageSignal: jest.Mock };

  beforeEach(() => {
    conversationRepository = {
      findByExternalMessageId: jest.fn(),
      findActiveByContact: jest.fn(),
      findLatestByContact: jest.fn(),
      setAssignedUser: jest.fn(),
      save: jest.fn(),
    };
    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn().mockResolvedValue(null),
    };
    transactionalEventPublisher = {
      execute: jest.fn(async (work: any) => {
        const outcome = await work({} as any);
        return outcome.result;
      }),
    } as any;
    conversationIntelligenceService = {
      captureMessageSignal: jest.fn(),
    };

    sut = new ProcessInboundMessageUseCase(
      conversationRepository,
      contactFacade,
      transactionalEventPublisher,
      conversationIntelligenceService as any,
    );
  });

  it('should create a new active conversation, save inbound message and publish event', async () => {
    conversationRepository.findByExternalMessageId.mockResolvedValue(null);
    contactFacade.identifyContact.mockResolvedValue({ contactId: 'contact-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Contato 1',
      phone: '5511999990000',
      branchId: 'branch-1',
    });
    conversationRepository.findLatestByContact.mockResolvedValue(null);

    await sut.execute({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-1',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi, tudo bem?' },
      channel: 'WHATSAPP',
    });

    expect(contactFacade.identifyContact).toHaveBeenCalledWith(
      'tenant-1',
      '5511999990000',
      '5511999990000',
    );
    expect(conversationRepository.findLatestByContact).toHaveBeenCalledWith(
      'tenant-1',
      'contact-1',
    );
    expect(conversationRepository.save).toHaveBeenCalledTimes(1);
    expect(conversationIntelligenceService.captureMessageSignal).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: expect.any(String),
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Oi, tudo bem?',
      options: { tx: expect.any(Object) },
    });

    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation.contactId.toString()).toBe('contact-1');
    expect(savedConversation.branchId).toBe('branch-1');
    expect(savedConversation.channel).toBe('WHATSAPP');
    expect(savedConversation.messages).toHaveLength(1);
    expect(savedConversation.messages[0].direction).toBe('INBOUND');
    expect(savedConversation.messages[0].sentBy).toBe('CONTACT');
    expect(savedConversation.messages[0].content.text).toBe('Oi, tudo bem?');
    expect(savedConversation.messages[0].externalId).toBe('external-msg-1');

    expect(transactionalEventPublisher.execute).toHaveBeenCalledTimes(1);
    const events = await sut.persistInboundMessage({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-1',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi, tudo bem?' },
      channel: 'WHATSAPP',
    });

    const event = events.find(
      (candidate) => candidate instanceof MessageReceivedIntegrationEvent,
    ) as MessageReceivedIntegrationEvent | undefined;

    expect(event).toBeInstanceOf(MessageReceivedIntegrationEvent);
    expect(event?.eventId).toBe('messaging:inbound:external-msg-1');
    expect(event?.payload).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        branchId: 'branch-1',
        content: { type: 'TEXT', text: 'Oi, tudo bem?' },
        channel: 'WHATSAPP',
      }),
    );
  });

  it('should reuse the existing active conversation for the identified contact', async () => {
    const existingConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-1'),
    );

    conversationRepository.findByExternalMessageId.mockResolvedValue(null);
    contactFacade.identifyContact.mockResolvedValue({ contactId: 'contact-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Contato 1',
      phone: '5511999990000',
      branchId: 'branch-1',
    });
    conversationRepository.findLatestByContact.mockResolvedValue(
      existingConversation,
    );

    await sut.execute({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-2',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'audio',
      content: { text: 'Mensagem reaproveitando conversa' },
      channel: 'WHATSAPP',
    });

    const savedConversation = conversationRepository.save.mock.calls[0][0];
    expect(savedConversation).toBe(existingConversation);
    expect(savedConversation.messages).toHaveLength(1);
    expect(savedConversation.messages[0].contentType).toBe('AUDIO');
    expect(savedConversation.messages[0].content.text).toBe(
      'Mensagem reaproveitando conversa',
    );
  });

  it('should reactivate the latest archived conversation and release ownership on new inbound', async () => {
    const archivedConversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-archived'),
    );
    archivedConversation.archive();

    conversationRepository.findByExternalMessageId.mockResolvedValue(null);
    contactFacade.identifyContact.mockResolvedValue({ contactId: 'contact-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Contato 1',
      phone: '5511999990000',
      branchId: 'branch-1',
    });
    conversationRepository.findLatestByContact.mockResolvedValue(
      archivedConversation,
    );

    await sut.execute({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-archived',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Voltei a falar' },
      channel: 'WHATSAPP',
    });

    expect(archivedConversation.status).toBe('ACTIVE');
    expect(conversationRepository.setAssignedUser).toHaveBeenCalledWith(
      'tenant-1',
      'conversation-archived',
      null,
    );
  });

  it('should ignore duplicated inbound messages by externalMessageId', async () => {
    conversationRepository.findByExternalMessageId.mockResolvedValue({
      id: { toString: () => 'conversation-1' },
    });

    await sut.execute({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-1',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi' },
      channel: 'WHATSAPP',
    });

    expect(contactFacade.identifyContact).not.toHaveBeenCalled();
    expect(conversationRepository.save).not.toHaveBeenCalled();
    expect(transactionalEventPublisher.execute).toHaveBeenCalledTimes(1);
  });

  it('should return null from persistInboundMessage when the inbound external id already exists', async () => {
    conversationRepository.findByExternalMessageId.mockResolvedValue({
      id: { toString: () => 'conversation-1' },
    });

    const events = await sut.persistInboundMessage({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-1',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi' },
      channel: 'WHATSAPP',
    });

    expect(events).toEqual([]);
    expect(contactFacade.identifyContact).not.toHaveBeenCalled();
    expect(conversationRepository.save).not.toHaveBeenCalled();
  });
});
