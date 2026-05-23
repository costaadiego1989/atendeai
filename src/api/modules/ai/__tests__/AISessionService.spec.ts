import { AISessionService } from '../application/services/AISessionService';
import {
  IAISessionRepository,
  AISessionDto,
} from '../application/ports/IAISessionRepository';

function makeSessionDto(overrides: Partial<AISessionDto> = {}): AISessionDto {
  return {
    id: 'session-123',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    status: 'ACTIVE',
    totalTokens: 0,
    metadata: {},
    ...overrides,
  };
}

describe('AISessionService', () => {
  let repository: jest.Mocked<IAISessionRepository>;
  let service: AISessionService;

  beforeEach(() => {
    repository = {
      findActive: jest.fn(),
      createActive: jest.fn(),
      recordMessage: jest.fn(),
      close: jest.fn(),
    };
    service = new AISessionService(repository);
  });

  describe('getOrCreateSession', () => {
    it('should return existing active session when found', async () => {
      const existing = makeSessionDto();
      repository.findActive.mockResolvedValue(existing);

      const result = await service.getOrCreateSession(
        'tenant-1',
        'contact-1',
        'conv-1',
      );

      expect(result).toBe(existing);
      expect(repository.findActive).toHaveBeenCalledWith(
        'tenant-1',
        'contact-1',
        'conv-1',
      );
      expect(repository.createActive).not.toHaveBeenCalled();
    });

    it('should create a new session when no active session exists', async () => {
      const created = makeSessionDto({ id: 'session-new' });
      repository.findActive.mockResolvedValue(null);
      repository.createActive.mockResolvedValue(created);

      const result = await service.getOrCreateSession(
        'tenant-1',
        'contact-1',
        'conv-1',
      );

      expect(result).toBe(created);
      expect(repository.findActive).toHaveBeenCalledWith(
        'tenant-1',
        'contact-1',
        'conv-1',
      );
      expect(repository.createActive).toHaveBeenCalledWith(
        'tenant-1',
        'contact-1',
        'conv-1',
      );
    });
  });

  describe('recordMessage', () => {
    it('should record a message with tenantId, tokens and diagnostics', async () => {
      repository.recordMessage.mockResolvedValue(undefined);

      await service.recordMessage(
        'tenant-1',
        'session-123',
        'user',
        'Olá',
        10,
        { latency: 200 },
      );

      expect(repository.recordMessage).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sessionId: 'session-123',
        role: 'user',
        content: 'Olá',
        tokens: 10,
        diagnostics: { latency: 200 },
      });
    });

    it('should default tokens to 0 and diagnostics to empty object', async () => {
      repository.recordMessage.mockResolvedValue(undefined);

      await service.recordMessage(
        'tenant-1',
        'session-123',
        'assistant',
        'Resposta',
      );

      expect(repository.recordMessage).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sessionId: 'session-123',
        role: 'assistant',
        content: 'Resposta',
        tokens: 0,
        diagnostics: {},
      });
    });

    it('should forward the tenantId so the repository can scope the write', async () => {
      repository.recordMessage.mockResolvedValue(undefined);

      await service.recordMessage(
        'tenant-1',
        'session-123',
        'system',
        'System prompt',
        5,
      );

      expect(repository.recordMessage).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });
  });

  describe('closeSession', () => {
    it('should close session with CLOSED status by default', async () => {
      repository.close.mockResolvedValue(undefined);

      await service.closeSession('tenant-1', 'session-123');

      expect(repository.close).toHaveBeenCalledWith(
        'tenant-1',
        'session-123',
        'CLOSED',
      );
    });

    it('should close session with EXPIRED status scoped by tenantId', async () => {
      repository.close.mockResolvedValue(undefined);

      await service.closeSession('tenant-1', 'session-123', 'EXPIRED');

      expect(repository.close).toHaveBeenCalledWith(
        'tenant-1',
        'session-123',
        'EXPIRED',
      );
    });

    it('should close session with HANDOFF status scoped by tenantId', async () => {
      repository.close.mockResolvedValue(undefined);

      await service.closeSession('tenant-1', 'session-123', 'HANDOFF');

      expect(repository.close).toHaveBeenCalledWith(
        'tenant-1',
        'session-123',
        'HANDOFF',
      );
    });
  });
});
