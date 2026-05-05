import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { Conversation } from '../domain/entities/Conversation';
import { Message } from '../domain/entities/Message';
import { MessageContent } from '../domain/value-objects/MessageContent';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../domain/repositories/IConversationRepository';

describe('PrismaConversationRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IConversationRepository;
  let tenantId: string;
  let contactId: string;
  let otherContactId: string;
  const testCnpj = `mc${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IConversationRepository>(CONVERSATION_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Messaging Repository Store',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Conversation',
        phone: '5511912345678',
        stage: 'LEAD',
      },
    });
    contactId = contact.id;

    const otherContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Another Lead',
        phone: '5511912345679',
        stage: 'LEAD',
      },
    });
    otherContactId = otherContact.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.message
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await prisma.conversation.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should save and retrieve a conversation with its messages', async () => {
    const conversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(contactId),
      channel: 'WHATSAPP',
    });
    const message = Message.create({
      conversationId: conversation.id,
      direction: 'INBOUND',
      contentType: 'TEXT',
      content: MessageContent.createText('Oi, quero comprar'),
      sentBy: 'CONTACT',
      externalId: `ext-${Date.now()}`,
    });
    conversation.addMessage(message);

    await repository.save(conversation);

    const result = await repository.findById(conversation.id.toString());

    expect(result).not.toBeNull();
    expect(result?.status).toBe('ACTIVE');
    expect(result?.messages).toHaveLength(1);
    expect(result?.messages[0]?.externalId).toBe(message.externalId);
  });

  it('should find active conversations by contact and external message id', async () => {
    const conversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(contactId),
      channel: 'WHATSAPP',
    });
    const message = Message.create({
      conversationId: conversation.id,
      direction: 'INBOUND',
      contentType: 'TEXT',
      content: MessageContent.createText('Mensagem unica'),
      sentBy: 'CONTACT',
      externalId: `ext-find-${Date.now()}`,
    });
    conversation.addMessage(message);
    await repository.save(conversation);

    const byContact = await repository.findActiveByContact(tenantId, contactId);
    const byExternalId = await repository.findByExternalMessageId(
      message.externalId!,
    );
    const byMessageId = await repository.findByMessageId(message.id.toString());

    expect(byContact).not.toBeNull();
    expect(byExternalId?.id.toString()).toBe(conversation.id.toString());
    expect(byMessageId?.id.toString()).toBe(conversation.id.toString());
  });

  it('should paginate conversations and message history', async () => {
    const activeConversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(contactId),
      channel: 'WHATSAPP',
    });
    activeConversation.addMessage(
      Message.create({
        conversationId: activeConversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Primeira'),
        sentBy: 'CONTACT',
      }),
    );
    activeConversation.addMessage(
      Message.create({
        conversationId: activeConversation.id,
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Segunda'),
        sentBy: 'AI',
      }),
    );

    const archivedConversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(otherContactId),
      channel: 'WHATSAPP',
    });
    archivedConversation.archive();

    await repository.save(activeConversation);
    await repository.save(archivedConversation);

    const pagedConversations = await repository.findAllByTenant(tenantId, {
      page: 1,
      limit: 1,
      status: 'ACTIVE',
    });
    const pagedMessages = await repository.findMessagesByConversation(
      activeConversation.id.toString(),
      1,
      1,
    );

    expect(pagedConversations.total).toBeGreaterThanOrEqual(1);
    expect(pagedConversations.data).toHaveLength(1);
    expect(pagedConversations.data[0]?.status).toBe('ACTIVE');

    expect(pagedMessages.total).toBe(2);
    expect(pagedMessages.data).toHaveLength(1);
    expect(pagedMessages.data[0]?.content.text).toBeDefined();
  });

  it('should persist and read queue state for the inbox', async () => {
    const conversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(contactId),
      channel: 'WHATSAPP',
    });

    conversation.addMessage(
      Message.create({
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Mensagem enviada'),
        sentBy: 'AI',
      }),
    );
    conversation.addMessage(
      Message.create({
        conversationId: conversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Cliente respondeu'),
        sentBy: 'CONTACT',
      }),
    );

    await repository.save(conversation);

    const queueState = await repository.findQueueState(tenantId, [
      conversation.id.toString(),
    ]);

    expect(queueState[conversation.id.toString()]).toEqual(
      expect.objectContaining({
        unreadCount: 1,
        lastMessageDirection: 'INBOUND',
        lastMessagePreview: 'Cliente respondeu',
      }),
    );
    expect(queueState[conversation.id.toString()].lastInboundAt).toBeInstanceOf(Date);
    expect(queueState[conversation.id.toString()].lastOutboundAt).toBeInstanceOf(Date);
  });

  it('should clear unread count after marking a conversation as read', async () => {
    const conversation = Conversation.create({
      tenantId: TenantId.create(tenantId),
      contactId: new UniqueEntityID(contactId),
      channel: 'WHATSAPP',
    });

    conversation.addMessage(
      Message.create({
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Posso te ajudar?'),
        sentBy: 'AI',
      }),
    );
    conversation.addMessage(
      Message.create({
        conversationId: conversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: MessageContent.createText('Quero saber o valor'),
        sentBy: 'CONTACT',
      }),
    );

    await repository.save(conversation);

    const beforeRead = await repository.findQueueState(tenantId, [
      conversation.id.toString(),
    ]);
    expect(beforeRead[conversation.id.toString()]).toEqual(
      expect.objectContaining({
        unreadCount: 1,
      }),
    );

    await repository.markAsRead(tenantId, conversation.id.toString());

    const afterRead = await repository.findQueueState(tenantId, [
      conversation.id.toString(),
    ]);
    expect(afterRead[conversation.id.toString()]).toEqual(
      expect.objectContaining({
        unreadCount: 0,
      }),
    );
  });
});
