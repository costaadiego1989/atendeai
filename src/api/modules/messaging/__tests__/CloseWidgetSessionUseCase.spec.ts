import { NotFoundException } from '@nestjs/common';
import { CloseWidgetSessionUseCase } from '../application/use-cases/CloseWidgetSessionUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';
import { IWidgetSessionRepository } from '../domain/repositories/IWidgetSessionRepository';
import { IUpdateConversationStatusUseCase } from '../application/use-cases/interfaces/IUpdateConversationStatusUseCase';

describe('CloseWidgetSessionUseCase', () => {
  let useCase: CloseWidgetSessionUseCase;
  let configRepo: jest.Mocked<IWidgetConfigRepository>;
  let sessionRepo: jest.Mocked<IWidgetSessionRepository>;
  let updateStatus: jest.Mocked<IUpdateConversationStatusUseCase>;

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
    updateStatus = { execute: jest.fn() };

    useCase = new CloseWidgetSessionUseCase(
      configRepo,
      sessionRepo,
      updateStatus,
    );
  });

  it('throws NotFoundException when widget is missing or disabled', async () => {
    configRepo.findByPublicToken.mockResolvedValue(null);

    await expect(
      useCase.execute({ publicToken: 'missing', sessionId: 'session-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the session does not exist', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ publicToken: 'tok-abc', sessionId: 'nope' }),
    ).rejects.toThrow(NotFoundException);
    expect(sessionRepo.close).not.toHaveBeenCalled();
  });

  it('closes the session and archives the linked conversation', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(session);
    sessionRepo.close.mockResolvedValue(undefined);
    updateStatus.execute.mockResolvedValue({ id: 'conv-1', status: 'ARCHIVED' });

    await useCase.execute({ publicToken: 'tok-abc', sessionId: 'session-1' });

    expect(sessionRepo.close).toHaveBeenCalledWith('session-1', 'tenant-1');
    expect(updateStatus.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      status: 'ARCHIVED',
    });
  });

  it('closes the session but skips archiving when no conversation is linked', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue({ ...session, conversationId: null });
    sessionRepo.close.mockResolvedValue(undefined);

    await useCase.execute({ publicToken: 'tok-abc', sessionId: 'session-1' });

    expect(sessionRepo.close).toHaveBeenCalledWith('session-1', 'tenant-1');
    expect(updateStatus.execute).not.toHaveBeenCalled();
  });

  it('scopes the session lookup by the config tenantId', async () => {
    configRepo.findByPublicToken.mockResolvedValue(config);
    sessionRepo.findById.mockResolvedValue(session);
    sessionRepo.close.mockResolvedValue(undefined);
    updateStatus.execute.mockResolvedValue({ id: 'conv-1', status: 'ARCHIVED' });

    await useCase.execute({ publicToken: 'tok-abc', sessionId: 'session-1' });

    expect(sessionRepo.findById).toHaveBeenCalledWith('session-1', 'tenant-1');
  });
});
