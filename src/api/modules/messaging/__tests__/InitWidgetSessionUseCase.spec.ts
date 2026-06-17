import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InitWidgetSessionUseCase } from '../application/use-cases/InitWidgetSessionUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';
import { IWidgetSessionRepository } from '../domain/repositories/IWidgetSessionRepository';
import { InitiateWidgetContactUseCase } from '../application/use-cases/InitiateWidgetContactUseCase';

describe('InitWidgetSessionUseCase', () => {
  let useCase: InitWidgetSessionUseCase;
  let configRepo: jest.Mocked<IWidgetConfigRepository>;
  let sessionRepo: jest.Mocked<IWidgetSessionRepository>;
  let initiateContact: jest.Mocked<Pick<InitiateWidgetContactUseCase, 'execute'>>;

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
    quickReplies: ['Agendar'],
    allowedOrigins: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newSession = {
    id: 'session-new',
    widgetConfigId: 'cfg-1',
    tenantId: 'tenant-1',
    contactId: null,
    conversationId: null,
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
    initiateContact = { execute: jest.fn() };

    useCase = new InitWidgetSessionUseCase(
      configRepo,
      sessionRepo,
      initiateContact as any,
    );
  });

  describe('validation', () => {
    it('throws BadRequestException when visitorId is missing', async () => {
      await expect(
        useCase.execute({ publicToken: 'tok-abc', visitorId: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(configRepo.findByPublicToken).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when config does not exist', async () => {
      configRepo.findByPublicToken.mockResolvedValue(null);

      await expect(
        useCase.execute({ publicToken: 'missing', visitorId: 'visitor-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when widget is disabled', async () => {
      configRepo.findByPublicToken.mockResolvedValue({
        ...config,
        enabled: false,
      });

      await expect(
        useCase.execute({ publicToken: 'tok-abc', visitorId: 'visitor-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('new session', () => {
    beforeEach(() => {
      configRepo.findByPublicToken.mockResolvedValue(config);
      sessionRepo.findActiveByVisitor.mockResolvedValue(null);
      sessionRepo.create.mockResolvedValue(newSession);
      initiateContact.execute.mockResolvedValue({
        contactId: 'contact-1',
        conversationId: 'conv-1',
      });
      sessionRepo.update.mockResolvedValue(newSession);
    });

    it('creates a session, contact and returns resumed=false', async () => {
      const result = await useCase.execute({
        publicToken: 'tok-abc',
        visitorId: 'visitor-1',
        visitorName: 'João',
      });

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          widgetConfigId: 'cfg-1',
          tenantId: 'tenant-1',
          visitorId: 'visitor-1',
          visitorName: 'João',
        }),
      );
      expect(result).toEqual({
        sessionId: 'session-new',
        conversationId: 'conv-1',
        resumed: false,
      });
    });

    it('links contactId and conversationId back onto the session', async () => {
      await useCase.execute({ publicToken: 'tok-abc', visitorId: 'visitor-1' });

      expect(sessionRepo.update).toHaveBeenCalledWith(
        'session-new',
        'tenant-1',
        { contactId: 'contact-1', conversationId: 'conv-1' },
      );
    });

    it('forwards the config quickReplies to initiateContact', async () => {
      await useCase.execute({ publicToken: 'tok-abc', visitorId: 'visitor-1' });

      expect(initiateContact.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          quickReplies: ['Agendar'],
        }),
      );
    });
  });

  describe('resumed session', () => {
    const existing = {
      ...newSession,
      id: 'session-existing',
      visitorName: 'Old Name',
      visitorPhone: '+5511999990000',
      visitorEmail: 'old@example.com',
      visitorCpf: '11111111111',
      pageUrl: '/home',
    };

    beforeEach(() => {
      configRepo.findByPublicToken.mockResolvedValue(config);
      sessionRepo.findActiveByVisitor.mockResolvedValue(existing);
      initiateContact.execute.mockResolvedValue({
        contactId: 'contact-1',
        conversationId: 'conv-resumed',
      });
      sessionRepo.update.mockResolvedValue(existing);
    });

    it('reuses the existing session and returns resumed=true', async () => {
      const result = await useCase.execute({
        publicToken: 'tok-abc',
        visitorId: 'visitor-1',
      });

      expect(sessionRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        sessionId: 'session-existing',
        conversationId: 'conv-resumed',
        resumed: true,
      });
    });

    it('keeps stored visitor fields when new input omits them', async () => {
      await useCase.execute({ publicToken: 'tok-abc', visitorId: 'visitor-1' });

      expect(initiateContact.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          visitorName: 'Old Name',
          visitorPhone: '+5511999990000',
          visitorEmail: 'old@example.com',
          visitorCpf: '11111111111',
        }),
      );
    });

    it('overrides stored visitor fields when new input provides them', async () => {
      await useCase.execute({
        publicToken: 'tok-abc',
        visitorId: 'visitor-1',
        visitorName: 'New Name',
      });

      expect(sessionRepo.update).toHaveBeenCalledWith(
        'session-existing',
        'tenant-1',
        expect.objectContaining({ visitorName: 'New Name' }),
      );
    });
  });

  describe('tenant isolation', () => {
    it('scopes the visitor lookup with the config tenantId, never client input', async () => {
      configRepo.findByPublicToken.mockResolvedValue(config);
      sessionRepo.findActiveByVisitor.mockResolvedValue(null);
      sessionRepo.create.mockResolvedValue(newSession);
      initiateContact.execute.mockResolvedValue({
        contactId: 'contact-1',
        conversationId: 'conv-1',
      });
      sessionRepo.update.mockResolvedValue(newSession);

      await useCase.execute({ publicToken: 'tok-abc', visitorId: 'visitor-1' });

      expect(sessionRepo.findActiveByVisitor).toHaveBeenCalledWith(
        'cfg-1',
        'tenant-1',
        'visitor-1',
      );
    });
  });
});
