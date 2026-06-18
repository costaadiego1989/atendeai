/**
 * T4-D: PrismaProposalRepository.findById cross-tenant isolation test
 * Verifies that findById rejects when proposal belongs to a different tenant.
 * Written BEFORE adding tenantId filter (TDD: red → green).
 */
import { PrismaProposalRepository } from '../../infrastructure/persistence/repositories/PrismaProposalRepository';

describe('PrismaProposalRepository – T4-D findById tenant isolation', () => {
  const tenantAProposal = {
    id: 'proposal-1',
    tenantId: 'tenant-A',
    contactId: 'contact-1',
    userId: 'user-1',
    title: 'Proposta Comercial',
    description: null,
    benefits: null,
    items: [],
    totalAmount: 0,
    status: 'DRAFT',
    validUntil: null,
    scheduledAt: null,
    pdfUrl: null,
    notes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns proposal when tenantId matches', async () => {
    const prisma = {
      proposal: {
        findUnique: jest.fn().mockResolvedValue(tenantAProposal),
      },
    } as any;

    const repo = new PrismaProposalRepository(prisma);
    const result = await repo.findById('proposal-1', 'tenant-A');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('proposal-1');
  });

  it('returns null when proposal exists but belongs to a different tenant (cross-tenant isolation)', async () => {
    // findUnique returns a record owned by tenant-A
    const prisma = {
      proposal: {
        findUnique: jest.fn().mockResolvedValue(tenantAProposal),
      },
    } as any;

    const repo = new PrismaProposalRepository(prisma);
    // Caller claims to be tenant-B — must not see tenant-A's data
    const result = await repo.findById('proposal-1', 'tenant-B');
    expect(result).toBeNull();
  });

  it('passes tenantId in the where clause so the DB rejects the cross-tenant query at DB level', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { proposal: { findUnique } } as any;

    const repo = new PrismaProposalRepository(prisma);
    await repo.findById('proposal-1', 'tenant-A');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      }),
    );
  });

  it('findById without tenantId param falls back to existing behavior (backwards-compat internal callers)', async () => {
    // Internal callers (PDF generation, public link service) may call without tenantId.
    // Those are trusted paths with their own token-based auth.
    const findUnique = jest.fn().mockResolvedValue(tenantAProposal);
    const prisma = { proposal: { findUnique } } as any;

    const repo = new PrismaProposalRepository(prisma);
    const result = await repo.findById('proposal-1');
    expect(result).not.toBeNull();
  });
});
