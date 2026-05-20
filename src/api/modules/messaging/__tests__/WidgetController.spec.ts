import { WidgetController } from '../presentation/controllers/WidgetController';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WidgetController', () => {
  let controller: WidgetController;
  let prisma: any;

  const mockConfig = {
    id: 'wc-1',
    tenantId: 'tenant-1',
    publicToken: 'pub-token-123',
    enabled: true,
    name: 'Support Widget',
    greeting: 'Olá! Como posso ajudar?',
    color: '#007bff',
    position: 'bottom-right',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    collectName: true,
    collectPhone: false,
    proactiveDelay: 5000,
    proactiveMsg: 'Precisa de ajuda?',
  };

  beforeEach(() => {
    prisma = {
      widgetConfig: { findUnique: jest.fn() },
      widgetSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      contact: { findFirst: jest.fn(), create: jest.fn() },
      conversation: { create: jest.fn(), update: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn() },
    };

    controller = new WidgetController(prisma);
  });

  describe('getConfig', () => {
    it('should return widget config for valid public token', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await controller.getConfig('pub-token-123');

      expect(result.id).toBe('wc-1');
      expect(result.name).toBe('Support Widget');
      expect(result.greeting).toBe('Olá! Como posso ajudar?');
      expect(result.color).toBe('#007bff');
    });

    it('should throw NotFoundException when widget not found', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(null);

      await expect(controller.getConfig('invalid-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when widget is disabled', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue({ ...mockConfig, enabled: false });

      await expect(controller.getConfig('pub-token-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('initSession', () => {
    it('should create a new session', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue(null);
      prisma.widgetSession.create.mockResolvedValue({
        id: 'session-1',
        conversationId: null,
      });

      const result = await controller.initSession('pub-token-123', {
        visitorId: 'visitor-abc',
        visitorName: 'João',
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.resumed).toBe(false);
      expect(prisma.widgetSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            visitorId: 'visitor-abc',
            visitorName: 'João',
          }),
        }),
      );
    });

    it('should resume existing active session', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue({
        id: 'session-existing',
        conversationId: 'conv-1',
        visitorName: 'Old Name',
      });

      const result = await controller.initSession('pub-token-123', {
        visitorId: 'visitor-abc',
        visitorName: 'New Name',
      });

      expect(result.sessionId).toBe('session-existing');
      expect(result.resumed).toBe(true);
      expect(prisma.widgetSession.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when visitorId is missing', async () => {
      await expect(
        controller.initSession('pub-token-123', { visitorId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when widget not found', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(null);

      await expect(
        controller.initSession('invalid', { visitorId: 'v1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendMessage', () => {
    const mockSession = {
      id: 'session-1',
      tenantId: 'tenant-1',
      visitorId: 'visitor-1',
      contactId: null,
      conversationId: null,
      status: 'ACTIVE',
      visitorPhone: null,
      visitorName: 'Visitor',
      visitorEmail: null,
    };

    it('should create message, contact, and conversation on first message', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue(mockSession);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.contact.create.mockResolvedValue({ id: 'contact-new' });
      prisma.conversation.create.mockResolvedValue({ id: 'conv-new' });
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });

      const result = await controller.sendMessage('pub-token-123', {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        text: 'Hello!',
      });

      expect(result.messageId).toBe('msg-1');
      expect(result.conversationId).toBe('conv-new');
      expect(result.contactId).toBe('contact-new');
      expect(prisma.contact.create).toHaveBeenCalled();
      expect(prisma.conversation.create).toHaveBeenCalled();
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
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue(null);

      await expect(
        controller.sendMessage('pub-token-123', {
          sessionId: 'nonexistent',
          visitorId: 'v1',
          text: 'hi',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reuse existing contact when found', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue(mockSession);
      prisma.contact.findFirst.mockResolvedValue({ id: 'existing-contact' });
      prisma.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });

      const result = await controller.sendMessage('pub-token-123', {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        text: 'Hello',
      });

      expect(result.contactId).toBe('existing-contact');
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('should return messages for a session', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue({
        id: 'session-1',
        conversationId: 'conv-1',
      });
      prisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', direction: 'INBOUND', contentType: 'TEXT', content: { text: 'Hi' }, sentBy: 'CONTACT', createdAt: new Date() },
        { id: 'msg-2', direction: 'OUTBOUND', contentType: 'TEXT', content: { text: 'Hello!' }, sentBy: 'AGENT', createdAt: new Date() },
      ]);

      const result = await controller.getMessages('pub-token-123', 'session-1');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-1');
    });

    it('should return empty messages when session has no conversation', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.widgetSession.findFirst.mockResolvedValue({
        id: 'session-1',
        conversationId: null,
      });

      const result = await controller.getMessages('pub-token-123', 'session-1');

      expect(result.messages).toEqual([]);
    });

    it('should throw NotFoundException when widget not found', async () => {
      prisma.widgetConfig.findUnique.mockResolvedValue(null);

      await expect(
        controller.getMessages('invalid', 'session-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
