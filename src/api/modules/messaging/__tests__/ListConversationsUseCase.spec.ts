import { ListConversationsUseCase } from '@modules/messaging/application/use-cases/ListConversationsUseCase';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('ListConversationsUseCase', () => {
  let useCase: ListConversationsUseCase;
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let contactFacade: { getContactById: jest.Mock };
  let conversationIntelligenceRepository: { findByConversationIds: jest.Mock };

  beforeEach(() => {
    conversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByMessageId: jest.fn(),
      findByExternalMessageId: jest.fn(),
      findActiveByContact: jest.fn(),
      findLatestByContact: jest.fn(),
      findAllByTenant: jest.fn(),
      setAssignedUser: jest.fn(),
      findAssignedUsers: jest.fn(),
      findQueueState: jest.fn(),
      findMessagesByConversation: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;

    contactFacade = {
      getContactById: jest.fn(),
    };
    conversationIntelligenceRepository = {
      findByConversationIds: jest.fn().mockResolvedValue({}),
    };

    useCase = new ListConversationsUseCase(
      conversationRepository,
      contactFacade as any,
      conversationIntelligenceRepository as any,
    );
  });

  it('should map persisted queue signals to the output contract', async () => {
    const conversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-1'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-1'),
    );

    conversationRepository.findAllByTenant.mockResolvedValue({
      data: [conversation],
      total: 1,
    });
    conversationRepository.findAssignedUsers.mockResolvedValue({
      'conversation-1': {
        id: 'user-1',
        name: 'Paula',
        assignedAt: new Date('2026-04-06T10:15:00.000Z'),
      },
    });
    conversationRepository.findQueueState.mockResolvedValue({
      'conversation-1': {
        unreadCount: 2,
        lastInboundAt: new Date('2026-04-06T10:16:00.000Z'),
        lastOutboundAt: new Date('2026-04-06T10:14:00.000Z'),
        lastMessageAt: new Date('2026-04-06T10:16:00.000Z'),
        lastMessageDirection: 'INBOUND',
        lastMessagePreview: 'Cliente respondeu',
      },
    });
    conversationIntelligenceRepository.findByConversationIds.mockResolvedValue({
      'conversation-1': {
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        summary: 'Cliente: Quero saber o valor',
        sentiment: 'NEUTRAL',
        tags: ['financeiro'],
        interests: ['preço'],
        nextStep: 'Enviar proposta.',
        lossReason: null,
        updatedAt: new Date('2026-04-06T10:17:00.000Z'),
      },
    });
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-1',
      name: 'Cliente Inbox',
      phone: '5511999990000',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      page: 1,
      limit: 20,
    });

    expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1', {
      branchId: undefined,
      page: 1,
      limit: 20,
      status: undefined,
      assignedUserId: undefined,
    });
    expect(conversationRepository.findAssignedUsers).toHaveBeenCalledWith('tenant-1', [
      'conversation-1',
    ]);
    expect(conversationRepository.findQueueState).toHaveBeenCalledWith('tenant-1', [
      'conversation-1',
    ]);
    expect(conversationIntelligenceRepository.findByConversationIds).toHaveBeenCalledWith(
      'tenant-1',
      ['conversation-1'],
    );
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'conversation-1',
        contactName: 'Cliente Inbox',
        contactPhone: '5511999990000',
        unreadCount: 2,
        assignedToName: 'Paula',
        lastMessage: expect.objectContaining({
          content: 'Cliente respondeu',
          direction: 'INBOUND',
        }),
        intelligence: expect.objectContaining({
          summary: 'Cliente: Quero saber o valor',
          sentiment: 'NEUTRAL',
          tags: ['financeiro'],
          interests: ['preço'],
          nextStep: 'Enviar proposta.',
        }),
      }),
    ]);
  });

  it('should return conversation without last message when queue state is empty', async () => {
    const conversation = Conversation.create(
      {
        tenantId: TenantId.create('tenant-1'),
        contactId: new UniqueEntityID('contact-2'),
        channel: 'WHATSAPP',
      },
      new UniqueEntityID('conversation-2'),
    );

    conversationRepository.findAllByTenant.mockResolvedValue({
      data: [conversation],
      total: 1,
    });
    conversationRepository.findAssignedUsers.mockResolvedValue({});
    conversationRepository.findQueueState.mockResolvedValue({});
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-2',
      name: 'Sem historico',
      phone: '5511988887777',
    });

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.data[0].lastMessage).toBeUndefined();
    expect(result.data[0].unreadCount).toBe(0);
  });

  it('should scope non-owner users to conversations assigned to them', async () => {
    conversationRepository.findAllByTenant.mockResolvedValue({
      data: [],
      total: 0,
    });
    conversationRepository.findAssignedUsers.mockResolvedValue({});
    conversationRepository.findQueueState.mockResolvedValue({});

    await useCase.execute({
      tenantId: 'tenant-1',
      requesterUserId: 'agent-1',
      requesterRole: 'AGENT',
    });

    expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1', {
      branchId: undefined,
      page: 1,
      limit: 20,
      status: undefined,
      assignedUserId: 'agent-1',
    });
  });

  it('should let owner users list every conversation in the tenant', async () => {
    conversationRepository.findAllByTenant.mockResolvedValue({
      data: [],
      total: 0,
    });
    conversationRepository.findAssignedUsers.mockResolvedValue({});
    conversationRepository.findQueueState.mockResolvedValue({});

    await useCase.execute({
      tenantId: 'tenant-1',
      requesterUserId: 'owner-1',
      requesterRole: 'OWNER',
    });

    expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1', {
      branchId: undefined,
      page: 1,
      limit: 20,
      status: undefined,
      assignedUserId: undefined,
    });
  });
});
