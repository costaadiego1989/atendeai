/**
 * T2-D security tests: PrismaConversationRepository.findById and findByMessageId
 * must filter by tenantId to prevent cross-tenant reads.
 *
 * TDD: written BEFORE the fix.  These tests FAIL against the current code because
 * the current signatures accept no tenantId.
 */
import { PrismaConversationRepository } from '../infrastructure/persistence/repositories/PrismaConversationRepository';

describe('PrismaConversationRepository – cross-tenant isolation (T2-D)', () => {
  let repo: PrismaConversationRepository;
  let prismaMock: any;

  const conversation = {
    id: 'conv-1',
    tenantId: 'tenant-A',
    contactId: 'contact-1',
    channel: 'WHATSAPP',
    status: 'ACTIVE',
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  beforeEach(() => {
    prismaMock = {
      conversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    repo = new PrismaConversationRepository(prismaMock as any);
  });

  // ── findById ──────────────────────────────────────────────────────────────

  it('T2-D: findById passes tenantId to the query', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(conversation);

    await repo.findById('conv-1', 'tenant-A');

    expect(prismaMock.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'conv-1', tenantId: 'tenant-A' }),
      }),
    );
  });

  it('T2-D: findById returns null when conversation belongs to a different tenant', async () => {
    // DB returns the row but with tenantId tenant-B; the repo should NOT return it
    // when called with tenant-A.  After the fix, the WHERE clause prevents the row
    // from being returned at all — simulate that here.
    prismaMock.conversation.findUnique.mockResolvedValue(null);

    const result = await repo.findById('conv-1', 'tenant-A');

    expect(result).toBeNull();
  });

  // ── findByMessageId ───────────────────────────────────────────────────────

  it('T2-D: findByMessageId passes tenantId to the query', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(conversation);

    await repo.findByMessageId('msg-1', 'tenant-A');

    expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      }),
    );
  });

  it('T2-D: findByMessageId returns null when no row for (messageId, tenantId)', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    const result = await repo.findByMessageId('msg-1', 'tenant-A');

    expect(result).toBeNull();
  });
});
