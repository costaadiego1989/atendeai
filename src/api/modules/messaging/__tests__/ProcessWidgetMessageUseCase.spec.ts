import { ProcessWidgetMessageUseCase } from '../application/use-cases/ProcessWidgetMessageUseCase';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ConversationCreatedIntegrationEvent } from '../application/integration-events/publishers/ConversationCreatedIntegrationEvent';
import { MessageReceivedIntegrationEvent } from '../application/integration-events/publishers/MessageReceivedIntegrationEvent';

describe('ProcessWidgetMessageUseCase', () => {
  let useCase: ProcessWidgetMessageUseCase;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let tx: {
    conversation: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    message: { create: jest.Mock };
  };

  const baseInput = {
    tenantId: 'tenant-1',
    widgetSessionId: 'session-1',
    visitorId: 'visitor-abc',
    text: 'Olá, preciso de ajuda!',
  };

  const existingConversation = {
    id: 'conv-existing',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    channel: 'WEB_CHAT',
    status: 'ACTIVE',
  };

  const newMessage = { id: 'msg-1' };

  beforeEach(() => {
    tx = {
      conversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      message: { create: jest.fn().mockResolvedValue(newMessage) },
    };

    transactionalEventPublisher = {
      execute: jest.fn(async (work: any) => {
        const outcome = await work(tx as any);
        return outcome.result;
      }),
    } as any;

    contactFacade = {
      ensureContact: jest.fn().mockResolvedValue({ contactId: 'contact-1', created: false }),
    } as any;

    useCase = new ProcessWidgetMessageUseCase(
      transactionalEventPublisher,
      contactFacade,
    );
  });

  describe('contact resolution', () => {
    it('uses visitorPhone when provided', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute({ ...baseInput, visitorPhone: '+5511999990000' });

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+5511999990000' }),
      );
    });

    it('falls back to widget_<visitorId> when phone absent', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute(baseInput);

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ phone: 'widget_visitor-abc' }),
      );
    });

    it('uses visitorName when provided', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute({ ...baseInput, visitorName: 'Maria' });

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Maria' }),
      );
    });

    it('falls back to "Visitante Web" when name absent', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute(baseInput);

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Visitante Web' }),
      );
    });
  });

  describe('existing conversation', () => {
    beforeEach(() => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);
    });

    it('returns contactId, conversationId, messageId', async () => {
      const result = await useCase.execute(baseInput);

      expect(result).toEqual({
        contactId: 'contact-1',
        conversationId: 'conv-existing',
        messageId: 'msg-1',
      });
    });

    it('does not create a new conversation', async () => {
      await useCase.execute(baseInput);

      expect(tx.conversation.create).not.toHaveBeenCalled();
    });

    it('emits only MessageReceivedIntegrationEvent — no ConversationCreated', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0]).toBeInstanceOf(MessageReceivedIntegrationEvent);
    });

    it('updates conversation lastMessageAt, unreadCount, status after save', async () => {
      await useCase.execute(baseInput);

      expect(tx.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-existing' },
          data: expect.objectContaining({
            lastMessageDirection: 'INBOUND',
            unreadCount: { increment: 1 },
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });

  describe('new conversation', () => {
    const newConversation = { id: 'conv-new', tenantId: 'tenant-1', contactId: 'contact-1' };

    beforeEach(() => {
      tx.conversation.findFirst.mockResolvedValue(null);
      tx.conversation.create.mockResolvedValue(newConversation);
    });

    it('creates WEB_CHAT ACTIVE conversation', async () => {
      await useCase.execute(baseInput);

      expect(tx.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            contactId: 'contact-1',
            channel: 'WEB_CHAT',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('emits ConversationCreatedIntegrationEvent and MessageReceivedIntegrationEvent', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0]).toBeInstanceOf(ConversationCreatedIntegrationEvent);
      expect(capturedEvents[1]).toBeInstanceOf(MessageReceivedIntegrationEvent);
    });

    it('ConversationCreatedIntegrationEvent carries WEB_CHAT channel', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents[0].payload).toMatchObject({
        tenantId: 'tenant-1',
        conversationId: 'conv-new',
        contactId: 'contact-1',
        channel: 'WEB_CHAT',
      });
    });
  });

  describe('message creation', () => {
    beforeEach(() => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);
    });

    it('creates INBOUND message with CONTACT sentBy and DELIVERED status', async () => {
      await useCase.execute(baseInput);

      expect(tx.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-existing',
            direction: 'INBOUND',
            sentBy: 'CONTACT',
            deliveryStatus: 'DELIVERED',
          }),
        }),
      );
    });

    it('defaults contentType to TEXT when not provided', async () => {
      await useCase.execute(baseInput);

      expect(tx.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentType: 'TEXT' }),
        }),
      );
    });

    it('uppercases contentType from input', async () => {
      await useCase.execute({ ...baseInput, contentType: 'image' });

      expect(tx.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentType: 'IMAGE' }),
        }),
      );
    });

    it('includes url in message content when provided', async () => {
      await useCase.execute({ ...baseInput, url: 'https://example.com/img.jpg' });

      expect(tx.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.objectContaining({ url: 'https://example.com/img.jpg' }),
          }),
        }),
      );
    });
  });

  describe('MessageReceivedIntegrationEvent', () => {
    beforeEach(() => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);
    });

    it('has moduleId widget and channel WEB_CHAT', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents[0].payload).toMatchObject({
        channel: 'WEB_CHAT',
        moduleId: 'widget',
        messageId: 'msg-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
      });
    });

    it('passes quickReplies as contextHints', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute({ ...baseInput, quickReplies: ['Sim', 'Não'] });

      expect(capturedEvents[0].payload.contextHints).toEqual(['Sim', 'Não']);
    });

    it('omits contextHints when quickReplies not provided', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents[0].payload.contextHints).toBeUndefined();
    });

    it('omits url from event content when not provided', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents[0].payload.content.url).toBeUndefined();
    });
  });
});
