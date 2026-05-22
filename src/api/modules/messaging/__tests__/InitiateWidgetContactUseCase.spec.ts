import { InitiateWidgetContactUseCase } from '../application/use-cases/InitiateWidgetContactUseCase';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ConversationCreatedIntegrationEvent } from '../application/integration-events/publishers/ConversationCreatedIntegrationEvent';
import { MessageReceivedIntegrationEvent } from '../application/integration-events/publishers/MessageReceivedIntegrationEvent';

describe('InitiateWidgetContactUseCase', () => {
  let useCase: InitiateWidgetContactUseCase;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let tx: {
    conversation: { findFirst: jest.Mock; create: jest.Mock };
    message: { create: jest.Mock };
  };

  const baseInput = {
    tenantId: 'tenant-1',
    visitorId: 'visitor-abc',
  };

  const existingConversation = {
    id: 'conv-existing',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    channel: 'WEB_CHAT',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    tx = {
      conversation: { findFirst: jest.fn(), create: jest.fn() },
      message: { create: jest.fn() },
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

    useCase = new InitiateWidgetContactUseCase(
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

    it('falls back to wgt_<hash> when phone absent', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute(baseInput);

      const { createHash } = require('crypto');
      const expectedPhone = `wgt_${createHash('sha256').update('visitor-abc').digest('hex').slice(0, 15)}`;

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ phone: expectedPhone }),
      );
    });

    it('uses visitorName when provided', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute({ ...baseInput, visitorName: 'João Silva' });

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'João Silva' }),
      );
    });

    it('falls back to "Visitante Web" when name absent', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute(baseInput);

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Visitante Web' }),
      );
    });

    it('passes email and cpf to ensureContact', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute({
        ...baseInput,
        visitorEmail: 'user@example.com',
        visitorCpf: '12345678901',
      });

      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', document: '12345678901' }),
      );
    });
  });

  describe('existing conversation', () => {
    it('returns existing conversationId without creating a new one', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      const result = await useCase.execute(baseInput);

      expect(result.conversationId).toBe('conv-existing');
      expect(result.contactId).toBe('contact-1');
      expect(tx.conversation.create).not.toHaveBeenCalled();
    });

    it('does not create init message when conversation exists', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      await useCase.execute(baseInput);

      expect(tx.message.create).not.toHaveBeenCalled();
    });

    it('publishes no events when conversation already exists', async () => {
      tx.conversation.findFirst.mockResolvedValue(existingConversation);

      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      expect(capturedEvents).toHaveLength(0);
    });
  });

  describe('new conversation', () => {
    const newConversation = { id: 'conv-new', tenantId: 'tenant-1', contactId: 'contact-1' };
    const initMessage = { id: 'msg-init' };

    beforeEach(() => {
      tx.conversation.findFirst.mockResolvedValue(null);
      tx.conversation.create.mockResolvedValue(newConversation);
      tx.message.create.mockResolvedValue(initMessage);
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

    it('creates WIDGET_INIT system message', async () => {
      await useCase.execute(baseInput);

      expect(tx.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-new',
            direction: 'INBOUND',
            sentBy: 'SYSTEM',
            deliveryStatus: 'DELIVERED',
          }),
        }),
      );
    });

    it('publishes ConversationCreatedIntegrationEvent and MessageReceivedIntegrationEvent', async () => {
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

    it('includes WEB_CHAT channel in ConversationCreatedIntegrationEvent', async () => {
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

    it('passes quickReplies as contextHints in MessageReceivedIntegrationEvent', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute({ ...baseInput, quickReplies: ['Agendar', 'Ver preços'] });

      const msgEvent = capturedEvents[1];
      expect(msgEvent.payload.contextHints).toEqual(['Agendar', 'Ver preços']);
    });

    it('omits contextHints when quickReplies not provided', async () => {
      const capturedEvents: any[] = [];
      (transactionalEventPublisher.execute as jest.Mock).mockImplementation(async (work: any) => {
        const outcome = await work(tx as any);
        capturedEvents.push(...outcome.events);
        return outcome.result;
      });

      await useCase.execute(baseInput);

      const msgEvent = capturedEvents[1];
      expect(msgEvent.payload.contextHints).toBeUndefined();
    });

    it('returns new conversationId and contactId', async () => {
      const result = await useCase.execute(baseInput);

      expect(result).toEqual({ contactId: 'contact-1', conversationId: 'conv-new' });
    });
  });
});
