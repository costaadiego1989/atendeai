import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WidgetController } from '../presentation/controllers/WidgetController';
import { GetWidgetPublicConfigUseCase } from '../application/use-cases/GetWidgetPublicConfigUseCase';
import { InitWidgetSessionUseCase } from '../application/use-cases/InitWidgetSessionUseCase';
import { CloseWidgetSessionUseCase } from '../application/use-cases/CloseWidgetSessionUseCase';
import { GetWidgetSessionMessagesUseCase } from '../application/use-cases/GetWidgetSessionMessagesUseCase';
import { ProcessWidgetMessageUseCase } from '../application/use-cases/ProcessWidgetMessageUseCase';
import { IWidgetSessionRepository } from '../domain/repositories/IWidgetSessionRepository';

describe('WidgetController', () => {
  let controller: WidgetController;
  let getPublicConfig: jest.Mocked<Pick<GetWidgetPublicConfigUseCase, 'execute'>>;
  let initSession: jest.Mocked<Pick<InitWidgetSessionUseCase, 'execute'>>;
  let closeSession: jest.Mocked<Pick<CloseWidgetSessionUseCase, 'execute'>>;
  let getMessages: jest.Mocked<Pick<GetWidgetSessionMessagesUseCase, 'execute'>>;
  let processMessage: jest.Mocked<Pick<ProcessWidgetMessageUseCase, 'execute'>>;
  let sessionRepo: jest.Mocked<IWidgetSessionRepository>;

  const mockConfig = {
    id: 'wc-1',
    tenantId: 'tenant-1',
    name: 'Support Widget',
    greeting: 'Olá! Como posso ajudar?',
    color: '#007bff',
    position: 'bottom-right',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    collectName: true,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    proactiveDelay: 5000,
    proactiveMsg: 'Precisa de ajuda?',
    quickReplies: [],
  };

  const mockSession = {
    id: 'session-1',
    widgetConfigId: 'wc-1',
    tenantId: 'tenant-1',
    visitorId: 'visitor-1',
    contactId: null,
    conversationId: null,
    visitorName: 'Visitor',
    visitorPhone: null,
    visitorEmail: null,
    visitorCpf: null,
    pageUrl: null,
    status: 'ACTIVE',
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    getPublicConfig = { execute: jest.fn() };
    initSession = { execute: jest.fn() };
    closeSession = { execute: jest.fn() };
    getMessages = { execute: jest.fn() };
    processMessage = { execute: jest.fn() };
    sessionRepo = {
      findActiveByVisitor: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      close: jest.fn(),
    };

    controller = new WidgetController(
      getPublicConfig as any,
      initSession as any,
      closeSession as any,
      getMessages as any,
      processMessage as any,
      sessionRepo,
    );
  });

  describe('getConfig', () => {
    it('should return widget config for valid public token', async () => {
      getPublicConfig.execute.mockResolvedValue(mockConfig as any);

      const result = await controller.getConfig('pub-token-123');

      expect(result.id).toBe('wc-1');
      expect(result.name).toBe('Support Widget');
      expect(getPublicConfig.execute).toHaveBeenCalledWith('pub-token-123');
    });

    it('should propagate NotFoundException from use case', async () => {
      getPublicConfig.execute.mockRejectedValue(new NotFoundException());

      await expect(controller.getConfig('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('initSession', () => {
    it('should create a new session', async () => {
      initSession.execute.mockResolvedValue({ sessionId: 'session-1', conversationId: 'conv-1', resumed: false });

      const result = await controller.initWidgetSession('pub-token-123', {
        visitorId: 'visitor-abc',
        visitorName: 'João',
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.resumed).toBe(false);
      expect(initSession.execute).toHaveBeenCalledWith(
        expect.objectContaining({ publicToken: 'pub-token-123', visitorId: 'visitor-abc' }),
      );
    });

    it('should resume existing active session', async () => {
      initSession.execute.mockResolvedValue({ sessionId: 'session-existing', conversationId: 'conv-1', resumed: true });

      const result = await controller.initWidgetSession('pub-token-123', {
        visitorId: 'visitor-abc',
        visitorName: 'New Name',
      });

      expect(result.resumed).toBe(true);
    });

    it('should propagate BadRequestException from use case', async () => {
      initSession.execute.mockRejectedValue(new BadRequestException('visitorId is required'));

      await expect(
        controller.initWidgetSession('pub-token-123', { visitorId: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendMessage', () => {
    it('should delegate to processWidgetMessage use case', async () => {
      getPublicConfig.execute.mockResolvedValue(mockConfig as any);
      sessionRepo.findById.mockResolvedValue(mockSession);
      sessionRepo.update.mockResolvedValue(mockSession);
      processMessage.execute.mockResolvedValue({
        contactId: 'contact-new',
        conversationId: 'conv-new',
        messageId: 'msg-1',
      });

      const result = await controller.sendMessage('pub-token-123', {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        text: 'Hello!',
      });

      expect(result.messageId).toBe('msg-1');
      expect(result.conversationId).toBe('conv-new');
      expect(processMessage.execute).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello!', tenantId: 'tenant-1' }),
      );
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        controller.sendMessage('pub-token-123', {
          sessionId: '',
          visitorId: 'v1',
          text: 'hi',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when session not found', async () => {
      getPublicConfig.execute.mockResolvedValue(mockConfig as any);
      sessionRepo.findById.mockResolvedValue(null);

      await expect(
        controller.sendMessage('pub-token-123', {
          sessionId: 'nonexistent',
          visitorId: 'v1',
          text: 'hi',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass visitor data to processWidgetMessage use case', async () => {
      getPublicConfig.execute.mockResolvedValue(mockConfig as any);
      sessionRepo.findById.mockResolvedValue({ ...mockSession, visitorPhone: '+55119' });
      sessionRepo.update.mockResolvedValue(mockSession);
      processMessage.execute.mockResolvedValue({
        contactId: 'c-1', conversationId: 'conv-1', messageId: 'msg-1',
      });

      await controller.sendMessage('pub-token-123', {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        text: 'Hello',
      });

      expect(processMessage.execute).toHaveBeenCalledWith(
        expect.objectContaining({ visitorPhone: '+55119' }),
      );
    });
  });

  describe('getSessionMessages', () => {
    it('should return messages for a session', async () => {
      const msgs = [
        { id: 'msg-1', direction: 'INBOUND', contentType: 'TEXT', content: { text: 'Hi' }, sentBy: 'CONTACT', createdAt: new Date() },
      ];
      getMessages.execute.mockResolvedValue({ messages: msgs as any });

      const result = await controller.getSessionMessages('pub-token-123', 'session-1');

      expect(result.messages).toHaveLength(1);
      expect(getMessages.execute).toHaveBeenCalledWith({ publicToken: 'pub-token-123', sessionId: 'session-1' });
    });

    it('should return empty messages when use case returns empty', async () => {
      getMessages.execute.mockResolvedValue({ messages: [] });

      const result = await controller.getSessionMessages('pub-token-123', 'session-1');

      expect(result.messages).toEqual([]);
    });
  });

  describe('restartSession', () => {
    it('should call closeSession and return success', async () => {
      closeSession.execute.mockResolvedValue(undefined);

      const result = await controller.restartSession('pub-token-123', 'session-1');

      expect(result).toEqual({ success: true });
      expect(closeSession.execute).toHaveBeenCalledWith({
        publicToken: 'pub-token-123',
        sessionId: 'session-1',
      });
    });
  });
});
