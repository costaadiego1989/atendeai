import { PrismaAISessionRepository } from '../infrastructure/persistence/PrismaAISessionRepository';
import { AISessionMessageData } from '../application/ports/IAISessionRepository';

describe('PrismaAISessionRepository (tenant isolation)', () => {
  let prisma: {
    aISession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    aIMessage: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let repo: PrismaAISessionRepository;

  beforeEach(() => {
    prisma = {
      aISession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockReturnValue({ __op: 'updateMany' }),
      },
      aIMessage: { create: jest.fn().mockReturnValue({ __op: 'create' }) },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    repo = new PrismaAISessionRepository(prisma as never);
  });

  const message = (overrides: Partial<AISessionMessageData> = {}): AISessionMessageData => ({
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'hello',
    tokens: 5,
    diagnostics: {},
    ...overrides,
  });

  describe('recordMessage', () => {
    it('scopes the session token update by tenantId (updateMany with id + tenantId)', async () => {
      await repo.recordMessage(message());

      expect(prisma.aISession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('does not update a session belonging to another tenant', async () => {
      await repo.recordMessage(message({ tenantId: 'tenant-victim' }));

      const call = prisma.aISession.updateMany.mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant-victim');
      expect(call.where).not.toEqual({ id: 'session-1' });
    });
  });

  describe('close', () => {
    it('scopes the close by tenantId (updateMany with id + tenantId)', async () => {
      await repo.close('tenant-1', 'session-1', 'HANDOFF');

      expect(prisma.aISession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', tenantId: 'tenant-1' },
        data: expect.objectContaining({ status: 'HANDOFF' }),
      });
    });
  });
});
