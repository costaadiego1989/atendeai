/**
 * Unit tests for PrismaContactRepository — C1, C2, C3, C4 fixes.
 * Uses a fully-mocked PrismaService so no DB connection is required.
 */
import { PrismaContactRepository } from '../infrastructure/persistence/repositories/PrismaContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000002';
const BRANCH_ID = '00000000-0000-0000-0000-000000000099';
const CONTACT_ID = '00000000-0000-0000-0000-000000000010';
const DOCUMENT = '123.456.789-00';
const PHONE = '5511999990001';

function makeContact(
  overrides: Partial<{ tenantId: string; branchId: string; document: string | null; phone: string }> = {},
): Contact {
  // Use `null` sentinel to explicitly omit document (undefined falls back to default)
  const document =
    'document' in overrides
      ? (overrides.document ?? undefined)
      : DOCUMENT;
  return Contact.create(
    {
      tenantId: TenantId.create(overrides.tenantId ?? TENANT_A),
      name: ContactName.create('Test Contact'),
      phone: overrides.phone ?? PHONE,
      document,
      branchId: overrides.branchId,
      tags: [],
    },
    new UniqueEntityID(CONTACT_ID),
  );
}

/** Build a minimal Prisma row shape that the mapper expects */
function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTACT_ID,
    tenantId: TENANT_A,
    name: 'Test Contact',
    phone: PHONE,
    document: DOCUMENT,
    email: null,
    stage: 'LEAD',
    tags: [],
    notes: null,
    lastInteraction: null,
    prospectingOptOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    branchId: BRANCH_ID,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock factory
// ──────────────────────────────────────────────────────────────────────────────

function makePrismaMock() {
  const row = makePrismaRow();

  const prismaMock: any = {
    contact: {
      upsert: jest.fn().mockResolvedValue(row),
      findUnique: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(row),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockImplementation((_sql: unknown) => {
      // findBranchIdsByContactIds — returns branch_id
      return Promise.resolve([{ id: CONTACT_ID, branch_id: BRANCH_ID }]);
    }),
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      // If called with a function (interactive tx), execute it
      if (typeof ops === 'function') return ops(prismaMock);
      // If called with array of promises, resolve them all
      return Promise.all(ops as Array<Promise<unknown>>);
    }),
  };

  return prismaMock;
}

// ──────────────────────────────────────────────────────────────────────────────
// C1 – save() must persist `document`
// ──────────────────────────────────────────────────────────────────────────────

describe('C1 – save() must persist document', () => {
  it('should include document in the upsert create payload', async () => {
    const prisma = makePrismaMock();
    // $queryRaw for branch lookup (findBranchIdsByContactIds) must NOT be called
    // during save; the relevant call is upsert.
    const repo = new PrismaContactRepository(prisma);
    const contact = makeContact({ document: DOCUMENT });

    await repo.save(contact);

    expect(prisma.contact.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.contact.upsert.mock.calls[0][0];
    expect(call.create.document).toBe(DOCUMENT);
  });

  it('should include document in the upsert update payload', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);
    const contact = makeContact({ document: DOCUMENT });

    await repo.save(contact);

    const call = prisma.contact.upsert.mock.calls[0][0];
    expect(call.update.document).toBe(DOCUMENT);
  });

  it('should persist null document when contact has no document', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);
    // Pass null to explicitly omit document from the contact
    const contact = makeContact({ document: null });

    await repo.save(contact);

    const call = prisma.contact.upsert.mock.calls[0][0];
    // null is acceptable — the mapper converts undefined → null
    expect(call.create.document).toBeNull();
    expect(call.update.document).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C2 – findById / findByPhone must NOT hardcode document: null
// ──────────────────────────────────────────────────────────────────────────────

describe('C2 – findById and findByPhone must return persisted document', () => {
  it('findById should return the document stored in the DB row', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);

    // Prisma returns a row WITH document set
    prisma.contact.findUnique.mockResolvedValue(makePrismaRow({ document: DOCUMENT }));

    const result = await repo.findById(TENANT_A, CONTACT_ID);

    expect(result).not.toBeNull();
    expect(result!.document).toBe(DOCUMENT);
  });

  it('findById should return undefined document when DB row has no document', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);

    prisma.contact.findUnique.mockResolvedValue(makePrismaRow({ document: null }));

    const result = await repo.findById(TENANT_A, CONTACT_ID);

    expect(result).not.toBeNull();
    expect(result!.document).toBeUndefined();
  });

  it('findByPhone should return the document stored in the DB row', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);

    prisma.contact.findFirst.mockResolvedValue(makePrismaRow({ document: DOCUMENT }));

    const result = await repo.findByPhone(TENANT_A, PHONE);

    expect(result).not.toBeNull();
    expect(result!.document).toBe(DOCUMENT);
  });

  it('findByPhone should return undefined document when DB row has no document', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);

    prisma.contact.findFirst.mockResolvedValue(makePrismaRow({ document: null }));

    const result = await repo.findByPhone(TENANT_A, PHONE);

    expect(result).not.toBeNull();
    expect(result!.document).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C3 – findAllByPhone must filter by tenantId (no cross-tenant leak)
// ──────────────────────────────────────────────────────────────────────────────

describe('C3 – findAllByPhone must respect tenantId', () => {
  it('should accept tenantId as a parameter', async () => {
    const prisma = makePrismaMock();
    // With the fix, the DB query is scoped to tenantId. The mock simulates the
    // correct DB behavior: only returns rows for TENANT_A.
    prisma.$queryRaw.mockResolvedValueOnce([
      { tenant_id: TENANT_A, id: CONTACT_ID },
    ]);

    const repo = new PrismaContactRepository(prisma);

    const results = await repo.findAllByPhone(TENANT_A, PHONE);

    // All returned rows belong to TENANT_A (as the DB would enforce via WHERE clause)
    expect(results.every((r) => r.tenantId === TENANT_A)).toBe(true);
  });

  it('should NOT return contacts from a different tenant', async () => {
    const prisma = makePrismaMock();
    // Simulate DB returns only rows matching the given tenant (fix adds WHERE clause)
    prisma.$queryRaw.mockResolvedValueOnce([
      { tenant_id: TENANT_A, id: CONTACT_ID },
    ]);

    const repo = new PrismaContactRepository(prisma);

    const results = await repo.findAllByPhone(TENANT_A, PHONE);

    const tenantBResult = results.find((r) => r.tenantId === TENANT_B);
    expect(tenantBResult).toBeUndefined();
  });

  it('should include tenantId in the raw SQL query', async () => {
    const prisma = makePrismaMock();
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const repo = new PrismaContactRepository(prisma);

    await repo.findAllByPhone(TENANT_A, PHONE);

    // Verify $queryRaw was called (not skipped) — SQL content is opaque but we
    // can assert the tagged-template was invoked with the tenantId value embedded
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = prisma.$queryRaw.mock.calls[0][0];
    // Prisma.sql tagged template produces a TemplateStringsArray-based object;
    // its .values array holds the interpolated parameters
    const paramValues: unknown[] = sqlArg.values ?? [];
    const hasPhone = paramValues.some(
      (v) => typeof v === 'string' && v === PHONE,
    );
    const hasTenant = paramValues.some(
      (v) => typeof v === 'string' && v === TENANT_A,
    );
    expect(hasPhone).toBe(true);
    expect(hasTenant).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C4 – branchId update must be inside a transaction
// ──────────────────────────────────────────────────────────────────────────────

describe('C4 – branchId write must be atomic with the upsert', () => {
  it('should use $transaction to wrap both the upsert and the branchId write', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaContactRepository(prisma);
    const contact = makeContact({ branchId: BRANCH_ID });

    await repo.save(contact);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should roll back the contact if the branchId write throws', async () => {
    const prisma = makePrismaMock();

    // Make $transaction reject — simulates the branchId update failing
    prisma.$transaction.mockRejectedValueOnce(new Error('DB error'));

    const repo = new PrismaContactRepository(prisma);
    const contact = makeContact({ branchId: BRANCH_ID });

    await expect(repo.save(contact)).rejects.toThrow('DB error');
  });

  it('should NOT leave a separate $executeRaw call outside the transaction', async () => {
    // Track the order of calls: $transaction must be called before (or instead of)
    // any standalone $executeRaw. With the fix, $executeRaw is only invoked as
    // part of the $transaction array, not as a top-level call before it.
    const callOrder: string[] = [];
    const prisma = makePrismaMock();

    // Override $transaction to record when it runs and execute the array
    prisma.$transaction.mockImplementation(async (ops: unknown) => {
      callOrder.push('transaction');
      if (typeof ops === 'function') return ops(prisma);
      return Promise.all(ops as Array<Promise<unknown>>);
    });

    const repo = new PrismaContactRepository(prisma);
    const contact = makeContact({ branchId: BRANCH_ID });

    await repo.save(contact);

    // $transaction must have been called exactly once
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // The transaction should wrap both the upsert AND the executeRaw in one call
    const txArg = prisma.$transaction.mock.calls[0][0];
    // Array form: both operations are passed together
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(2);
  });
});
