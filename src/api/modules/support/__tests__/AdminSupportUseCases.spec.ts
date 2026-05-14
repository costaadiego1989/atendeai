import { NotFoundException } from '@nestjs/common';
import { ListAllFeedbacksUseCase } from '../application/use-cases/ListAllFeedbacksUseCase';
import { GetFeedbackDetailsUseCase } from '../application/use-cases/GetFeedbackDetailsUseCase';
import { UpdateFeedbackStatusUseCase } from '../application/use-cases/UpdateFeedbackStatusUseCase';
import { ReplyFeedbackUseCase } from '../application/use-cases/ReplyFeedbackUseCase';

describe('Admin Support Use Cases', () => {
  let repository: any;
  let users: any;
  let contacts: any;
  let messaging: any;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      createReply: jest.fn(),
      listReplies: jest.fn(),
    };
    users = {
      findById: jest.fn(),
    };
    contacts = {
      ensureContact: jest.fn(),
    };
    messaging = {
      queueSystemMessage: jest.fn(),
    };
  });

  describe('ListAllFeedbacksUseCase', () => {
    let useCase: ListAllFeedbacksUseCase;

    beforeEach(() => {
      useCase = new ListAllFeedbacksUseCase(repository);
    });

    it('should list feedbacks with default pagination', async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });

      await useCase.execute({});

      expect(repository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        type: undefined,
        status: undefined,
        tenantId: undefined,
      });
    });

    it('should pass filters to repository', async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });

      await useCase.execute({ page: 2, limit: 10, type: 'BUG', status: 'OPEN', tenantId: 'tenant-1' });

      expect(repository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        type: 'BUG',
        status: 'OPEN',
        tenantId: 'tenant-1',
      });
    });
  });

  describe('GetFeedbackDetailsUseCase', () => {
    let useCase: GetFeedbackDetailsUseCase;

    beforeEach(() => {
      useCase = new GetFeedbackDetailsUseCase(repository);
    });

    it('should return feedback with replies', async () => {
      const feedback = { id: 'fb-1', title: 'Bug report', status: 'OPEN' };
      const replies = [{ id: 'r-1', message: 'Working on it' }];
      repository.findById.mockResolvedValue(feedback);
      repository.listReplies.mockResolvedValue(replies);

      const result = await useCase.execute('fb-1');

      expect(result).toEqual({ feedback, replies });
      expect(repository.findById).toHaveBeenCalledWith('fb-1');
      expect(repository.listReplies).toHaveBeenCalledWith('fb-1');
    });

    it('should throw NotFoundException when feedback does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(useCase.execute('nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('UpdateFeedbackStatusUseCase', () => {
    let useCase: UpdateFeedbackStatusUseCase;

    beforeEach(() => {
      useCase = new UpdateFeedbackStatusUseCase(repository);
    });

    it('should update status when feedback exists', async () => {
      repository.findById.mockResolvedValue({ id: 'fb-1', status: 'OPEN' });

      await useCase.execute({ feedbackId: 'fb-1', status: 'CLOSED' });

      expect(repository.updateStatus).toHaveBeenCalledWith('fb-1', 'CLOSED');
    });

    it('should throw NotFoundException when feedback does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ feedbackId: 'nonexistent', status: 'CLOSED' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('ReplyFeedbackUseCase', () => {
    let useCase: ReplyFeedbackUseCase;

    beforeEach(() => {
      useCase = new ReplyFeedbackUseCase(repository, users, contacts, messaging);
    });

    it('should save reply and send WhatsApp message', async () => {
      const feedback = {
        id: 'fb-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        title: 'Bug no login',
        status: 'OPEN',
      };
      repository.findById.mockResolvedValue(feedback);
      users.findById.mockResolvedValue({ name: 'João', phone: { value: '5511999990000' } });
      contacts.ensureContact.mockResolvedValue({ contactId: 'contact-1' });
      messaging.queueSystemMessage.mockResolvedValue({ messageId: 'msg-1', conversationId: 'conv-1' });
      repository.createReply.mockResolvedValue({
        id: 'reply-1',
        feedbackId: 'fb-1',
        authorName: 'Admin',
        message: 'Corrigido!',
        sentVia: 'WHATSAPP',
        messageId: 'msg-1',
        createdAt: '2026-05-14T00:00:00.000Z',
      });

      const result = await useCase.execute({
        feedbackId: 'fb-1',
        message: 'Corrigido!',
        authorName: 'Admin',
      });

      expect(result.messageSent).toBe(true);
      expect(result.reply.sentVia).toBe('WHATSAPP');
      expect(repository.updateStatus).toHaveBeenCalledWith('fb-1', 'REVIEWED');
      expect(messaging.queueSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          channel: 'WHATSAPP',
        }),
      );
    });

    it('should save reply even when WhatsApp fails', async () => {
      const feedback = {
        id: 'fb-2',
        tenantId: 'tenant-1',
        userId: 'user-2',
        title: 'Sugestão',
        status: 'OPEN',
      };
      repository.findById.mockResolvedValue(feedback);
      users.findById.mockResolvedValue(null); // user not found
      repository.createReply.mockResolvedValue({
        id: 'reply-2',
        feedbackId: 'fb-2',
        authorName: 'Admin',
        message: 'Obrigado!',
        sentVia: null,
        messageId: null,
        createdAt: '2026-05-14T00:00:00.000Z',
      });

      const result = await useCase.execute({
        feedbackId: 'fb-2',
        message: 'Obrigado!',
        authorName: 'Admin',
      });

      expect(result.messageSent).toBe(false);
      expect(result.reply.sentVia).toBeNull();
      expect(messaging.queueSystemMessage).not.toHaveBeenCalled();
    });

    it('should not change status if already REVIEWED', async () => {
      const feedback = {
        id: 'fb-3',
        tenantId: 'tenant-1',
        userId: 'user-3',
        title: 'Melhoria',
        status: 'REVIEWED',
      };
      repository.findById.mockResolvedValue(feedback);
      users.findById.mockResolvedValue(null);
      repository.createReply.mockResolvedValue({
        id: 'reply-3',
        feedbackId: 'fb-3',
        authorName: 'Admin',
        message: 'Anotado',
        sentVia: null,
        messageId: null,
        createdAt: '2026-05-14T00:00:00.000Z',
      });

      await useCase.execute({
        feedbackId: 'fb-3',
        message: 'Anotado',
        authorName: 'Admin',
      });

      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when feedback does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ feedbackId: 'nonexistent', message: 'test', authorName: 'Admin' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
