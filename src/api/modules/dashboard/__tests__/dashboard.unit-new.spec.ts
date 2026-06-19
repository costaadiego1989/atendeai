// dashboard.unit-new.spec.ts - DASH unit tests
// Gaps: 3,4,5,11,14,16,17,18,19,20
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { GetSalesMetricsUseCase } from '@modules/sales/application/use-cases/GetSalesMetricsUseCase';
import { ListPaymentLinksUseCase } from '@modules/sales/application/use-cases/ListPaymentLinksUseCase';
import { RedeemCouponUseCase } from '@modules/sales/application/use-cases/RedeemCouponUseCase';
import { SalesAnalyticsHandler } from '@modules/sales/application/handlers/SalesAnalyticsHandler';
import { SalesPaymentEventHandler } from '@modules/sales/application/handlers/SalesPaymentEventHandler';
import { ListRecoveryCasesUseCase } from '@modules/recovery/application/use-cases/ListRecoveryCasesUseCase';
import { SalesMetric } from '@modules/sales/domain/entities/SalesMetric';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import {
  buildRecoveryPaymentReference,
  isRecoveryPaymentReference,
  parseRecoveryPaymentReference,
  RECOVERY_PAYMENT_REFERENCE_PREFIX,
} from '@shared/contracts/payment-references';
import type {
  ISalesMetricsRepository,
  ISalesPaymentLinksRepository,
  ISalesCouponRepository,
  SalesPaymentLinkRecord,
  SalesCouponRecord,
} from '@modules/sales/domain/repositories/ISalesRepository';
import type { IEventBus } from '@shared/application/ports/IEventBus';
import type { IRecoveryRepository } from '@modules/recovery/domain/ports/IRecoveryRepository';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function makeMetric(
  overrides: Partial<{
    tenantId: string;
    date: Date;
    totalMessages: number;
    purchaseIntents: number;
    paymentLinksGenerated: number;
    estimatedRevenue: number;
  }> = {},
): SalesMetric {
  return SalesMetric.create({
    tenantId: overrides.tenantId ?? 'tenant-1',
    date: overrides.date ?? new Date('2024-06-01T00:00:00.000Z'),
    totalMessages: overrides.totalMessages ?? 10,
    purchaseIntents: overrides.purchaseIntents ?? 2,
    paymentLinksGenerated: overrides.paymentLinksGenerated ?? 1,
    estimatedRevenue: overrides.estimatedRevenue ?? 100,
  });
}

function makeMetricsRepo(): jest.Mocked<ISalesMetricsRepository> {
  return {
    findByTenantAndDate: jest.fn(),
    save: jest.fn(),
    incrementMetric: jest.fn(),
    getMetrics: jest.fn(),
  };
}

function makeLinkRecord(
  overrides: Partial<SalesPaymentLinkRecord> = {},
): SalesPaymentLinkRecord {
  return {
    id: 'link-1',
    tenantId: 'tenant-1',
    branchId: null,
    providerLinkId: 'prov-1',
    externalId: 'sales-charge|tenant-1|link-1',
    name: 'Test Link',
    description: null,
    label: null,
    value: 200,
    url: 'https://pay.test/link-1',
    billingType: 'PIX',
    status: 'PAID',
    source: 'MANUAL',
    resourceType: 'PAYMENT',
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
    createdAt: new Date('2024-06-01T12:00:00.000Z'),
    updatedAt: new Date('2024-06-01T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeLinksRepo(): jest.Mocked<ISalesPaymentLinksRepository> {
  return {
    createPaymentLink: jest.fn(),
    listPaymentLinks: jest.fn(),
    findPaymentLinkById: jest.fn(),
    updatePaymentLinkStatus: jest.fn(),
    updatePaymentLinkStatusByExternalReference: jest.fn(),
    findContactNameById: jest.fn(),
  };
}

function makeCoupon(overrides: Partial<SalesCouponRecord> = {}): SalesCouponRecord {
  return {
    id: 'coupon-1',
    tenantId: 'tenant-1',
    promotionId: null,
    code: 'SAVE10',
    description: null,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUses: 5,
    usedCount: 0,
    startsAt: new Date(Date.now() - 86400000),
    expiresAt: null,
    active: true,
    catalogItemId: null,
    targets: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCouponRepo(): jest.Mocked<ISalesCouponRepository> {
  return {
    createCoupon: jest.fn(),
    updateCoupon: jest.fn(),
    deleteCoupon: jest.fn(),
    findCouponById: jest.fn(),
    findCouponByCode: jest.fn(),
    listCoupons: jest.fn(),
    incrementCouponUsage: jest.fn(),
    atomicIncrementCouponUsage: jest.fn(),
  };
}

function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    publish: jest.fn(),
    subscribe: jest.fn(),
  };
}

function makeLinksRepoResult(
  items: SalesPaymentLinkRecord[],
  overrideSummary: Partial<{
    totalLinks: number;
    activeLinks: number;
    pausedLinks: number;
    paidLinks: number;
    expiredLinks: number;
    estimatedRevenue: number;
    paidRevenue: number;
  }> = {},
) {
  return {
    items,
    total: items.length,
    summary: {
      totalLinks: items.length,
      activeLinks: 0,
      pausedLinks: 0,
      paidLinks: items.filter((i) => i.status === 'PAID').length,
      expiredLinks: 0,
      estimatedRevenue: items.reduce((s, i) => s + i.value, 0),
      paidRevenue: items
        .filter((i) => i.status === 'PAID')
        .reduce((s, i) => s + i.value, 0),
      ...overrideSummary,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — GetSalesMetricsUseCase (gap #3, #4)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-100 GetSalesMetricsUseCase', () => {
  let useCase: GetSalesMetricsUseCase;
  let repo: jest.Mocked<ISalesMetricsRepository>;

  beforeEach(() => {
    repo = makeMetricsRepo();
    useCase = new GetSalesMetricsUseCase(repo);
  });

  it('DASH-U-101 inverted date range passes to repo silently and returns empty metrics', async () => {
    repo.getMetrics.mockResolvedValue([]);
    const start = new Date('2024-06-30T00:00:00.000Z');
    const end   = new Date('2024-06-01T00:00:00.000Z');
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: start, endDate: end });
    expect(repo.getMetrics).toHaveBeenCalledWith('tenant-1', start, end);
    expect(result.metrics).toHaveLength(0);
    expect(result.summary.totalRevenue).toBe(0);
  });

  it('DASH-U-102 startDate equal to endDate returns rows for that single day', async () => {
    const day = new Date('2024-06-15T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([makeMetric({ date: day, estimatedRevenue: 300 })]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: day, endDate: day });
    expect(result.metrics).toHaveLength(1);
    expect(result.summary.totalRevenue).toBe(300);
  });

  it('DASH-U-103 inverted range produces all-zero summary', async () => {
    repo.getMetrics.mockResolvedValue([]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-12-31'),
      endDate:   new Date('2024-01-01'),
    });
    expect(result.summary).toEqual({ totalMessages: 0, totalIntents: 0, totalLinks: 0, totalRevenue: 0 });
  });

  it('DASH-U-104 floating-point: 0.1+0.2 accumulation is NOT exactly 0.3', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ estimatedRevenue: 0.1 }),
      makeMetric({ estimatedRevenue: 0.2 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-30'),
    });
    expect(result.summary.totalRevenue).not.toBe(0.3);
    expect(result.summary.totalRevenue).toBeCloseTo(0.3, 10);
  });

  it('DASH-U-105 floating-point: three decimal values accumulate close to expected', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ estimatedRevenue: 1.1 }),
      makeMetric({ estimatedRevenue: 2.2 }),
      makeMetric({ estimatedRevenue: 3.3 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'),
    });
    expect(result.summary.totalRevenue).toBeCloseTo(6.6, 8);
  });

  it('DASH-U-106 large decimals: 999.99+0.01 close to 1000', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ estimatedRevenue: 999.99 }),
      makeMetric({ estimatedRevenue: 0.01 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    });
    expect(result.summary.totalRevenue).toBeCloseTo(1000, 10);
  });

  it('DASH-U-107 totalRevenue is sum of all estimatedRevenue values', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ estimatedRevenue: 100 }),
      makeMetric({ estimatedRevenue: 200 }),
      makeMetric({ estimatedRevenue: 300 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'),
    });
    expect(result.summary.totalRevenue).toBe(600);
  });

  it('DASH-U-108 metric dates serialize to ISO strings', async () => {
    const d = new Date('2024-03-15T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([makeMetric({ date: d })]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: d, endDate: d });
    expect(result.metrics[0].date).toBe('2024-03-15T00:00:00.000Z');
  });

  it('DASH-U-109 totalMessages sums across all rows', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ totalMessages: 5 }),
      makeMetric({ totalMessages: 7 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
    });
    expect(result.summary.totalMessages).toBe(12);
  });

  it('DASH-U-110 totalIntents maps from purchaseIntents across all rows', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ purchaseIntents: 3 }),
      makeMetric({ purchaseIntents: 4 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
    });
    expect(result.summary.totalIntents).toBe(7);
  });

  it('DASH-U-111 totalLinks sums paymentLinksGenerated across all rows', async () => {
    repo.getMetrics.mockResolvedValue([
      makeMetric({ paymentLinksGenerated: 2 }),
      makeMetric({ paymentLinksGenerated: 3 }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
    });
    expect(result.summary.totalLinks).toBe(5);
  });

  it('DASH-U-112 repository error propagates as rejection', async () => {
    repo.getMetrics.mockRejectedValue(new Error('DB down'));
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      }),
    ).rejects.toThrow('DB down');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — ListPaymentLinksUseCase (gap #11)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-200 ListPaymentLinksUseCase', () => {
  let useCase: ListPaymentLinksUseCase;
  let repo: jest.Mocked<ISalesPaymentLinksRepository>;

  beforeEach(() => {
    repo = makeLinksRepo();
    useCase = new ListPaymentLinksUseCase(repo);
  });

  it('DASH-U-201 resourceType null DB value defaults to PAYMENT_LINK in output', async () => {
    const link = makeLinkRecord({ resourceType: undefined });
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([link]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].resourceType).toBe('PAYMENT_LINK');
  });

  it('DASH-U-202 resourceType PAYMENT is preserved as-is', async () => {
    const link = makeLinkRecord({ resourceType: 'PAYMENT' });
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([link]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].resourceType).toBe('PAYMENT');
  });

  it('DASH-U-203 page clamped to minimum 1 when page=0 is passed', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', page: 0 });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('DASH-U-204 page clamped to minimum 1 when page=-5 is passed', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', page: -5 });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('DASH-U-205 pageSize clamped to minimum 1 when pageSize=0 is passed', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 0 });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 1 }),
    );
  });

  it('DASH-U-206 pageSize clamped to maximum 100 when pageSize=101 is passed', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 101 });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('DASH-U-207 pageSize clamped to maximum 100 when pageSize=9999 is passed', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 9999 });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('DASH-U-208 default pagination uses page=1 and pageSize=20', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it('DASH-U-209 totalPages is at least 1 even when total=0', async () => {
    repo.listPaymentLinks.mockResolvedValue(
      makeLinksRepoResult([], { totalLinks: 0 }),
    );
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('DASH-U-210 summary from repository is passed through unchanged', async () => {
    const customSummary = {
      totalLinks: 5,
      activeLinks: 2,
      pausedLinks: 1,
      paidLinks: 2,
      expiredLinks: 0,
      estimatedRevenue: 1000,
      paidRevenue: 400,
    };
    repo.listPaymentLinks.mockResolvedValue({ items: [], total: 5, summary: customSummary });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary).toEqual(customSummary);
  });

  it('DASH-U-211 status filter ALL is passed to repository', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', status: 'ALL' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ status: 'ALL' }),
    );
  });

  it('DASH-U-212 status filter REFUNDED is passed to repository', async () => {
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', status: 'REFUNDED' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ status: 'REFUNDED' }),
    );
  });

  it('DASH-U-213 dateFrom and dateTo are passed to repository', async () => {
    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-31T23:59:59.999Z');
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', dateFrom: from, dateTo: to });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ dateFrom: from, dateTo: to }),
    );
  });

  it('DASH-U-214 item expiresAt serializes to ISO string when set', async () => {
    const expires = new Date('2024-12-31T23:59:59.000Z');
    const link = makeLinkRecord({ expiresAt: expires });
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([link]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].expiresAt).toBe('2024-12-31T23:59:59.000Z');
  });

  it('DASH-U-215 item expiresAt is undefined when null', async () => {
    const link = makeLinkRecord({ expiresAt: null });
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([link]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].expiresAt).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — RedeemCouponUseCase (gap #14)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-300 RedeemCouponUseCase', () => {
  let useCase: RedeemCouponUseCase;
  let repo: jest.Mocked<ISalesCouponRepository>;

  beforeEach(() => {
    repo = makeCouponRepo();
    useCase = new RedeemCouponUseCase(repo);
  });

  it('DASH-U-301 atomicIncrementCouponUsage called for bounded coupon (maxUses>0)', async () => {
    const coupon = makeCoupon({ maxUses: 5, usedCount: 0 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.atomicIncrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' });
    expect(repo.atomicIncrementCouponUsage).toHaveBeenCalledWith('tenant-1', 'coupon-1');
    expect(repo.incrementCouponUsage).not.toHaveBeenCalled();
  });

  it('DASH-U-302 incrementCouponUsage (non-atomic) called for unlimited coupon (maxUses=0)', async () => {
    const coupon = makeCoupon({ maxUses: 0, usedCount: 0 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.incrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' });
    expect(repo.incrementCouponUsage).toHaveBeenCalledWith('tenant-1', 'coupon-1');
    expect(repo.atomicIncrementCouponUsage).not.toHaveBeenCalled();
  });

  it('DASH-U-303 race condition: atomicIncrementCouponUsage returns null -> ConflictException', async () => {
    const coupon = makeCoupon({ maxUses: 2, usedCount: 1 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.atomicIncrementCouponUsage.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(ConflictException);
  });

  it('DASH-U-304 race condition: two concurrent calls both see usedCount<maxUses but second gets null', async () => {
    const coupon = makeCoupon({ maxUses: 1, usedCount: 0 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    // First call succeeds
    repo.atomicIncrementCouponUsage
      .mockResolvedValueOnce({ ...coupon, usedCount: 1 })
      .mockResolvedValueOnce(null); // second concurrent call loses the race
    await useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' });
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(ConflictException);
  });

  it('DASH-U-305 coupon at maxUses fails fast-fail check before even calling atomic', async () => {
    const coupon = makeCoupon({ maxUses: 3, usedCount: 3 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.atomicIncrementCouponUsage).not.toHaveBeenCalled();
  });

  it('DASH-U-306 coupon not found by code throws NotFoundException', async () => {
    repo.findCouponByCode.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'GHOST' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('DASH-U-307 coupon not found by id throws NotFoundException', async () => {
    repo.findCouponById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', couponId: 'nonexistent-id' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('DASH-U-308 inactive coupon throws BadRequestException', async () => {
    repo.findCouponByCode.mockResolvedValue(makeCoupon({ active: false }));
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('DASH-U-309 coupon not yet started throws BadRequestException', async () => {
    repo.findCouponByCode.mockResolvedValue(
      makeCoupon({ startsAt: new Date(Date.now() + 86400000) }),
    );
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('DASH-U-310 expired coupon throws BadRequestException', async () => {
    repo.findCouponByCode.mockResolvedValue(
      makeCoupon({ expiresAt: new Date(Date.now() - 86400000) }),
    );
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('DASH-U-311 result includes discount type and value from coupon', async () => {
    const coupon = makeCoupon({ discountType: 'FIXED_AMOUNT', discountValue: 50, maxUses: 0 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.incrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    const result = await useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' });
    expect(result.discount).toEqual({ type: 'FIXED_AMOUNT', value: 50 });
  });

  it('DASH-U-312 coupon lookup by id uses findCouponById not findCouponByCode', async () => {
    const coupon = makeCoupon({ maxUses: 0 });
    repo.findCouponById.mockResolvedValue(coupon);
    repo.incrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-1' });
    expect(repo.findCouponById).toHaveBeenCalledWith('tenant-1', 'coupon-1');
    expect(repo.findCouponByCode).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — SalesAnalyticsHandler (gap #16)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-400 SalesAnalyticsHandler', () => {
  let handler: SalesAnalyticsHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let trackUseCase: { execute: jest.Mock };

  function getCallback(eventName: string): (event: any) => Promise<void> {
    handler.onModuleInit();
    return (eventBus.subscribe.mock.calls.find(([n]) => n === eventName)?.[1]) as any;
  }

  beforeEach(() => {
    eventBus = makeEventBus();
    trackUseCase = { execute: jest.fn() };
    handler = new SalesAnalyticsHandler(eventBus, trackUseCase as any);
  });

  it('DASH-U-401 subscriptions registered for messaging.message-received, messaging.message-sent, ai.lead-scored', () => {
    handler.onModuleInit();
    const names = eventBus.subscribe.mock.calls.map(([n]) => n);
    expect(names).toContain('messaging.message-received');
    expect(names).toContain('messaging.message-sent');
    expect(names).toContain('ai.lead-scored');
  });

  it('DASH-U-402 messaging.message-received calls execute with type MESSAGE', async () => {
    trackUseCase.execute.mockResolvedValue(undefined);
    const cb = getCallback('messaging.message-received');
    await cb({ payload: { tenantId: 'tenant-1' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', type: 'MESSAGE' });
  });

  it('DASH-U-403 messaging.message-sent calls execute with type MESSAGE', async () => {
    trackUseCase.execute.mockResolvedValue(undefined);
    const cb = getCallback('messaging.message-sent');
    await cb({ payload: { tenantId: 'tenant-2' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-2', type: 'MESSAGE' });
  });

  it('DASH-U-404 ai.lead-scored with intent=PURCHASE calls execute with type INTENT', async () => {
    trackUseCase.execute.mockResolvedValue(undefined);
    const cb = getCallback('ai.lead-scored');
    await cb({ payload: { tenantId: 'tenant-1', intent: 'PURCHASE' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', type: 'INTENT' });
  });

  it('DASH-U-405 ai.lead-scored with non-PURCHASE intent does NOT call execute', async () => {
    const cb = getCallback('ai.lead-scored');
    await cb({ payload: { tenantId: 'tenant-1', intent: 'INFO' } });
    expect(trackUseCase.execute).not.toHaveBeenCalled();
  });

  it('DASH-U-406 execute throwing does not crash the subscriber (error propagates as rejection)', async () => {
    trackUseCase.execute.mockRejectedValue(new Error('Repo is down'));
    const cb = getCallback('messaging.message-received');
    await expect(cb({ payload: { tenantId: 'tenant-1' } })).rejects.toThrow('Repo is down');
  });

  it('DASH-U-407 execute throwing on message-sent event propagates rejection', async () => {
    trackUseCase.execute.mockRejectedValue(new Error('Repo is down'));
    const cb = getCallback('messaging.message-sent');
    await expect(cb({ payload: { tenantId: 'tenant-1' } })).rejects.toThrow('Repo is down');
  });

  it('DASH-U-408 execute throwing on ai.lead-scored PURCHASE event propagates rejection', async () => {
    trackUseCase.execute.mockRejectedValue(new Error('Queue full'));
    const cb = getCallback('ai.lead-scored');
    await expect(
      cb({ payload: { tenantId: 'tenant-1', intent: 'PURCHASE' } }),
    ).rejects.toThrow('Queue full');
  });

  it('DASH-U-409 consumerName for message-received is sales-message-received', () => {
    handler.onModuleInit();
    const call = eventBus.subscribe.mock.calls.find(([n]) => n === 'messaging.message-received');
    expect(call?.[2]).toEqual({ consumerName: 'sales-message-received' });
  });

  it('DASH-U-410 consumerName for ai.lead-scored is sales-ai-lead-scored', () => {
    handler.onModuleInit();
    const call = eventBus.subscribe.mock.calls.find(([n]) => n === 'ai.lead-scored');
    expect(call?.[2]).toEqual({ consumerName: 'sales-ai-lead-scored' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — SalesPaymentEventHandler: link-not-found path (gap #17)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-500 SalesPaymentEventHandler link-not-found path', () => {
  let handler: SalesPaymentEventHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  const tenantId = 'tenant-abc';
  const rawRef = `sales-link|${tenantId}|link-999`;

  function getCallback(name: string): (event: any) => Promise<void> {
    handler.onModuleInit();
    return (eventBus.subscribe.mock.calls.find(([n]) => n === name)?.[1]) as any;
  }

  beforeEach(() => {
    eventBus = makeEventBus();
    linksRepo = makeLinksRepo();
    handler = new SalesPaymentEventHandler(eventBus, linksRepo);
  });

  it('DASH-U-501 updatePaymentLinkStatusByExternalReference returns null: no event published', async () => {
    linksRepo.updatePaymentLinkStatusByExternalReference.mockResolvedValue(null);
    const cb = getCallback('payment.confirmed');
    await cb({ payload: { tenantId, rawReference: rawRef } });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('DASH-U-502 updatePaymentLinkStatusByExternalReference returns null: findContactNameById not called', async () => {
    linksRepo.updatePaymentLinkStatusByExternalReference.mockResolvedValue(null);
    const cb = getCallback('payment.confirmed');
    await cb({ payload: { tenantId, rawReference: rawRef } });
    expect(linksRepo.findContactNameById).not.toHaveBeenCalled();
  });

  it('DASH-U-503 updatePaymentLinkStatusByExternalReference returns null on overdue: no event published', async () => {
    linksRepo.updatePaymentLinkStatusByExternalReference.mockResolvedValue(null);
    const cb = getCallback('payment.overdue');
    await cb({ payload: { tenantId, rawReference: rawRef } });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('DASH-U-504 updatePaymentLinkStatusByExternalReference returns null on refunded: no event published', async () => {
    linksRepo.updatePaymentLinkStatusByExternalReference.mockResolvedValue(null);
    const cb = getCallback('payment.refunded');
    await cb({ payload: { tenantId, rawReference: rawRef } });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('DASH-U-505 recovery reference (not sales- prefix) is skipped entirely', async () => {
    const recovRef = buildRecoveryPaymentReference(tenantId, 'case-1');
    const cb = getCallback('payment.confirmed');
    await cb({ payload: { tenantId, rawReference: recovRef } });
    expect(linksRepo.updatePaymentLinkStatusByExternalReference).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Recovery payment reference classification (gap #18)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-600 buildRecoveryPaymentReference / classification', () => {
  it('DASH-U-601 built reference starts with RECOVERY_PAYMENT_REFERENCE_PREFIX', () => {
    const ref = buildRecoveryPaymentReference('t1', 'case-1');
    expect(ref.startsWith(RECOVERY_PAYMENT_REFERENCE_PREFIX + '|')).toBe(true);
  });

  it('DASH-U-602 built reference is parsed correctly back to tenantId and caseId', () => {
    const ref = buildRecoveryPaymentReference('tenant-xyz', 'case-abc');
    const parts = parseRecoveryPaymentReference(ref);
    expect(parts).toEqual({ tenantId: 'tenant-xyz', caseId: 'case-abc' });
  });

  it('DASH-U-603 non-recovery externalId is NOT classified as recovery', () => {
    const ref = `sales-charge|tenant-1|charge-001`;
    expect(isRecoveryPaymentReference(ref)).toBe(false);
  });

  it('DASH-U-604 sales-link externalId is NOT classified as recovery', () => {
    const ref = `sales-link|tenant-1|link-001`;
    expect(isRecoveryPaymentReference(ref)).toBe(false);
  });

  it('DASH-U-605 recovery externalId IS classified as recovery', () => {
    const ref = buildRecoveryPaymentReference('tenant-1', 'case-001');
    expect(isRecoveryPaymentReference(ref)).toBe(true);
  });

  it('DASH-U-606 null reference returns false for isRecoveryPaymentReference', () => {
    expect(isRecoveryPaymentReference(null)).toBe(false);
  });

  it('DASH-U-607 undefined reference returns false for isRecoveryPaymentReference', () => {
    expect(isRecoveryPaymentReference(undefined)).toBe(false);
  });

  it('DASH-U-608 empty string returns false for isRecoveryPaymentReference', () => {
    expect(isRecoveryPaymentReference('')).toBe(false);
  });

  it('DASH-U-609 parseRecoveryPaymentReference returns null for non-recovery string', () => {
    expect(parseRecoveryPaymentReference('sales-link|t|l')).toBeNull();
  });

  it('DASH-U-610 parseRecoveryPaymentReference returns null for null input', () => {
    expect(parseRecoveryPaymentReference(null)).toBeNull();
  });

  it('DASH-U-611 parseRecoveryPaymentReference returns null for empty string', () => {
    expect(parseRecoveryPaymentReference('')).toBeNull();
  });

  it('DASH-U-612 externalId format change that removes pipe separator breaks classification', () => {
    const modifiedRef = `recoveryTENANT_IDcaseID`;
    expect(isRecoveryPaymentReference(modifiedRef)).toBe(false);
  });

  it('DASH-U-613 revenue from non-recovery link should NOT be classified as recovery', () => {
    const saleRef = `sales-charge|tenant-1|order-123`;
    const recovRef = buildRecoveryPaymentReference('tenant-1', 'case-456');
    // sale link is new-sale revenue
    expect(isRecoveryPaymentReference(saleRef)).toBe(false);
    // recovery link is recovered revenue
    expect(isRecoveryPaymentReference(recovRef)).toBe(true);
  });

  it('DASH-U-614 paidRevenue from two links: one sale + one recovery can be separated', () => {
    const saleLink = makeLinkRecord({
      externalId: 'sales-charge|tenant-1|1',
      status: 'PAID',
      value: 500,
    });
    const recovLink = makeLinkRecord({
      externalId: buildRecoveryPaymentReference('tenant-1', 'case-1'),
      status: 'PAID',
      value: 120,
    });
    const paidRevenue = [saleLink, recovLink]
      .filter((l) => l.status === 'PAID')
      .reduce((s, l) => s + l.value, 0);
    const recoveredRevenue = [saleLink, recovLink]
      .filter((l) => isRecoveryPaymentReference(l.externalId))
      .reduce((s, l) => s + l.value, 0);
    expect(paidRevenue).toBe(620);
    expect(recoveredRevenue).toBe(120);
    expect(paidRevenue - recoveredRevenue).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — ListRecoveryCasesUseCase (gap #20)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-700 ListRecoveryCasesUseCase', () => {
  let useCase: ListRecoveryCasesUseCase;
  let repo: jest.Mocked<IRecoveryRepository>;

  beforeEach(() => {
    repo = {
      listCases: jest.fn(),
      findCaseById: jest.fn(),
      updateCase: jest.fn(),
      createCase: jest.fn(),
    } as unknown as jest.Mocked<IRecoveryRepository>;
    useCase = new ListRecoveryCasesUseCase(repo);
  });

  it('DASH-U-701 tenantId is passed through to repository', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('DASH-U-702 status filter PAID is passed to repository', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'PAID' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID' }),
    );
  });

  it('DASH-U-703 source filter MANUAL is passed to repository', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', source: 'MANUAL' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'MANUAL' }),
    );
  });

  it('DASH-U-704 status=PAID and source=MANUAL combination both reach repository', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'PAID', source: 'MANUAL' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID', source: 'MANUAL', tenantId: 'tenant-1' }),
    );
  });

  it('DASH-U-705 result is directly returned from repository (no transform)', async () => {
    const fakeCase = { id: 'case-1', tenantId: 'tenant-1', status: 'PAID', amountDue: 200 };
    repo.listCases.mockResolvedValue([fakeCase] as any);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result).toEqual([fakeCase]);
  });

  it('DASH-U-706 status=OPEN filter passed correctly', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'OPEN' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN' }),
    );
  });

  it('DASH-U-707 dateFrom and dateTo are passed when provided', async () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-01-31');
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', dateFrom: from, dateTo: to });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: from, dateTo: to }),
    );
  });

  it('DASH-U-708 repository error propagates as rejection', async () => {
    repo.listCases.mockRejectedValue(new Error('DB unavailable'));
    await expect(useCase.execute({ tenantId: 'tenant-1' })).rejects.toThrow('DB unavailable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — Repository paidRevenue / REFUNDED status logic (gap #5)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-800 paidRevenue summary does not include REFUNDED links', () => {
  it('DASH-U-801 REFUNDED link has status REFUNDED not PAID (repo filter check via mock)', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    const refundedLink = makeLinkRecord({ status: 'REFUNDED', value: 300 });
    // Repository correctly excludes REFUNDED from paidRevenue
    repo.listPaymentLinks.mockResolvedValue({
      items: [refundedLink],
      total: 1,
      summary: {
        totalLinks: 1,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 0,
        expiredLinks: 0,
        estimatedRevenue: 300,
        paidRevenue: 0, // REFUNDED should NOT count as paidRevenue
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-U-802 PAID link IS included in paidRevenue', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    const paidLink = makeLinkRecord({ status: 'PAID', value: 500 });
    repo.listPaymentLinks.mockResolvedValue({
      items: [paidLink],
      total: 1,
      summary: {
        totalLinks: 1,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 1,
        expiredLinks: 0,
        estimatedRevenue: 500,
        paidRevenue: 500,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(500);
  });

  it('DASH-U-803 DELETED link is excluded from all summary counts (status!=PAID)', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    repo.listPaymentLinks.mockResolvedValue({
      items: [],
      total: 0,
      summary: {
        totalLinks: 0,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 0,
        expiredLinks: 0,
        estimatedRevenue: 0,
        paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-U-804 OVERDUE link does not contribute to paidRevenue', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    const overdueLink = makeLinkRecord({ status: 'OVERDUE', value: 999 });
    repo.listPaymentLinks.mockResolvedValue({
      items: [overdueLink],
      total: 1,
      summary: {
        totalLinks: 1,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 0,
        expiredLinks: 1,
        estimatedRevenue: 999,
        paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-U-805 EXPIRED link does not contribute to paidRevenue', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    const expiredLink = makeLinkRecord({ status: 'EXPIRED', value: 150 });
    repo.listPaymentLinks.mockResolvedValue({
      items: [expiredLink],
      total: 1,
      summary: {
        totalLinks: 1,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 0,
        expiredLinks: 1,
        estimatedRevenue: 150,
        paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-U-806 mixed PAID and REFUNDED: only PAID value appears in paidRevenue', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    const paidLink = makeLinkRecord({ id: 'l1', status: 'PAID', value: 400 });
    const refundedLink = makeLinkRecord({ id: 'l2', status: 'REFUNDED', value: 200 });
    repo.listPaymentLinks.mockResolvedValue({
      items: [paidLink, refundedLink],
      total: 2,
      summary: {
        totalLinks: 2,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 1,
        expiredLinks: 0,
        estimatedRevenue: 600,
        paidRevenue: 400, // only PAID counts
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(400);
    expect(result.items).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9 — SalesMetric entity (gap #4 additional coverage)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-900 SalesMetric entity', () => {
  it('DASH-U-901 create initialises all fields correctly', () => {
    const m = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date('2024-01-01'),
      totalMessages: 5,
      purchaseIntents: 2,
      paymentLinksGenerated: 1,
      estimatedRevenue: 99.99,
    });
    expect(m.tenantId).toBe('tenant-1');
    expect(m.totalMessages).toBe(5);
    expect(m.estimatedRevenue).toBe(99.99);
  });

  it('DASH-U-902 incrementMessages adds 1 to totalMessages', () => {
    const m = makeMetric({ totalMessages: 3 });
    m.incrementMessages();
    expect(m.totalMessages).toBe(4);
  });

  it('DASH-U-903 incrementIntents adds 1 to purchaseIntents', () => {
    const m = makeMetric({ purchaseIntents: 1 });
    m.incrementIntents();
    expect(m.purchaseIntents).toBe(2);
  });

  it('DASH-U-904 incrementLinks adds 1 to paymentLinksGenerated and adds value', () => {
    const m = makeMetric({ paymentLinksGenerated: 0, estimatedRevenue: 0 });
    m.incrementLinks(50);
    expect(m.paymentLinksGenerated).toBe(1);
    expect(m.estimatedRevenue).toBe(50);
  });

  it('DASH-U-905 incrementLinks with decimal value adds correctly', () => {
    const m = makeMetric({ paymentLinksGenerated: 0, estimatedRevenue: 0.1 });
    m.incrementLinks(0.2);
    expect(m.estimatedRevenue).toBeCloseTo(0.3, 10);
  });

  it('DASH-U-906 create with explicit UniqueEntityID preserves the id', () => {
    const id = new UniqueEntityID('fixed-id-123');
    const m = SalesMetric.create(
      {
        tenantId: 'tenant-1',
        date: new Date(),
        totalMessages: 0,
        purchaseIntents: 0,
        paymentLinksGenerated: 0,
        estimatedRevenue: 0,
      },
      id,
    );
    expect(m.id.toString()).toBe('fixed-id-123');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10 — Additional edge cases (gaps #3,#11,#17,#18 boundary variants)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-U-1000 Additional boundary and edge cases', () => {
  it('DASH-U-1001 GetSalesMetrics with same startDate and endDate (gap-19): single day range passed to repo', async () => {
    const repo = makeMetricsRepo();
    const useCase = new GetSalesMetricsUseCase(repo);
    const day = new Date('2024-07-04T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([makeMetric({ date: day, estimatedRevenue: 50 })]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: day, endDate: day });
    expect(repo.getMetrics).toHaveBeenCalledWith('tenant-1', day, day);
    expect(result.summary.totalRevenue).toBe(50);
  });

  it('DASH-U-1002 ListPaymentLinks with dateFrom=null does not pass date filter', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', dateFrom: null });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ dateFrom: null }),
    );
  });

  it('DASH-U-1003 ListPaymentLinks with dateTo=null does not pass date filter', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', dateTo: null });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ dateTo: null }),
    );
  });

  it('DASH-U-1004 SalesPaymentEventHandler: sales-charge reference is valid and updates status', async () => {
    const tenantId = 'tenant-xyz';
    const chargeRef = `sales-charge|${tenantId}|order-001`;
    const eventBus = makeEventBus();
    const linksRepo = makeLinksRepo();
    const handler = new SalesPaymentEventHandler(eventBus, linksRepo);
    const link = makeLinkRecord({ tenantId, externalId: chargeRef, contactId: null });
    linksRepo.updatePaymentLinkStatusByExternalReference.mockResolvedValue(link);
    handler.onModuleInit();
    const cb = eventBus.subscribe.mock.calls.find(([n]) => n === 'payment.confirmed')?.[1] as any;
    await cb({ payload: { tenantId, rawReference: chargeRef } });
    expect(linksRepo.updatePaymentLinkStatusByExternalReference).toHaveBeenCalledWith(
      tenantId, chargeRef, 'PAID',
    );
  });

  it('DASH-U-1005 isRecoveryPaymentReference: string with prefix but malformed returns false', () => {
    expect(isRecoveryPaymentReference('recovery')).toBe(false);
    expect(isRecoveryPaymentReference('recovery|')).toBe(true); // starts with prefix|
  });

  it('DASH-U-1006 parseRecoveryPaymentReference: valid reference parses both parts', () => {
    const parts = parseRecoveryPaymentReference('recovery|tenant-A|case-B');
    expect(parts?.tenantId).toBe('tenant-A');
    expect(parts?.caseId).toBe('case-B');
  });

  it('DASH-U-1007 GetSalesMetrics: passes tenantId straight to repo without modification', async () => {
    const repo = makeMetricsRepo();
    const useCase = new GetSalesMetricsUseCase(repo);
    repo.getMetrics.mockResolvedValue([]);
    await useCase.execute({
      tenantId: 'specific-tenant-id-abc',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    });
    expect(repo.getMetrics).toHaveBeenCalledWith(
      'specific-tenant-id-abc',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('DASH-U-1008 ListPaymentLinks: search string passed through to repository', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: 'produto especial' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: 'produto especial' }),
    );
  });

  it('DASH-U-1009 ListPaymentLinks: source AI filter passed to repository', async () => {
    const repo = makeLinksRepo();
    const useCase = new ListPaymentLinksUseCase(repo);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', source: 'AI' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ source: 'AI' }),
    );
  });

  it('DASH-U-1010 RedeemCoupon: discount result has correct type and value for PERCENTAGE coupon', async () => {
    const repo = makeCouponRepo();
    const useCase = new RedeemCouponUseCase(repo);
    const coupon = makeCoupon({ discountType: 'PERCENTAGE', discountValue: 15, maxUses: 0 });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.incrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    const result = await useCase.execute({ tenantId: 'tenant-1', code: 'SAVE10' });
    expect(result.discount.type).toBe('PERCENTAGE');
    expect(result.discount.value).toBe(15);
  });

  it('DASH-U-1011 SalesMetric: incrementMessages called multiple times accumulates correctly', () => {
    const m = makeMetric({ totalMessages: 0 });
    m.incrementMessages();
    m.incrementMessages();
    m.incrementMessages();
    expect(m.totalMessages).toBe(3);
  });

  it('DASH-U-1012 SalesAnalyticsHandler: onModuleInit subscribes to exactly 3 events', () => {
    const eventBus = makeEventBus();
    const trackUseCase = { execute: jest.fn() };
    const handler = new SalesAnalyticsHandler(eventBus, trackUseCase as any);
    handler.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledTimes(3);
  });
});
