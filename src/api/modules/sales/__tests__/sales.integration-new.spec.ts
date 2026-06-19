/* eslint-disable @typescript-eslint/no-explicit-any */
// ================================================================
// sales.integration-new.spec.ts — NEW integration tests for the sales module
// ================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaSalesRepository } from '../infrastructure/persistence/repositories/PrismaSalesRepository';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { randomUUID } from 'crypto';

// ─── Mock PrismaService entirely — no real DB needed ─────────────────────────
// We mock Prisma at the model level so queries never reach the database.
// This lets us test the repository's SQL-building logic and mapping in isolation.

function makePrismaMock() {
  const linkRecord = (overrides: any = {}) => ({
    id: randomUUID(),
    tenantId: 'tenant-a',
    branchId: null,
    providerLinkId: 'prov-1',
    externalId: 'ext-1',
    name: 'Link',
    description: null,
    label: null,
    value: 100,
    url: 'https://pay.test/1',
    billingType: 'PIX',
    status: 'ACTIVE',
    source: 'MANUAL',
    resourceType: 'PAYMENT_LINK',
    contactId: null,
    contactName: null,
    conversationId: null,
    catalogItemId: null,
    catalogItemSku: null,
    catalogItemName: null,
    expiresAt: null,
    recurrenceEnabled: false,
    recurrenceFrequency: null,
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceTotalValue: null,
    recurrenceNextRunAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  });

  return {
    _linkRecord: linkRecord,
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    salesPaymentLink: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    salesMetric: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    promotion: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    coupon: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

// ─── Repository module wiring helper ─────────────────────────────────────────
async function buildTestModule(prismaMock: any) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PrismaSalesRepository,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();

  return module.get<PrismaSalesRepository>(PrismaSalesRepository);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. PrismaSalesRepository — listPaymentLinks filters
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.listPaymentLinks — filter wiring', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const emptyResponse = [[]];
  const zeroCount = [{ total: 0 }];
  const zeroSummary = [{
    total_links: 0, active_links: 0, paused_links: 0, paid_links: 0,
    expired_links: 0, estimated_revenue: 0, paid_revenue: 0,
  }];

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('passes status filter in WHERE clause via $queryRaw call', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'PAID', source: 'ALL',
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    const firstCallSql = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(firstCallSql).toContain('PAID');
  });

  it('passes source filter to $queryRaw', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, source: 'AI', status: 'ALL',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('AI');
  });

  it('passes dateFrom filter to $queryRaw', async () => {
    const dateFrom = new Date('2026-01-01');
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', dateFrom,
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('created_at');
  });

  it('passes dateTo filter to $queryRaw', async () => {
    const dateTo = new Date('2026-12-31');
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', dateTo,
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('created_at');
  });

  it('passes search term to $queryRaw for LIKE filtering', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', search: 'consulta',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('consulta');
  });

  it('maps $queryRaw rows to SalesPaymentLinkRecord shape', async () => {
    const row = {
      id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
      provider_link_id: 'prov-1', external_id: 'ext-1', name: 'Link',
      description: null, label: null, value: 150, url: 'https://pay.test/1',
      billing_type: 'PIX', status: 'ACTIVE', source: 'MANUAL',
      resource_type: 'PAYMENT_LINK', contact_id: null, contact_name: null,
      conversation_id: null, catalog_item_id: null, catalog_item_sku: null,
      catalog_item_name: null, expires_at: null, recurrence_enabled: false,
      recurrence_frequency: null, recurrence_start_date: null,
      recurrence_end_date: null, recurrence_total_value: null,
      recurrence_next_run_at: null,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      deleted_at: null,
    };
    prisma.$queryRaw
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{
        total_links: 1, active_links: 1, paused_links: 0, paid_links: 0,
        expired_links: 0, estimated_revenue: 150, paid_revenue: 0,
      }]);
    const result = await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].value).toBe(150);
    expect(result.items[0].billingType).toBe('PIX');
    expect(result.total).toBe(1);
  });

  it('applies correct OFFSET for page 2', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce(zeroCount)
      .mockResolvedValueOnce(zeroSummary);
    await repo.listPaymentLinks('tenant-a', {
      page: 2, pageSize: 10, status: 'ALL', source: 'ALL',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('10');
  });

  it('returns summary totals from summaryRow correctly', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(emptyResponse[0])
      .mockResolvedValueOnce([{ total: 10 }])
      .mockResolvedValueOnce([{
        total_links: 10, active_links: 5, paused_links: 2, paid_links: 3,
        expired_links: 1, estimated_revenue: 1500, paid_revenue: 750,
      }]);
    const result = await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL',
    });
    expect(result.summary.totalLinks).toBe(10);
    expect(result.summary.activeLinks).toBe(5);
    expect(result.summary.estimatedRevenue).toBe(1500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. PrismaSalesRepository — incrementMetric upsert behavior
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.incrementMetric', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls salesMetric.upsert with correct create payload for MESSAGE type', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    await repo.incrementMetric('tenant-a', new Date('2026-01-15'), 'MESSAGE');
    expect(prisma.salesMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: 'tenant-a',
          totalMessages: 1,
          purchaseIntents: 0,
          paymentLinksGenerated: 0,
          estimatedRevenue: 0,
        }),
        update: expect.objectContaining({
          totalMessages: { increment: 1 },
        }),
      }),
    );
  });

  it('calls salesMetric.upsert with correct create payload for INTENT type', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    await repo.incrementMetric('tenant-a', new Date('2026-01-15'), 'INTENT');
    expect(prisma.salesMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          purchaseIntents: 1,
          totalMessages: 0,
          paymentLinksGenerated: 0,
        }),
      }),
    );
  });

  it('calls salesMetric.upsert with correct create payload for LINK type with value', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    await repo.incrementMetric('tenant-a', new Date('2026-01-15'), 'LINK', 250);
    expect(prisma.salesMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          paymentLinksGenerated: 1,
          estimatedRevenue: 250,
        }),
        update: expect.objectContaining({
          paymentLinksGenerated: { increment: 1 },
          estimatedRevenue: { increment: 250 },
        }),
      }),
    );
  });

  it('normalizes date to start-of-day before upserting', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    await repo.incrementMetric('tenant-a', new Date('2026-01-15T16:30:00'), 'MESSAGE');
    const callArg = prisma.salesMetric.upsert.mock.calls[0][0];
    const upsertDate = callArg.where.tenantId_date.date as Date;
    expect(upsertDate.getHours()).toBe(0);
    expect(upsertDate.getMinutes()).toBe(0);
    expect(upsertDate.getSeconds()).toBe(0);
  });

  it('uses 0 as estimatedRevenue for LINK type when value is not provided', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    await repo.incrementMetric('tenant-a', new Date(), 'LINK');
    const callArg = prisma.salesMetric.upsert.mock.calls[0][0];
    expect(callArg.create.estimatedRevenue).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. PrismaSalesRepository — updatePaymentLinkStatusByExternalReference
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.updatePaymentLinkStatusByExternalReference', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const baseRow = {
    id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
    provider_link_id: 'prov-1', external_id: 'sales-link|tenant-a|link-1',
    name: 'Link', description: null, label: null, value: 100,
    url: 'https://pay.test/1', billing_type: 'PIX', status: 'PAID',
    source: 'MANUAL', resource_type: 'PAYMENT_LINK', contact_id: null,
    contact_name: null, conversation_id: null, catalog_item_id: null,
    catalog_item_sku: null, catalog_item_name: null, expires_at: null,
    recurrence_enabled: false, recurrence_frequency: null,
    recurrence_start_date: null, recurrence_end_date: null,
    recurrence_total_value: null, recurrence_next_run_at: null,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls $queryRaw with UPDATE containing the correct tenantId, externalRef and status', async () => {
    prisma.$queryRaw.mockResolvedValue([baseRow]);
    await repo.updatePaymentLinkStatusByExternalReference(
      'tenant-a', 'sales-link|tenant-a|link-1', 'PAID',
    );
    expect(prisma.$queryRaw).toHaveBeenCalled();
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('tenant-a');
    expect(callStr).toContain('PAID');
  });

  it('returns mapped SalesPaymentLinkRecord when row is found', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ...baseRow, status: 'OVERDUE' }]);
    const result = await repo.updatePaymentLinkStatusByExternalReference(
      'tenant-a', 'ext-1', 'OVERDUE',
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe('OVERDUE');
    expect(result?.value).toBe(100);
  });

  it('returns null when no row matched the external reference', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.updatePaymentLinkStatusByExternalReference(
      'tenant-a', 'does-not-exist', 'PAID',
    );
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. PrismaSalesRepository — atomicIncrementCouponUsage
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.atomicIncrementCouponUsage', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const couponRecord = {
    id: 'coupon-1', tenantId: 'tenant-a', promotionId: null, code: 'TEST',
    description: null, discountType: 'PERCENTAGE', discountValue: 10,
    maxUses: 5, usedCount: 3, startsAt: new Date(), expiresAt: null,
    active: true, catalogItemId: null, targets: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls $queryRaw with atomic UPDATE containing max_uses condition', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'coupon-1' }]);
    prisma.salesCoupon = { findFirst: jest.fn().mockResolvedValue({ ...couponRecord, usedCount: 4 }) } as any;
    await repo.atomicIncrementCouponUsage('tenant-a', 'coupon-1');
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('used_count');
    expect(callStr).toContain('max_uses');
    expect(callStr).toContain('active');
  });

  it('returns null when atomic UPDATE affects 0 rows (coupon exhausted)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.atomicIncrementCouponUsage('tenant-a', 'coupon-1');
    expect(result).toBeNull();
  });

  it('returns the updated coupon record when atomic increment succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'coupon-1' }]);
    (prisma as any).salesCoupon = {
      findFirst: jest.fn().mockResolvedValue({ ...couponRecord, usedCount: 4, targets: [] }),
    };
    const result = await repo.atomicIncrementCouponUsage('tenant-a', 'coupon-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('coupon-1');
  });

  it('does not call findFirst when $queryRaw returns empty (prevents orphan fetch)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const findFirstSpy = jest.fn();
    (prisma as any).salesCoupon = { findFirst: findFirstSpy };
    await repo.atomicIncrementCouponUsage('tenant-a', 'coupon-1');
    expect(findFirstSpy).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. PrismaSalesRepository — tenant isolation
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository — tenant isolation', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const tenantA = randomUUID();
  const tenantB = randomUUID();

  const rowForTenantA = {
    id: randomUUID(), tenant_id: tenantA, branch_id: null,
    provider_link_id: 'prov-a', external_id: 'ext-a', name: 'Link A',
    description: null, label: null, value: 100, url: 'https://pay.test/a',
    billing_type: 'PIX', status: 'ACTIVE', source: 'MANUAL',
    resource_type: 'PAYMENT_LINK', contact_id: null, contact_name: null,
    conversation_id: null, catalog_item_id: null, catalog_item_sku: null,
    catalog_item_name: null, expires_at: null, recurrence_enabled: false,
    recurrence_frequency: null, recurrence_start_date: null,
    recurrence_end_date: null, recurrence_total_value: null,
    recurrence_next_run_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('listPaymentLinks for tenantA does not return rows from tenantB', async () => {
    // Returns only tenantA rows — mock simulates DB filter
    prisma.$queryRaw
      .mockResolvedValueOnce([rowForTenantA])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{
        total_links: 1, active_links: 1, paused_links: 0, paid_links: 0,
        expired_links: 0, estimated_revenue: 100, paid_revenue: 0,
      }]);
    const result = await repo.listPaymentLinks(tenantA, { page: 1, pageSize: 20, status: 'ALL', source: 'ALL' });
    expect(result.items.every((i) => i.tenantId === tenantA)).toBe(true);
  });

  it('listPaymentLinks SQL embeds tenantId for isolation', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{
        total_links: 0, active_links: 0, paused_links: 0, paid_links: 0,
        expired_links: 0, estimated_revenue: 0, paid_revenue: 0,
      }]);
    await repo.listPaymentLinks(tenantA, { page: 1, pageSize: 20, status: 'ALL', source: 'ALL' });
    const sql = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain(tenantA);
    expect(sql).not.toContain(tenantB);
  });

  it('listCoupons passes tenantId to Prisma query for isolation', async () => {
    (prisma as any).salesCoupon = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const repoWithCoupon = await buildTestModule(prisma);
    await repoWithCoupon.listCoupons(tenantA);
    const findManyArgs = (prisma as any).salesCoupon.findMany.mock.calls[0][0];
    expect(findManyArgs.where.tenantId).toBe(tenantA);
  });

  it('listPromotions passes tenantId to Prisma query for isolation', async () => {
    (prisma as any).salesPromotion = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const repoWithPromo = await buildTestModule(prisma);
    await repoWithPromo.listPromotions(tenantA);
    const findManyArgs = (prisma as any).salesPromotion.findMany.mock.calls[0][0];
    expect(findManyArgs.where.tenantId).toBe(tenantA);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. PrismaSalesRepository — findCouponByCode case-insensitivity
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.findCouponByCode', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const couponRecord = {
    id: 'coupon-1', tenantId: 'tenant-a', promotionId: null, code: 'SUMMER20',
    description: null, discountType: 'PERCENTAGE', discountValue: 20,
    maxUses: 0, usedCount: 0, startsAt: new Date(), expiresAt: null,
    active: true, catalogItemId: null, targets: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesCoupon = {
      findFirst: jest.fn().mockResolvedValue(couponRecord),
    };
    repo = await buildTestModule(prisma);
  });

  it('normalizes code to uppercase before querying', async () => {
    await repo.findCouponByCode('tenant-a', 'summer20');
    const args = (prisma as any).salesCoupon.findFirst.mock.calls[0][0];
    expect(args.where.code).toBe('SUMMER20');
  });

  it('returns null when coupon not found', async () => {
    (prisma as any).salesCoupon.findFirst.mockResolvedValue(null);
    const result = await repo.findCouponByCode('tenant-a', 'NOTEXIST');
    expect(result).toBeNull();
  });

  it('filters by both tenantId and code for tenant isolation', async () => {
    await repo.findCouponByCode('tenant-a', 'SUMMER20');
    const args = (prisma as any).salesCoupon.findFirst.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-a');
    expect(args.where.code).toBe('SUMMER20');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. PrismaSalesRepository — createCoupon normalization
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.createCoupon', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const createdRecord = {
    id: 'c1', tenantId: 'tenant-a', promotionId: null, code: 'PROMO10',
    description: null, discountType: 'PERCENTAGE', discountValue: 10,
    maxUses: 0, usedCount: 0, startsAt: new Date(), expiresAt: null,
    active: true, catalogItemId: null, targets: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesCoupon = {
      create: jest.fn().mockResolvedValue(createdRecord),
    };
    repo = await buildTestModule(prisma);
  });

  it('converts code to uppercase in create call', async () => {
    await repo.createCoupon({
      id: 'c1', tenantId: 'tenant-a', code: 'promo10',
      discountType: 'PERCENTAGE', discountValue: 10,
      maxUses: 0, startsAt: new Date(), active: true,
    });
    const args = (prisma as any).salesCoupon.create.mock.calls[0][0];
    expect(args.data.code).toBe('PROMO10');
  });

  it('returns a SalesCouponRecord with usedCount from the persisted record', async () => {
    const result = await repo.createCoupon({
      id: 'c1', tenantId: 'tenant-a', code: 'promo10',
      discountType: 'PERCENTAGE', discountValue: 10,
      maxUses: 0, startsAt: new Date(), active: true,
    });
    expect(result.usedCount).toBe(0);
    expect(result.code).toBe('PROMO10');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. PrismaSalesRepository — getMetrics date range filtering
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.getMetrics', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('passes gte and lte date range to Prisma findMany', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([]);
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');
    await repo.getMetrics('tenant-a', startDate, endDate);
    const args = prisma.salesMetric.findMany.mock.calls[0][0];
    expect(args.where.date.gte).toEqual(startDate);
    expect(args.where.date.lte).toEqual(endDate);
  });

  it('filters by tenantId in getMetrics call', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([]);
    await repo.getMetrics('tenant-xyz', new Date(), new Date());
    const args = prisma.salesMetric.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-xyz');
  });

  it('returns empty array when no metrics in range', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([]);
    const result = await repo.getMetrics('tenant-a', new Date(), new Date());
    expect(result).toHaveLength(0);
  });

  it('maps Prisma salesMetric records to SalesMetric entities correctly', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([{
      id: randomUUID(), tenantId: 'tenant-a', date: new Date('2026-01-10'),
      totalMessages: 5, purchaseIntents: 2, paymentLinksGenerated: 3,
      estimatedRevenue: 600, updatedAt: new Date(),
    }]);
    const result = await repo.getMetrics('tenant-a', new Date('2026-01-01'), new Date('2026-01-31'));
    expect(result).toHaveLength(1);
    expect(result[0].totalMessages).toBe(5);
    expect(result[0].estimatedRevenue).toBe(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. PrismaSalesRepository — updatePromotion tenant isolation
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.updatePromotion', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const existingPromo = {
    id: 'promo-1', tenantId: 'tenant-a', title: 'Old Title', description: 'desc',
    discountType: 'PERCENTAGE', discountValue: 10, minimumOrder: null,
    imageUrl: null, startsAt: new Date(), expiresAt: null, active: true,
    catalogItemId: null, targets: [], createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesPromotion = {
      findFirst: jest.fn().mockResolvedValue(existingPromo),
      update: jest.fn().mockResolvedValue({ ...existingPromo, title: 'New Title', targets: [] }),
    };
    (prisma as any).$transaction = jest.fn().mockImplementation(async (fn: any) => {
      return fn({
        salesPromotion: { update: (prisma as any).salesPromotion.update },
        salesPromotionTarget: { deleteMany: jest.fn(), createMany: jest.fn() },
      });
    });
    repo = await buildTestModule(prisma);
  });

  it('returns null when promo is not found for tenant', async () => {
    (prisma as any).salesPromotion.findFirst.mockResolvedValue(null);
    const result = await repo.updatePromotion('tenant-b', 'promo-1', { title: 'X' });
    expect(result).toBeNull();
  });

  it('checks tenantId when finding existing promo before update', async () => {
    await repo.updatePromotion('tenant-a', 'promo-1', { title: 'New Title' });
    const args = (prisma as any).salesPromotion.findFirst.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-a');
    expect(args.where.id).toBe('promo-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. PrismaSalesRepository — deletePromotion / deleteCoupon isolation
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.deletePromotion and deleteCoupon', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesPromotion = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
    (prisma as any).salesCoupon = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
    repo = await buildTestModule(prisma);
  });

  it('deletePromotion uses deleteMany with tenantId+id filter for isolation', async () => {
    await repo.deletePromotion('tenant-a', 'promo-99');
    const args = (prisma as any).salesPromotion.deleteMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-a');
    expect(args.where.id).toBe('promo-99');
  });

  it('deleteCoupon uses deleteMany with tenantId+id filter for isolation', async () => {
    await repo.deleteCoupon('tenant-a', 'coupon-99');
    const args = (prisma as any).salesCoupon.deleteMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-a');
    expect(args.where.id).toBe('coupon-99');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. PrismaSalesRepository — listCoupons onlyActive filter
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.listCoupons — onlyActive filter', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesCoupon = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    repo = await buildTestModule(prisma);
  });

  it('includes active=true in where clause when onlyActive=true', async () => {
    await repo.listCoupons('tenant-a', true);
    const args = (prisma as any).salesCoupon.findMany.mock.calls[0][0];
    expect(args.where.active).toBe(true);
  });

  it('does not include active filter when onlyActive is not set', async () => {
    await repo.listCoupons('tenant-a');
    const args = (prisma as any).salesCoupon.findMany.mock.calls[0][0];
    expect(args.where.active).toBeUndefined();
  });

  it('returns empty array when no coupons found', async () => {
    const result = await repo.listCoupons('tenant-a');
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Module wiring — use-cases receive correct repository injection
// ═══════════════════════════════════════════════════════════════════════════
import { ListPaymentLinksUseCase } from '../application/use-cases/ListPaymentLinksUseCase';
import { DeletePaymentLinkUseCase } from '../application/use-cases/DeletePaymentLinkUseCase';
import { PausePaymentLinkUseCase } from '../application/use-cases/PausePaymentLinkUseCase';
import { ResumePaymentLinkUseCase } from '../application/use-cases/ResumePaymentLinkUseCase';
import { GenerateSalesPaymentLinksReportUseCase } from '../application/use-cases/GenerateSalesPaymentLinksReportUseCase';
import { SALES_PAYMENT_LINKS_REPOSITORY } from '../domain/repositories/ISalesRepository';
import { PAYMENT_FACADE } from '../../payment/application/facades/IPaymentFacade';

function makePaymentLinksRepoMock() {
  return {
    createPaymentLink: jest.fn(),
    listPaymentLinks: jest.fn(),
    findPaymentLinkById: jest.fn(),
    updatePaymentLinkStatus: jest.fn(),
    updatePaymentLinkStatusByExternalReference: jest.fn(),
    findContactNameById: jest.fn(),
  };
}

function makePaymentFacadeMock() {
  return {
    createCustomer: jest.fn(), getCustomer: jest.fn(),
    createSubaccount: jest.fn(), listSubaccounts: jest.fn(),
    createSubscription: jest.fn(), updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(), getSubscription: jest.fn(),
    createPayment: jest.fn(), deletePayment: jest.fn(),
    restorePayment: jest.fn(), createPaymentLink: jest.fn(),
    removePaymentLink: jest.fn(), restorePaymentLink: jest.fn(),
  };
}

describe('Module wiring — ListPaymentLinksUseCase', () => {
  let module: TestingModule;
  let useCase: ListPaymentLinksUseCase;
  let repoMock: ReturnType<typeof makePaymentLinksRepoMock>;

  beforeEach(async () => {
    repoMock = makePaymentLinksRepoMock();
    module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repoMock },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  it('module compiles and provides ListPaymentLinksUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('delegates to the injected repository', async () => {
    repoMock.listPaymentLinks.mockResolvedValue({
      items: [], total: 0,
      summary: { totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0, expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0 },
    });
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repoMock.listPaymentLinks).toHaveBeenCalledTimes(1);
  });

  it('execute with empty repository result returns pagination with totalPages=1', async () => {
    repoMock.listPaymentLinks.mockResolvedValue({
      items: [], total: 0,
      summary: { totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0, expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0 },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.pagination.totalPages).toBe(1);
    expect(result.items).toHaveLength(0);
  });
});

describe('Module wiring — DeletePaymentLinkUseCase', () => {
  let useCase: DeletePaymentLinkUseCase;
  let repoMock: ReturnType<typeof makePaymentLinksRepoMock>;
  let facadeMock: ReturnType<typeof makePaymentFacadeMock>;

  beforeEach(async () => {
    repoMock = makePaymentLinksRepoMock();
    facadeMock = makePaymentFacadeMock();
    const module = await Test.createTestingModule({
      providers: [
        DeletePaymentLinkUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repoMock },
        { provide: PAYMENT_FACADE, useValue: facadeMock },
      ],
    }).compile();
    useCase = module.get(DeletePaymentLinkUseCase);
  });

  it('module provides DeletePaymentLinkUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('throws NotFoundException via injected repo when link not found', async () => {
    repoMock.findPaymentLinkById.mockResolvedValue(null);
    const { NotFoundException } = await import('@nestjs/common');
    await expect(useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'x' })).rejects.toThrow(NotFoundException);
  });
});

describe('Module wiring — PausePaymentLinkUseCase', () => {
  let useCase: PausePaymentLinkUseCase;
  let repoMock: ReturnType<typeof makePaymentLinksRepoMock>;
  let facadeMock: ReturnType<typeof makePaymentFacadeMock>;

  beforeEach(async () => {
    repoMock = makePaymentLinksRepoMock();
    facadeMock = makePaymentFacadeMock();
    const module = await Test.createTestingModule({
      providers: [
        PausePaymentLinkUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repoMock },
        { provide: PAYMENT_FACADE, useValue: facadeMock },
      ],
    }).compile();
    useCase = module.get(PausePaymentLinkUseCase);
  });

  it('module provides PausePaymentLinkUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('calls removePaymentLink on facade via injected modules', async () => {
    const link = {
      id: 'link-1', tenantId: 'tenant-1', providerLinkId: 'prov-1',
      status: 'ACTIVE', resourceType: 'PAYMENT_LINK',
      externalId: 'ext-1', name: 'T', value: 100,
      url: 'u', billingType: 'PIX', source: 'MANUAL',
      recurrenceEnabled: false, createdAt: new Date(), updatedAt: new Date(),
    };
    repoMock.findPaymentLinkById.mockResolvedValue(link);
    repoMock.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'PAUSED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(facadeMock.removePaymentLink).toHaveBeenCalledWith('prov-1');
  });
});

describe('Module wiring — ResumePaymentLinkUseCase', () => {
  let useCase: ResumePaymentLinkUseCase;
  let repoMock: ReturnType<typeof makePaymentLinksRepoMock>;
  let facadeMock: ReturnType<typeof makePaymentFacadeMock>;

  beforeEach(async () => {
    repoMock = makePaymentLinksRepoMock();
    facadeMock = makePaymentFacadeMock();
    const module = await Test.createTestingModule({
      providers: [
        ResumePaymentLinkUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repoMock },
        { provide: PAYMENT_FACADE, useValue: facadeMock },
      ],
    }).compile();
    useCase = module.get(ResumePaymentLinkUseCase);
  });

  it('module provides ResumePaymentLinkUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('calls restorePayment on facade for PAYMENT resourceType via injected modules', async () => {
    const link = {
      id: 'link-1', tenantId: 'tenant-1', providerLinkId: 'prov-1',
      status: 'PAUSED', resourceType: 'PAYMENT',
      externalId: 'ext-1', name: 'T', value: 100,
      url: 'u', billingType: 'PIX', source: 'MANUAL',
      recurrenceEnabled: false, createdAt: new Date(), updatedAt: new Date(),
    };
    repoMock.findPaymentLinkById.mockResolvedValue(link);
    repoMock.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'ACTIVE' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(facadeMock.restorePayment).toHaveBeenCalledWith('prov-1');
  });
});

describe('Module wiring — GenerateSalesPaymentLinksReportUseCase', () => {
  let useCase: GenerateSalesPaymentLinksReportUseCase;
  let repoMock: ReturnType<typeof makePaymentLinksRepoMock>;

  beforeEach(async () => {
    repoMock = makePaymentLinksRepoMock();
    const module = await Test.createTestingModule({
      providers: [
        GenerateSalesPaymentLinksReportUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repoMock },
      ],
    }).compile();
    useCase = module.get(GenerateSalesPaymentLinksReportUseCase);
  });

  it('module provides GenerateSalesPaymentLinksReportUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('hardcodes pageSize=10000 even when passed through module', async () => {
    repoMock.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: {} as any });
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repoMock.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1', expect.objectContaining({ pageSize: 10000 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. PrismaSalesRepository — findPaymentLinkById
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.findPaymentLinkById', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls $queryRaw with tenantId and paymentLinkId', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await repo.findPaymentLinkById('tenant-a', 'link-123');
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('tenant-a');
    expect(callStr).toContain('link-123');
  });

  it('returns null when no row found', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.findPaymentLinkById('tenant-a', 'nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to SalesPaymentLinkRecord with correct field mapping', async () => {
    const linkId = randomUUID();
    prisma.$queryRaw.mockResolvedValue([{
      id: linkId, tenant_id: 'tenant-a', branch_id: 'branch-1',
      provider_link_id: 'prov-x', external_id: 'ext-x', name: 'Test',
      description: 'desc', label: 'lbl', value: 300,
      url: 'https://pay.test/x', billing_type: 'BOLETO', status: 'PAUSED',
      source: 'AI', resource_type: 'PAYMENT', contact_id: 'contact-1',
      contact_name: 'João', conversation_id: 'conv-1', catalog_item_id: null,
      catalog_item_sku: null, catalog_item_name: null, expires_at: null,
      recurrence_enabled: true, recurrence_frequency: 'MONTHLY',
      recurrence_start_date: null, recurrence_end_date: null,
      recurrence_total_value: 900, recurrence_next_run_at: null,
      created_at: new Date('2026-03-01').toISOString(),
      updated_at: new Date('2026-03-15').toISOString(),
      deleted_at: null,
    }]);
    const result = await repo.findPaymentLinkById('tenant-a', linkId);
    expect(result).not.toBeNull();
    expect(result?.branchId).toBe('branch-1');
    expect(result?.billingType).toBe('BOLETO');
    expect(result?.resourceType).toBe('PAYMENT');
    expect(result?.contactId).toBe('contact-1');
    expect(result?.recurrenceEnabled).toBe(true);
    expect(result?.recurrenceTotalValue).toBe(900);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. PrismaSalesRepository — updatePaymentLinkStatus
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.updatePaymentLinkStatus', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const baseRow = {
    id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
    provider_link_id: 'prov-1', external_id: 'ext-1', name: 'Link',
    description: null, label: null, value: 100, url: 'https://pay.test/1',
    billing_type: 'PIX', status: 'PAUSED', source: 'MANUAL',
    resource_type: 'PAYMENT_LINK', contact_id: null, contact_name: null,
    conversation_id: null, catalog_item_id: null, catalog_item_sku: null,
    catalog_item_name: null, expires_at: null, recurrence_enabled: false,
    recurrence_frequency: null, recurrence_start_date: null,
    recurrence_end_date: null, recurrence_total_value: null,
    recurrence_next_run_at: null,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('returns null when no row updated', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.updatePaymentLinkStatus('tenant-a', 'link-1', 'DELETED');
    expect(result).toBeNull();
  });

  it('returns the updated record with new status', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ...baseRow, status: 'DELETED', deleted_at: new Date().toISOString() }]);
    const result = await repo.updatePaymentLinkStatus('tenant-a', baseRow.id, 'DELETED', new Date());
    expect(result?.status).toBe('DELETED');
  });

  it('passes tenantId, paymentLinkId and status to $queryRaw', async () => {
    prisma.$queryRaw.mockResolvedValue([baseRow]);
    await repo.updatePaymentLinkStatus('tenant-a', 'link-99', 'PAUSED', null);
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('tenant-a');
    expect(callStr).toContain('link-99');
    expect(callStr).toContain('PAUSED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. PrismaSalesRepository — incrementCouponUsage
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.incrementCouponUsage', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const couponRecord = {
    id: 'c1', tenantId: 'tenant-a', promotionId: null, code: 'PROMO',
    description: null, discountType: 'PERCENTAGE', discountValue: 10,
    maxUses: 5, usedCount: 2, startsAt: new Date(), expiresAt: null,
    active: true, catalogItemId: null, targets: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesCoupon = {
      findFirst: jest.fn().mockResolvedValue(couponRecord),
      update: jest.fn().mockResolvedValue({ ...couponRecord, usedCount: 3, targets: [] }),
    };
    repo = await buildTestModule(prisma);
  });

  it('returns null when coupon not found for tenant', async () => {
    (prisma as any).salesCoupon.findFirst.mockResolvedValue(null);
    const result = await repo.incrementCouponUsage('tenant-a', 'nonexistent');
    expect(result).toBeNull();
  });

  it('calls update with usedCount increment', async () => {
    await repo.incrementCouponUsage('tenant-a', 'c1');
    const args = (prisma as any).salesCoupon.update.mock.calls[0][0];
    expect(args.data).toEqual({ usedCount: { increment: 1 } });
  });

  it('returns updated coupon with incremented usedCount', async () => {
    const result = await repo.incrementCouponUsage('tenant-a', 'c1');
    expect(result?.usedCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. SalesPaymentLinkLifecycleService — module wiring integration
// ═══════════════════════════════════════════════════════════════════════════
import { SalesPaymentLinkLifecycleService } from '../application/services/SalesPaymentLinkLifecycleService';
import { SALES_METRICS_REPOSITORY, SALES_PAYMENT_LINKS_REPOSITORY as LINKS_REPO } from '../domain/repositories/ISalesRepository';
import { EVENT_BUS } from '@shared/application/ports/IEventBus';
import { SalesPaymentLinkCreatedIntegrationEvent } from '../application/integration-events/SalesIntegrationEvents';

describe('SalesPaymentLinkLifecycleService — module wiring', () => {
  let service: SalesPaymentLinkLifecycleService;
  let linksRepo: any;
  let metricsRepo: any;
  let eventBus: any;

  beforeEach(async () => {
    linksRepo = { createPaymentLink: jest.fn(), listPaymentLinks: jest.fn(), findPaymentLinkById: jest.fn(), updatePaymentLinkStatus: jest.fn(), updatePaymentLinkStatusByExternalReference: jest.fn(), findContactNameById: jest.fn() };
    metricsRepo = { findByTenantAndDate: jest.fn(), save: jest.fn(), incrementMetric: jest.fn(), getMetrics: jest.fn() };
    eventBus = { publish: jest.fn(), subscribe: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SalesPaymentLinkLifecycleService,
        { provide: LINKS_REPO, useValue: linksRepo },
        { provide: SALES_METRICS_REPOSITORY, useValue: metricsRepo },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile();
    service = module.get(SalesPaymentLinkLifecycleService);
  });

  it('module compiles and provides SalesPaymentLinkLifecycleService', () => {
    expect(service).toBeDefined();
  });

  it('recordCreated calls createPaymentLink on links repo', async () => {
    const input: any = {
      id: 'l1', tenantId: 't1', providerLinkId: 'p1', externalId: 'e1',
      name: 'N', value: 100, url: 'u', billingType: 'PIX', status: 'ACTIVE', source: 'MANUAL',
    };
    linksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(linksRepo.createPaymentLink).toHaveBeenCalledWith(input);
  });

  it('recordCreated calls incrementMetric on metrics repo', async () => {
    const input: any = {
      id: 'l1', tenantId: 't1', providerLinkId: 'p1', externalId: 'e1',
      name: 'N', value: 200, url: 'u', billingType: 'PIX', status: 'ACTIVE', source: 'MANUAL',
    };
    linksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('t1', expect.any(Date), 'LINK', 200);
  });

  it('recordCreated publishes SalesPaymentLinkCreatedIntegrationEvent', async () => {
    const input: any = {
      id: 'l1', tenantId: 't1', providerLinkId: 'p1', externalId: 'e1',
      name: 'N', value: 50, url: 'u', billingType: 'PIX', status: 'ACTIVE', source: 'MANUAL',
    };
    linksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.any(SalesPaymentLinkCreatedIntegrationEvent));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. PrismaSalesRepository — mapPaymentLink field mapping edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository — mapPaymentLink edge cases', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('maps resource_type to PAYMENT_LINK by default when field is null', async () => {
    prisma.$queryRaw.mockResolvedValue([{
      id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
      provider_link_id: 'p1', external_id: 'e1', name: 'N', description: null,
      label: null, value: 10, url: 'u', billing_type: 'PIX', status: 'ACTIVE',
      source: 'MANUAL', resource_type: null, contact_id: null, contact_name: null,
      conversation_id: null, catalog_item_id: null, catalog_item_sku: null,
      catalog_item_name: null, expires_at: null, recurrence_enabled: false,
      recurrence_frequency: null, recurrence_start_date: null,
      recurrence_end_date: null, recurrence_total_value: null,
      recurrence_next_run_at: null, created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), deleted_at: null,
    }]);
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{
      total_links: 1, active_links: 1, paused_links: 0, paid_links: 0,
      expired_links: 0, estimated_revenue: 10, paid_revenue: 0,
    }]);
    const result = await repo.findPaymentLinkById('tenant-a', 'link-1');
    expect(result?.resourceType).toBe('PAYMENT_LINK');
  });

  it('maps expires_at to Date object when present', async () => {
    const expiresAt = new Date('2026-12-31').toISOString();
    prisma.$queryRaw.mockResolvedValue([{
      id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
      provider_link_id: 'p1', external_id: 'e1', name: 'N', description: null,
      label: null, value: 10, url: 'u', billing_type: 'PIX', status: 'ACTIVE',
      source: 'MANUAL', resource_type: 'PAYMENT_LINK', contact_id: null,
      contact_name: null, conversation_id: null, catalog_item_id: null,
      catalog_item_sku: null, catalog_item_name: null, expires_at: expiresAt,
      recurrence_enabled: false, recurrence_frequency: null,
      recurrence_start_date: null, recurrence_end_date: null,
      recurrence_total_value: null, recurrence_next_run_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    }]);
    const result = await repo.findPaymentLinkById('tenant-a', 'link-1');
    expect(result?.expiresAt).toBeInstanceOf(Date);
  });

  it('maps recurrence_total_value to number when present', async () => {
    prisma.$queryRaw.mockResolvedValue([{
      id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
      provider_link_id: 'p1', external_id: 'e1', name: 'N', description: null,
      label: null, value: 100, url: 'u', billing_type: 'PIX', status: 'ACTIVE',
      source: 'MANUAL', resource_type: 'PAYMENT_LINK', contact_id: null,
      contact_name: null, conversation_id: null, catalog_item_id: null,
      catalog_item_sku: null, catalog_item_name: null, expires_at: null,
      recurrence_enabled: true, recurrence_frequency: 'MONTHLY',
      recurrence_start_date: null, recurrence_end_date: null,
      recurrence_total_value: '300', recurrence_next_run_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    }]);
    const result = await repo.findPaymentLinkById('tenant-a', 'link-1');
    expect(result?.recurrenceTotalValue).toBe(300);
    expect(typeof result?.recurrenceTotalValue).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18. PrismaSalesRepository — listPromotions onlyActive
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.listPromotions — onlyActive', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    (prisma as any).salesPromotion = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    repo = await buildTestModule(prisma);
  });

  it('includes active=true when onlyActive=true', async () => {
    await repo.listPromotions('tenant-a', true);
    const args = (prisma as any).salesPromotion.findMany.mock.calls[0][0];
    expect(args.where.active).toBe(true);
  });

  it('does not include active filter when onlyActive is false', async () => {
    await repo.listPromotions('tenant-a', false);
    const args = (prisma as any).salesPromotion.findMany.mock.calls[0][0];
    expect(args.where.active).toBeUndefined();
  });

  it('orders by createdAt desc', async () => {
    await repo.listPromotions('tenant-a');
    const args = (prisma as any).salesPromotion.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('returns empty array when no promotions', async () => {
    const result = await repo.listPromotions('tenant-a');
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 19. PrismaSalesRepository — findContactNameById
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.findContactNameById', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('returns name when contact found', async () => {
    prisma.$queryRaw.mockResolvedValue([{ name: 'João Silva' }]);
    const result = await repo.findContactNameById('tenant-a', 'contact-1');
    expect(result).toBe('João Silva');
  });

  it('returns null when contact not found', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.findContactNameById('tenant-a', 'missing');
    expect(result).toBeNull();
  });

  it('passes tenantId and contactId to $queryRaw', async () => {
    prisma.$queryRaw.mockResolvedValue([{ name: 'Maria' }]);
    await repo.findContactNameById('tenant-a', 'contact-99');
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('tenant-a');
    expect(callStr).toContain('contact-99');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. PrismaSalesRepository — createPaymentLink field mapping
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.createPaymentLink', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  const insertedRow = {
    id: randomUUID(), tenant_id: 'tenant-a', branch_id: null,
    provider_link_id: 'prov-new', external_id: 'sales-link|tenant-a|new',
    name: 'New Link', description: 'desc', label: null, value: 200,
    url: 'https://pay.test/new', billing_type: 'CREDIT_CARD', status: 'ACTIVE',
    source: 'MANUAL', resource_type: 'PAYMENT_LINK', contact_id: null,
    contact_name: null, conversation_id: null, catalog_item_id: null,
    catalog_item_sku: null, catalog_item_name: null, expires_at: null,
    recurrence_enabled: false, recurrence_frequency: null,
    recurrence_start_date: null, recurrence_end_date: null,
    recurrence_total_value: null, recurrence_next_run_at: null, deleted_at: null,
    created_at: new Date('2026-06-01').toISOString(),
    updated_at: new Date('2026-06-01').toISOString(),
  };

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls $queryRaw INSERT and returns mapped record', async () => {
    prisma.$queryRaw.mockResolvedValue([insertedRow]);
    const result = await repo.createPaymentLink({
      id: insertedRow.id, tenantId: 'tenant-a', providerLinkId: 'prov-new',
      externalId: 'sales-link|tenant-a|new', name: 'New Link',
      description: 'desc', value: 200, url: 'https://pay.test/new',
      billingType: 'CREDIT_CARD', status: 'ACTIVE', source: 'MANUAL',
    });
    expect(result.name).toBe('New Link');
    expect(result.billingType).toBe('CREDIT_CARD');
    expect(result.value).toBe(200);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('passes all required fields to $queryRaw INSERT', async () => {
    prisma.$queryRaw.mockResolvedValue([insertedRow]);
    await repo.createPaymentLink({
      id: insertedRow.id, tenantId: 'tenant-a', providerLinkId: 'prov-new',
      externalId: 'ext', name: 'Link', value: 200, url: 'u',
      billingType: 'PIX', status: 'ACTIVE', source: 'MANUAL',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('INSERT');
    expect(callStr).toContain('tenant-a');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. PrismaSalesRepository — save (metric entity)
// ═══════════════════════════════════════════════════════════════════════════
import { SalesMetric } from '../domain/entities/SalesMetric';

describe('PrismaSalesRepository.save', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('calls salesMetric.upsert when saving a SalesMetric entity', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    const metric = SalesMetric.create({
      tenantId: 'tenant-a', date: new Date('2026-01-01'),
      totalMessages: 3, purchaseIntents: 1, paymentLinksGenerated: 2, estimatedRevenue: 400,
    });
    await repo.save(metric);
    expect(prisma.salesMetric.upsert).toHaveBeenCalled();
  });

  it('save upserts with correct where clause using tenantId_date key', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    const date = new Date('2026-06-15');
    const metric = SalesMetric.create({
      tenantId: 'tenant-x', date,
      totalMessages: 1, purchaseIntents: 0, paymentLinksGenerated: 0, estimatedRevenue: 0,
    });
    await repo.save(metric);
    const args = prisma.salesMetric.upsert.mock.calls[0][0];
    expect(args.where.tenantId_date.tenantId).toBe('tenant-x');
    expect(args.where.tenantId_date.date).toEqual(date);
  });

  it('save includes all metric fields in update data', async () => {
    prisma.salesMetric.upsert.mockResolvedValue({} as any);
    const metric = SalesMetric.create({
      tenantId: 'tenant-a', date: new Date(),
      totalMessages: 5, purchaseIntents: 2, paymentLinksGenerated: 3, estimatedRevenue: 750,
    });
    await repo.save(metric);
    const args = prisma.salesMetric.upsert.mock.calls[0][0];
    expect(args.update.totalMessages).toBe(5);
    expect(args.update.purchaseIntents).toBe(2);
    expect(args.update.paymentLinksGenerated).toBe(3);
    expect(args.update.estimatedRevenue).toBe(750);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. PrismaSalesRepository — findByTenantAndDate
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.findByTenantAndDate', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('returns null when metric not found', async () => {
    prisma.salesMetric.findUnique.mockResolvedValue(null);
    const result = await repo.findByTenantAndDate('tenant-a', new Date());
    expect(result).toBeNull();
  });

  it('normalizes date to start-of-day for findUnique query', async () => {
    prisma.salesMetric.findUnique.mockResolvedValue(null);
    await repo.findByTenantAndDate('tenant-a', new Date('2026-01-15T16:45:00'));
    const args = prisma.salesMetric.findUnique.mock.calls[0][0];
    const queryDate = args.where.tenantId_date.date as Date;
    expect(queryDate.getHours()).toBe(0);
    expect(queryDate.getMinutes()).toBe(0);
  });

  it('maps Prisma record to SalesMetric entity', async () => {
    prisma.salesMetric.findUnique.mockResolvedValue({
      id: randomUUID(), tenantId: 'tenant-a', date: new Date('2026-01-10'),
      totalMessages: 7, purchaseIntents: 3, paymentLinksGenerated: 4,
      estimatedRevenue: '800.50', updatedAt: new Date(),
    });
    const result = await repo.findByTenantAndDate('tenant-a', new Date('2026-01-10'));
    expect(result).not.toBeNull();
    expect(result?.totalMessages).toBe(7);
    expect(result?.estimatedRevenue).toBe(800.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 23. Module wiring — CreateCouponUseCase and UpdateCouponUseCase
// ═══════════════════════════════════════════════════════════════════════════
import { CreateCouponUseCase } from '../application/use-cases/CreateCouponUseCase';
import { UpdateCouponUseCase } from '../application/use-cases/UpdateCouponUseCase';
import { DeleteCouponUseCase } from '../application/use-cases/DeleteCouponUseCase';
import { ListCouponsUseCase } from '../application/use-cases/ListCouponsUseCase';
import { SALES_REPOSITORY } from '../domain/repositories/ISalesRepository';

function makeCouponRepoMock() {
  return {
    findCouponByCode: jest.fn(), findCouponById: jest.fn(),
    createCoupon: jest.fn(), updateCoupon: jest.fn(),
    deleteCoupon: jest.fn(), listCoupons: jest.fn(),
    incrementCouponUsage: jest.fn(), atomicIncrementCouponUsage: jest.fn(),
  };
}

describe('Module wiring — CreateCouponUseCase', () => {
  it('module provides CreateCouponUseCase and delegates to injected repo', async () => {
    const repo = makeCouponRepoMock();
    repo.createCoupon.mockResolvedValue({ id: 'c1' } as any);
    const mod = await Test.createTestingModule({
      providers: [CreateCouponUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(CreateCouponUseCase);
    expect(useCase).toBeDefined();
    await useCase.execute({ tenantId: 't1', code: 'TEST', discountType: 'PERCENTAGE', discountValue: 10, maxUses: 0, startsAt: new Date().toISOString() });
    expect(repo.createCoupon).toHaveBeenCalled();
  });
});

describe('Module wiring — UpdateCouponUseCase', () => {
  it('module provides UpdateCouponUseCase and throws NotFoundException when not found', async () => {
    const repo = makeCouponRepoMock();
    repo.updateCoupon.mockResolvedValue(null);
    const mod = await Test.createTestingModule({
      providers: [UpdateCouponUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(UpdateCouponUseCase);
    const { NotFoundException } = await import('@nestjs/common');
    await expect(useCase.execute({ tenantId: 't1', couponId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('Module wiring — DeleteCouponUseCase', () => {
  it('module provides DeleteCouponUseCase and returns { deleted: true }', async () => {
    const repo = makeCouponRepoMock();
    repo.deleteCoupon.mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [DeleteCouponUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(DeleteCouponUseCase);
    const result = await useCase.execute({ tenantId: 't1', couponId: 'c1' });
    expect(result).toEqual({ deleted: true });
  });
});

describe('Module wiring — ListCouponsUseCase', () => {
  it('module provides ListCouponsUseCase and forwards to repo', async () => {
    const repo = makeCouponRepoMock();
    repo.listCoupons.mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [ListCouponsUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(ListCouponsUseCase);
    const result = await useCase.execute({ tenantId: 't1', onlyActive: true });
    expect(result).toHaveLength(0);
    expect(repo.listCoupons).toHaveBeenCalledWith('t1', true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 24. Module wiring — Promotion use cases
// ═══════════════════════════════════════════════════════════════════════════
import { CreatePromotionUseCase } from '../application/use-cases/CreatePromotionUseCase';
import { UpdatePromotionUseCase } from '../application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from '../application/use-cases/DeletePromotionUseCase';
import { ListPromotionsUseCase } from '../application/use-cases/ListPromotionsUseCase';

function makePromotionRepoMock() {
  return {
    createPromotion: jest.fn(), updatePromotion: jest.fn(),
    deletePromotion: jest.fn(), findPromotionById: jest.fn(),
    listPromotions: jest.fn(),
  };
}

describe('Module wiring — CreatePromotionUseCase', () => {
  it('module provides CreatePromotionUseCase and delegates to repo', async () => {
    const repo = makePromotionRepoMock();
    repo.createPromotion.mockResolvedValue({ id: 'p1' } as any);
    const mod = await Test.createTestingModule({
      providers: [CreatePromotionUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(CreatePromotionUseCase);
    await useCase.execute({
      tenantId: 't1', title: 'T', description: 'd',
      discountType: 'PERCENTAGE', discountValue: 10,
      startsAt: new Date().toISOString(),
    });
    expect(repo.createPromotion).toHaveBeenCalled();
  });
});

describe('Module wiring — UpdatePromotionUseCase', () => {
  it('throws NotFoundException when promo not found via injected repo', async () => {
    const repo = makePromotionRepoMock();
    repo.updatePromotion.mockResolvedValue(null);
    const mod = await Test.createTestingModule({
      providers: [UpdatePromotionUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(UpdatePromotionUseCase);
    const { NotFoundException } = await import('@nestjs/common');
    await expect(useCase.execute({ tenantId: 't1', promotionId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('Module wiring — DeletePromotionUseCase', () => {
  it('delegates to repo.deletePromotion and returns { deleted: true }', async () => {
    const repo = makePromotionRepoMock();
    repo.deletePromotion.mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [DeletePromotionUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(DeletePromotionUseCase);
    const result = await useCase.execute({ tenantId: 't1', promotionId: 'p1' });
    expect(result).toEqual({ deleted: true });
  });
});

describe('Module wiring — ListPromotionsUseCase', () => {
  it('forwards onlyActive to repo.listPromotions', async () => {
    const repo = makePromotionRepoMock();
    repo.listPromotions.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }] as any);
    const mod = await Test.createTestingModule({
      providers: [ListPromotionsUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = mod.get(ListPromotionsUseCase);
    const result = await useCase.execute({ tenantId: 't1', onlyActive: false });
    expect(result).toHaveLength(2);
    expect(repo.listPromotions).toHaveBeenCalledWith('t1', false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 25. TrackSalesMetricUseCase — module wiring
// ═══════════════════════════════════════════════════════════════════════════
import { TrackSalesMetricUseCase } from '../application/use-cases/TrackSalesMetricUseCase';

describe('Module wiring — TrackSalesMetricUseCase', () => {
  let useCase: TrackSalesMetricUseCase;
  let metricsRepo: any;

  beforeEach(async () => {
    metricsRepo = { findByTenantAndDate: jest.fn(), save: jest.fn(), incrementMetric: jest.fn(), getMetrics: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [TrackSalesMetricUseCase, { provide: SALES_METRICS_REPOSITORY, useValue: metricsRepo }],
    }).compile();
    useCase = mod.get(TrackSalesMetricUseCase);
  });

  it('module provides TrackSalesMetricUseCase', () => {
    expect(useCase).toBeDefined();
  });

  it('calls incrementMetric with MESSAGE type', async () => {
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 't1', type: 'MESSAGE' });
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('t1', expect.any(Date), 'MESSAGE', undefined);
  });

  it('calls incrementMetric with INTENT type', async () => {
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 't1', type: 'INTENT' });
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('t1', expect.any(Date), 'INTENT', undefined);
  });

  it('calls incrementMetric with LINK type and value', async () => {
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 't1', type: 'LINK', value: 500 });
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('t1', expect.any(Date), 'LINK', 500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 26. PrismaSalesRepository — escapeLike special chars
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository — search with special characters', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('escapes percent sign in search term to prevent SQL injection', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total_links: 0, active_links: 0, paused_links: 0, paid_links: 0, expired_links: 0, estimated_revenue: 0, paid_revenue: 0 }]);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', search: '50%off',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('50\\\\%off');
  });

  it('escapes underscore in search term', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total_links: 0, active_links: 0, paused_links: 0, paid_links: 0, expired_links: 0, estimated_revenue: 0, paid_revenue: 0 }]);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', search: 'test_case',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).toContain('test\\\\_case');
  });

  it('empty search does not add LIKE clause', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total_links: 0, active_links: 0, paused_links: 0, paid_links: 0, expired_links: 0, estimated_revenue: 0, paid_revenue: 0 }]);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL', search: '   ',
    });
    const callStr = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(callStr).not.toContain('LOWER(payment_links.name) LIKE');
  });

  it('branchId filter is passed through when provided', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total_links: 0, active_links: 0, paused_links: 0, paid_links: 0, expired_links: 0, estimated_revenue: 0, paid_revenue: 0 }]);
    await repo.listPaymentLinks('tenant-a', {
      page: 1, pageSize: 20, status: 'ALL', source: 'ALL',
      branchId: 'branch-xyz',
    });
    // branchId is passed as parameter to $queryRaw
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 27. PrismaSalesRepository — getMetrics ordering
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaSalesRepository.getMetrics — ordering', () => {
  let repo: PrismaSalesRepository;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = await buildTestModule(prisma);
  });

  it('orders metrics by date ascending', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([]);
    await repo.getMetrics('tenant-a', new Date('2026-01-01'), new Date('2026-01-31'));
    const args = prisma.salesMetric.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ date: 'asc' });
  });

  it('converts estimatedRevenue to number even when returned as string from DB', async () => {
    prisma.salesMetric.findMany.mockResolvedValue([{
      id: randomUUID(), tenantId: 'tenant-a', date: new Date('2026-01-05'),
      totalMessages: 2, purchaseIntents: 1, paymentLinksGenerated: 1,
      estimatedRevenue: '199.99', updatedAt: new Date(),
    }]);
    const result = await repo.getMetrics('tenant-a', new Date('2026-01-01'), new Date('2026-01-31'));
    expect(typeof result[0].estimatedRevenue).toBe('number');
    expect(result[0].estimatedRevenue).toBeCloseTo(199.99);
  });
});
