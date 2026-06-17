import { NotFoundException } from '@nestjs/common';
import { GetWidgetSessionMessagesUseCase } from '../application/use-cases/GetWidgetSessionMessagesUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';
import { IWidgetSessionRepository } from '../domain/repositories/IWidgetSessionRepository';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';

describe('GetWidgetSessionMessagesUseCase', () => {
  let useCase: GetWidgetSessionMessagesUseCase;
  let configRepo: jest.Mocked<IWidgetConfigRepository>;
  let sessionRepo: jest.Mocked<IWidgetSessionRepository>;
  let conversationRepo: jest.Mocked<Pick<IConversationRepository, 'findMessagesByConversation'>>;

  const config = {
    id: 'cfg-1',
    tenantId: 'tenant-1',
    enabled: true,
    publicToken: 'tok-abc',
    name: 'Widget',
    greeting: null,
    color: '#000',
    backgroundColor: null,
    position: 'bottom-right',
    avatarUrl: null,
    collectName: false,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    proactiveDelay: null,
    proactiveMsg: null,
    quickReplies: [],
    allowedOrigins: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const session = {
    id: 'session-1',
    widgetConfigId: 'cfg-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    conversationId: 'conv-1',
    visitorId: 'visitor-1',
    visitorName: null,
    visitorPhone: null,
    visitorEmail: null,
    visitorCpf: null,
    pageUrl: null,
    status: 'ACTIVE',
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  const makeMessage = (over: Record<string, unknown> = {}) => ({
    id: { toString: () => 'msg-1' },
    direction: 'INBOUND',
    contentType: 'TEXT',
    content: { text: 'Olá' },
    sentBy: 'CONTACT',
    createdAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    configRepo = {
      findByPublicToken: jest.fn(),
      findByTenantId: jest.fn(),
      findOrCreate: jest.fn(),
      update: jest.fn(),
      upsertByTenantId: jest.fn(),
      updateAvatar: jest.fn(),
    };
    sessionRepo = {
      findActiveByVisitor: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      close: jest.fn(),
    };
    conversationRepo = { findMessagesByConversation: jest.fn() };

    useCase = new GetWidgetSessionMessagesUseCase(
      configRepo,
      sessionRepo,
      conversationRepo as any,
    );
  });

  it('throws NotFoundException when widget is missing or disabled', async () => {
    configRepo.findByPublicToken.mockResolvedValue(null);

    await expect(
      useCase.execute({ publicToken: 'missing', sessionId: 'session-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns empty list when the session does not exist', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      publicToken: 'tok-abc',
      sessionId: 'session-1',
    });

    expect(result).toEqual({ messages: [] });
    expect(conversationRepo.findMessagesByConversation).not.toHaveBeenCalled();
  });

  it('returns empty list when the session has no conversation yet', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue({ ...session, conversationId: null });

    const result = await useCase.execute({
      publicToken: 'tok-abc',
      sessionId: 'session-1',
    });

    expect(result).toEqual({ messages: [] });
  });

  it('maps and returns messages for a valid session', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(session);
    conversationRepo.findMessagesByConversation.mockResolvedValue({
      data: [makeMessage()],
      total: 1,
    } as any);

    const result = await useCase.execute({
      publicToken: 'tok-abc',
      sessionId: 'session-1',
    });

    expect(result.messages).toEqual([
      expect.objectContaining({
        id: 'msg-1',
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { text: 'Olá' },
        sentBy: 'CONTACT',
      }),
    ]);
  });

  it('filters out SYSTEM messages (e.g. WIDGET_INIT)', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(session);
    conversationRepo.findMessagesByConversation.mockResolvedValue({
      data: [
        makeMessage({ id: { toString: () => 'sys' }, sentBy: 'SYSTEM' }),
        makeMessage({ id: { toString: () => 'visible' }, sentBy: 'AI' }),
      ],
      total: 2,
    } as any);

    const result = await useCase.execute({
      publicToken: 'tok-abc',
      sessionId: 'session-1',
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('visible');
  });

  it('scopes both the session lookup and message fetch by the config tenantId', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(session);
    conversationRepo.findMessagesByConversation.mockResolvedValue({
      data: [],
      total: 0,
    } as any);

    await useCase.execute({ publicToken: 'tok-abc', sessionId: 'session-1' });

    expect(sessionRepo.findById).toHaveBeenCalledWith('session-1', 'tenant-1');
    expect(conversationRepo.findMessagesByConversation).toHaveBeenCalledWith(
      'tenant-1',
      'conv-1',
      1,
      100,
    );
  });
});
