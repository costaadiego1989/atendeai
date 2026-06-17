import { NotFoundException } from '@nestjs/common';
import { CloseWidgetSessionUseCase } from '../application/use-cases/CloseWidgetSessionUseCase';
import { GetWidgetSessionMessagesUseCase } from '../application/use-cases/GetWidgetSessionMessagesUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';
import { IWidgetSessionRepository } from '../domain/repositories/IWidgetSessionRepository';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';
import { IUpdateConversationStatusUseCase } from '../application/use-cases/interfaces/IUpdateConversationStatusUseCase';

describe('Widget tenant isolation', () => {
  const configA = {
    id: 'cfg-A',
    tenantId: 'tenant-A',
    enabled: true,
    publicToken: 'tok-A',
    name: 'A',
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

  let configRepo: jest.Mocked<IWidgetConfigRepository>;
  let sessionRepo: jest.Mocked<IWidgetSessionRepository>;
  let conversationRepo: jest.Mocked<Pick<IConversationRepository, 'findMessagesByConversation'>>;
  let updateStatus: jest.Mocked<IUpdateConversationStatusUseCase>;

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
    updateStatus = { execute: jest.fn() };
  });

  it('CloseWidgetSession scopes findById to the token tenant, blocking foreign sessions', async () => {
    configRepo.findByPublicToken.mockResolvedValue(configA);
    sessionRepo.findById.mockResolvedValue(null);

    const useCase = new CloseWidgetSessionUseCase(
      configRepo,
      sessionRepo,
      updateStatus,
    );

    await expect(
      useCase.execute({ publicToken: 'tok-A', sessionId: 'session-of-tenant-B' }),
    ).rejects.toThrow(NotFoundException);

    expect(sessionRepo.findById).toHaveBeenCalledWith(
      'session-of-tenant-B',
      'tenant-A',
    );
    expect(sessionRepo.close).not.toHaveBeenCalled();
    expect(updateStatus.execute).not.toHaveBeenCalled();
  });

  it('GetWidgetSessionMessages never queries messages with a tenant other than the token tenant', async () => {
    configRepo.findByPublicToken.mockResolvedValue(configA);
    sessionRepo.findById.mockResolvedValue(null);

    const useCase = new GetWidgetSessionMessagesUseCase(
      configRepo,
      sessionRepo,
      conversationRepo as any,
    );

    const result = await useCase.execute({
      publicToken: 'tok-A',
      sessionId: 'session-of-tenant-B',
    });

    expect(result).toEqual({ messages: [] });
    expect(sessionRepo.findById).toHaveBeenCalledWith(
      'session-of-tenant-B',
      'tenant-A',
    );
    expect(conversationRepo.findMessagesByConversation).not.toHaveBeenCalled();
  });

  it('a disabled widget token grants no access at all', async () => {
    configRepo.findByPublicToken.mockResolvedValue({
      ...configA,
      enabled: false,
    });

    const useCase = new CloseWidgetSessionUseCase(
      configRepo,
      sessionRepo,
      updateStatus,
    );

    await expect(
      useCase.execute({ publicToken: 'tok-A', sessionId: 's1' }),
    ).rejects.toThrow(NotFoundException);
    expect(sessionRepo.findById).not.toHaveBeenCalled();
  });
});