import { ListConversationsUseCase } from '../application/use-cases/ListConversationsUseCase';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';
import { Conversation } from '../domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('Messaging — Tenant Isolation', () => {
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let contactFacade: { getContactById: jest.Mock };
  let conversationIntelligenceRepository: { findByConversationIds: jest.Mock };

  const TENANT_A = 'tenant-aaa';
  const TENANT_B = 'tenant-bbb';

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
      markAsRead: jest.fn(),
      findMessagesByConversation: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;

    contactFacade = { getContactById: jest.fn() };
    conversationIntelligenceRepository = {
      findByConversationIds: jest.fn().mockResolvedValue({}),
    };
  });

  describe('ListConversationsUseCase — tenant scoping', () => {
    let useCase: ListConversationsUseCase;

    beforeEach(() => {
      useCase = new ListConversationsUseCase(
        conversationRepository,
        contactFacade as any,
        conversationIntelligenceRepository as any,
      );
    });

    it('should scope all repository calls by tenantId', async () => {
      const conversation = Conversation.create(
        {
          tenantId: TenantId.create(TENANT_A),
          contactId: new UniqueEntityID('contact-1'),
          channel: 'WHATSAPP',
        },
        new UniqueEntityID('conv-1'),
      );

      conversationRepository.findAllByTenant.mockResolvedValue({
        data: [conversation],
        total: 1,
      });
      conversationRepository.findAssignedUsers.mockResolvedValue({});
      conversationRepository.findQueueState.mockResolvedValue({});
      contactFacade.getContactById.mockResolvedValue({
        id: 'contact-1',
        name: 'Test',
        phone: '5511999990000',
      });

      await useCase.execute({ tenantId: TENANT_A });

      expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith(
        TENANT_A,
        expect.any(Object),
      );
      expect(conversationRepository.findAssignedUsers).toHaveBeenCalledWith(
        TENANT_A,
        ['conv-1'],
      );
      expect(conversationRepository.findQueueState).toHaveBeenCalledWith(
        TENANT_A,
        ['conv-1'],
      );
    });

    it('should never mix tenant data in a single request', async () => {
      conversationRepository.findAllByTenant.mockResolvedValue({
        data: [],
        total: 0,
      });
      conversationRepository.findAssignedUsers.mockResolvedValue({});
      conversationRepository.findQueueState.mockResolvedValue({});

      await useCase.execute({ tenantId: TENANT_B });

      expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith(
        TENANT_B,
        expect.any(Object),
      );
      expect(conversationRepository.findAllByTenant).not.toHaveBeenCalledWith(
        TENANT_A,
        expect.any(Object),
      );
    });

    it('should scope AGENT role to their own conversations within tenant', async () => {
      conversationRepository.findAllByTenant.mockResolvedValue({
        data: [],
        total: 0,
      });
      conversationRepository.findAssignedUsers.mockResolvedValue({});
      conversationRepository.findQueueState.mockResolvedValue({});

      await useCase.execute({
        tenantId: TENANT_A,
        requesterUserId: 'agent-1',
        requesterRole: 'AGENT',
      });

      expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({ assignedUserId: 'agent-1' }),
      );
    });

    it('should allow OWNER to see all conversations in their tenant', async () => {
      conversationRepository.findAllByTenant.mockResolvedValue({
        data: [],
        total: 0,
      });
      conversationRepository.findAssignedUsers.mockResolvedValue({});
      conversationRepository.findQueueState.mockResolvedValue({});

      await useCase.execute({
        tenantId: TENANT_A,
        requesterUserId: 'owner-1',
        requesterRole: 'OWNER',
      });

      expect(conversationRepository.findAllByTenant).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({ assignedUserId: undefined }),
      );
    });
  });

  describe('Repository interface — tenant-scoped methods', () => {
    it('findActiveByContact requires tenantId parameter', async () => {
      conversationRepository.findActiveByContact.mockResolvedValue(null);

      await conversationRepository.findActiveByContact(TENANT_A, 'contact-1');

      expect(conversationRepository.findActiveByContact).toHaveBeenCalledWith(
        TENANT_A,
        'contact-1',
      );
    });

    it('setAssignedUser requires tenantId parameter', async () => {
      await conversationRepository.setAssignedUser(TENANT_A, 'conv-1', 'user-1');

      expect(conversationRepository.setAssignedUser).toHaveBeenCalledWith(
        TENANT_A,
        'conv-1',
        'user-1',
      );
    });

    it('markAsRead requires tenantId parameter', async () => {
      await conversationRepository.markAsRead(TENANT_A, 'conv-1');

      expect(conversationRepository.markAsRead).toHaveBeenCalledWith(
        TENANT_A,
        'conv-1',
      );
    });
  });
});
