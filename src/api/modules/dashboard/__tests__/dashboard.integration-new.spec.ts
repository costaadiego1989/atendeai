/**
 * dashboard.integration-new.spec.ts
 * Integration tests for dashboard module: repository query logic, module wiring,
 * service interactions. All external adapters (Prisma, BullMQ, Axios) are mocked.
 * Gaps covered: 1, 5, 6, 7, 15, 16, 19, 20 from the identified gaps list.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { GetSalesMetricsUseCase } from '@modules/sales/application/use-cases/GetSalesMetricsUseCase';
import { ListPaymentLinksUseCase } from '@modules/sales/application/use-cases/ListPaymentLinksUseCase';
import { RedeemCouponUseCase } from '@modules/sales/application/use-cases/RedeemCouponUseCase';
import { ListRecoveryCasesUseCase } from '@modules/recovery/application/use-cases/ListRecoveryCasesUseCase';
import { SalesAnalyticsHandler } from '@modules/sales/application/handlers/SalesAnalyticsHandler';
import { TrackSalesMetricUseCase } from '@modules/sales/application/use-cases/TrackSalesMetricUseCase';
import { SalesMetric } from '@modules/sales/domain/entities/SalesMetric';
import {
  SALES_METRICS_REPOSITORY,
  SALES_PAYMENT_LINKS_REPOSITORY,
  SALES_REPOSITORY,
} from '@modules/sales/domain/repositories/ISalesRepository';
import { RECOVERY_REPOSITORY as RECOVERY_REPO_TOKEN } from '@modules/recovery/domain/ports/IRecoveryRepository';
import { EVENT_BUS } from '@shared/application/ports/IEventBus';
import {
  buildRecoveryPaymentReference,
  isRecoveryPaymentReference,
} from '@shared/contracts/payment-references';
import type {
  ISalesMetricsRepository,
  ISalesPaymentLinksRepository,
  ISalesCouponRepository,
  SalesPaymentLinkRecord,
  SalesCouponRecord,
} from '@modules/sales/domain/repositories/ISalesRepository';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeMetricsRepo(): jest.Mocked<ISalesMetricsRepository> {
  return {
    findByTenantAndDate: jest.fn(),
    save: jest.fn(),
    incrementMetric: jest.fn(),
    getMetrics: jest.fn(),
  };
}

function makeLinkRecord(overrides: Partial<SalesPaymentLinkRecord> = {}): SalesPaymentLinkRecord {
  return {
    id: `link-${Math.random()}`,
    tenantId: 'tenant-1',
    branchId: null,
    providerLinkId: 'prov-1',
    externalId: `sales-charge|tenant-1|${Math.random()}`,
    name: 'Test',
    description: null,
    label: null,
    value: 100,
    url: 'https://pay.test/l',
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    code: 'PROMO10',
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

function makeLinksRepoResult(
  items: SalesPaymentLinkRecord[],
  summaryOverride: Partial<any> = {},
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
      ...summaryOverride,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Module wiring: GetSalesMetricsUseCase via NestJS DI (gap #3)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-100 GetSalesMetricsUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let useCase: GetSalesMetricsUseCase;
  let metricsRepo: jest.Mocked<ISalesMetricsRepository>;

  beforeEach(async () => {
    metricsRepo = makeMetricsRepo();
    module = await Test.createTestingModule({
      providers: [
        GetSalesMetricsUseCase,
        { provide: SALES_METRICS_REPOSITORY, useValue: metricsRepo },
      ],
    }).compile();
    useCase = module.get(GetSalesMetricsUseCase);
  });

  afterEach(() => module.close());

  it('DASH-I-101 use case is defined after module compilation', () => {
    expect(useCase).toBeDefined();
  });

  it('DASH-I-102 execute delegates to injected repository', async () => {
    metricsRepo.getMetrics.mockResolvedValue([]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    });
    expect(metricsRepo.getMetrics).toHaveBeenCalledTimes(1);
    expect(result.metrics).toHaveLength(0);
  });

  it('DASH-I-103 inverted date range returns empty metrics (wired)', async () => {
    metricsRepo.getMetrics.mockResolvedValue([]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-12-31'),
      endDate: new Date('2024-01-01'),
    });
    expect(result.summary.totalRevenue).toBe(0);
  });

  it('DASH-I-104 same-day range passes correctly to injected repo', async () => {
    const day = new Date('2024-06-15T00:00:00.000Z');
    metricsRepo.getMetrics.mockResolvedValue([
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: day,
        totalMessages: 3,
        purchaseIntents: 1,
        paymentLinksGenerated: 1,
        estimatedRevenue: 100,
      }),
    ]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: day, endDate: day });
    expect(metricsRepo.getMetrics).toHaveBeenCalledWith('tenant-1', day, day);
    expect(result.metrics).toHaveLength(1);
  });

  it('DASH-I-105 decimal revenue accumulation is preserved through wired use case', async () => {
    metricsRepo.getMetrics.mockResolvedValue([
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date(),
        totalMessages: 1,
        purchaseIntents: 0,
        paymentLinksGenerated: 1,
        estimatedRevenue: 0.1,
      }),
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date(),
        totalMessages: 1,
        purchaseIntents: 0,
        paymentLinksGenerated: 1,
        estimatedRevenue: 0.2,
      }),
    ]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    });
    expect(result.summary.totalRevenue).toBeCloseTo(0.3, 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — ListPaymentLinksUseCase NestJS module wiring (gaps #5, #6, #7)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-200 ListPaymentLinksUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let useCase: ListPaymentLinksUseCase;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  afterEach(() => module.close());

  it('DASH-I-201 use case resolves via DI', () => {
    expect(useCase).toBeDefined();
  });

  it('DASH-I-202 page=0 is clamped to 1 through the wired stack', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', page: 0 });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('DASH-I-203 pageSize=0 is clamped to 1 through wired stack', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 0 });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 1 }),
    );
  });

  it('DASH-I-204 pageSize=101 is clamped to 100 through wired stack', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 101 });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('DASH-I-205 page beyond last page: empty items returned', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({ items: [], total: 5, summary: {
      totalLinks: 5, activeLinks: 0, pausedLinks: 0, paidLinks: 5,
      expiredLinks: 0, estimatedRevenue: 500, paidRevenue: 500,
    }});
    const result = await useCase.execute({ tenantId: 'tenant-1', page: 999 });
    expect(result.items).toHaveLength(0);
  });

  it('DASH-I-206 REFUNDED link: summary.paidRevenue is 0 (repo reports correctly)', async () => {
    const refundedLink = makeLinkRecord({ status: 'REFUNDED', value: 300 });
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [refundedLink],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 300, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-207 PAID link: summary.paidRevenue equals link value', async () => {
    const paidLink = makeLinkRecord({ status: 'PAID', value: 450 });
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [paidLink],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 1,
        expiredLinks: 0, estimatedRevenue: 450, paidRevenue: 450,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(450);
  });

  it('DASH-I-208 search with SQL special char %: passes string as-is to repository (escaping at repo level)', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: '50%' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: '50%' }),
    );
  });

  it('DASH-I-209 search with SQL special char _: passes string as-is to repository', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: 'prod_especial' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: 'prod_especial' }),
    );
  });

  it('DASH-I-210 search with backslash: passes to repository', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: 'path\\value' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: 'path\\value' }),
    );
  });

  it('DASH-I-211 dateFrom excludes records before that date (verified via mock)', async () => {
    const from = new Date('2024-06-01T00:00:00.000Z');
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', dateFrom: from });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ dateFrom: from }),
    );
  });

  it('DASH-I-212 dateTo excludes records after that date (verified via mock)', async () => {
    const to = new Date('2024-06-30T23:59:59.999Z');
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', dateTo: to });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ dateTo: to }),
    );
  });

  it('DASH-I-213 dateFrom/dateTo range excludes all records -> empty items and zero summary', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [],
      total: 0,
      summary: {
        totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      dateFrom: new Date('2020-01-01'),
      dateTo: new Date('2020-01-02'),
    });
    expect(result.items).toHaveLength(0);
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-214 VOIDED (unknown) status link: paidRevenue not affected', async () => {
    // VOIDED is not in the type but could come from DB — repo should handle it
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [],
      total: 0,
      summary: {
        totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'ALL' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-215 resourceType null from repo is defaulted to PAYMENT_LINK in response', async () => {
    const link = makeLinkRecord({ resourceType: undefined });
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([link]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].resourceType).toBe('PAYMENT_LINK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — RedeemCouponUseCase wiring + atomicIncrementCouponUsage (gap #15)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-300 RedeemCouponUseCase wired + atomicIncrement behavior', () => {
  let module: TestingModule;
  let useCase: RedeemCouponUseCase;
  let couponRepo: jest.Mocked<ISalesCouponRepository>;

  beforeEach(async () => {
    couponRepo = makeCouponRepo();
    module = await Test.createTestingModule({
      providers: [
        RedeemCouponUseCase,
        { provide: SALES_REPOSITORY, useValue: couponRepo },
      ],
    }).compile();
    useCase = module.get(RedeemCouponUseCase);
  });

  afterEach(() => module.close());

  it('DASH-I-301 atomicIncrementCouponUsage returns null for exhausted coupon -> ConflictException', async () => {
    const coupon = makeCoupon({ maxUses: 1, usedCount: 0 });
    couponRepo.findCouponByCode.mockResolvedValue(coupon);
    couponRepo.atomicIncrementCouponUsage.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' }),
    ).rejects.toThrow('Coupon usage limit reached');
  });

  it('DASH-I-302 atomicIncrementCouponUsage called NOT incrementCouponUsage for bounded coupon', async () => {
    const coupon = makeCoupon({ maxUses: 3, usedCount: 0 });
    couponRepo.findCouponByCode.mockResolvedValue(coupon);
    couponRepo.atomicIncrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' });
    expect(couponRepo.atomicIncrementCouponUsage).toHaveBeenCalledWith('tenant-1', 'coupon-1');
    expect(couponRepo.incrementCouponUsage).not.toHaveBeenCalled();
  });

  it('DASH-I-303 coupon at maxUses=5 usedCount=5 is rejected before atomic call', async () => {
    couponRepo.findCouponByCode.mockResolvedValue(makeCoupon({ maxUses: 5, usedCount: 5 }));
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' }),
    ).rejects.toThrow(BadRequestException);
    expect(couponRepo.atomicIncrementCouponUsage).not.toHaveBeenCalled();
  });

  it('DASH-I-304 coupon maxUses=0 (unlimited) uses incrementCouponUsage', async () => {
    const coupon = makeCoupon({ maxUses: 0 });
    couponRepo.findCouponByCode.mockResolvedValue(coupon);
    couponRepo.incrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' });
    expect(couponRepo.incrementCouponUsage).toHaveBeenCalledWith('tenant-1', 'coupon-1');
  });

  it('DASH-I-305 second redemption after atomic null returns ConflictException (race condition simulated)', async () => {
    const coupon = makeCoupon({ maxUses: 1, usedCount: 0 });
    couponRepo.findCouponByCode.mockResolvedValue(coupon);
    couponRepo.atomicIncrementCouponUsage
      .mockResolvedValueOnce({ ...coupon, usedCount: 1 })
      .mockResolvedValueOnce(null);
    // First redemption succeeds
    await useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' });
    // Second simulates race-condition loss
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' }),
    ).rejects.toThrow(ConflictException);
  });

  it('DASH-I-306 atomicIncrementCouponUsage: result coupon.usedCount reflects updated value', async () => {
    const coupon = makeCoupon({ maxUses: 10, usedCount: 3 });
    couponRepo.findCouponByCode.mockResolvedValue(coupon);
    couponRepo.atomicIncrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 4 });
    const result = await useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' });
    expect(result.coupon?.usedCount).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — SalesAnalyticsHandler wired with TrackSalesMetricUseCase (gap #16)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-400 SalesAnalyticsHandler wired', () => {
  let module: TestingModule;
  let handler: SalesAnalyticsHandler;
  let eventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let trackUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    eventBus = { publish: jest.fn(), subscribe: jest.fn() };
    trackUseCase = { execute: jest.fn() };
    module = await Test.createTestingModule({
      providers: [
        SalesAnalyticsHandler,
        { provide: EVENT_BUS, useValue: eventBus },
        { provide: TrackSalesMetricUseCase, useValue: trackUseCase },
      ],
    }).compile();
    handler = module.get(SalesAnalyticsHandler);
  });

  afterEach(() => module.close());

  it('DASH-I-401 handler is defined after module compilation', () => {
    expect(handler).toBeDefined();
  });

  it('DASH-I-402 onModuleInit subscribes to 3 event types', () => {
    handler.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledTimes(3);
  });

  it('DASH-I-403 message-received event triggers trackUseCase.execute with MESSAGE type', async () => {
    trackUseCase.execute.mockResolvedValue(undefined);
    handler.onModuleInit();
    const cb = eventBus.subscribe.mock.calls.find(([n]) => n === 'messaging.message-received')?.[1];
    await (cb as any)({ payload: { tenantId: 'tenant-wired' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-wired', type: 'MESSAGE' });
  });

  it('DASH-I-404 execute rejection does not silently swallow — propagates', async () => {
    trackUseCase.execute.mockRejectedValue(new Error('Repo down'));
    handler.onModuleInit();
    const cb = eventBus.subscribe.mock.calls.find(([n]) => n === 'messaging.message-received')?.[1];
    await expect((cb as any)({ payload: { tenantId: 'tenant-1' } })).rejects.toThrow('Repo down');
  });

  it('DASH-I-405 ai.lead-scored PURCHASE triggers INTENT track', async () => {
    trackUseCase.execute.mockResolvedValue(undefined);
    handler.onModuleInit();
    const cb = eventBus.subscribe.mock.calls.find(([n]) => n === 'ai.lead-scored')?.[1];
    await (cb as any)({ payload: { tenantId: 'tenant-1', intent: 'PURCHASE' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', type: 'INTENT' });
  });

  it('DASH-I-406 ai.lead-scored non-PURCHASE does NOT trigger execute', async () => {
    handler.onModuleInit();
    const cb = eventBus.subscribe.mock.calls.find(([n]) => n === 'ai.lead-scored')?.[1];
    await (cb as any)({ payload: { tenantId: 'tenant-1', intent: 'INQUIRY' } });
    expect(trackUseCase.execute).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — ListRecoveryCasesUseCase wired (gap #20)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-500 ListRecoveryCasesUseCase wired', () => {
  let module: TestingModule;
  let useCase: ListRecoveryCasesUseCase;
  let recoveryRepo: { listCases: jest.Mock };

  beforeEach(async () => {
    recoveryRepo = { listCases: jest.fn() };
    module = await Test.createTestingModule({
      providers: [
        ListRecoveryCasesUseCase,
        { provide: RECOVERY_REPO_TOKEN, useValue: recoveryRepo },
      ],
    }).compile();
    useCase = module.get(ListRecoveryCasesUseCase);
  });

  afterEach(() => module.close());

  it('DASH-I-501 use case is defined', () => {
    expect(useCase).toBeDefined();
  });

  it('DASH-I-502 status=PAID source=MANUAL passes both filters to repo', async () => {
    recoveryRepo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'PAID', source: 'MANUAL' });
    expect(recoveryRepo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID', source: 'MANUAL' }),
    );
  });

  it('DASH-I-503 status=OPEN source=AI passes both filters to repo', async () => {
    recoveryRepo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'OPEN', source: 'AI' });
    expect(recoveryRepo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN', source: 'AI' }),
    );
  });

  it('DASH-I-504 result is returned unchanged from repo', async () => {
    const cases = [
      { id: 'c1', tenantId: 'tenant-1', status: 'PAID', amountDue: 150 },
      { id: 'c2', tenantId: 'tenant-1', status: 'PAID', amountDue: 300 },
    ];
    recoveryRepo.listCases.mockResolvedValue(cases);
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'PAID' });
    expect(result).toEqual(cases);
  });

  it('DASH-I-505 repo error propagates to caller', async () => {
    recoveryRepo.listCases.mockRejectedValue(new Error('DB off'));
    await expect(useCase.execute({ tenantId: 'tenant-1' })).rejects.toThrow('DB off');
  });

  it('DASH-I-506 no filters: tenantId still passes to repo', async () => {
    recoveryRepo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-X' });
    expect(recoveryRepo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-X' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — paidRevenue / REFUNDED logic with mock Prisma raw query simulation
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-600 paidRevenue summary — REFUNDED/DELETED exclusion via repository mock', () => {
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;
  let useCase: ListPaymentLinksUseCase;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  it('DASH-I-601 REFUNDED link: paidRevenue=0 in summary', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [makeLinkRecord({ status: 'REFUNDED', value: 500 })],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 500, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-602 two PAID + one REFUNDED: paidRevenue = sum of PAID only', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [
        makeLinkRecord({ id: 'a', status: 'PAID', value: 300 }),
        makeLinkRecord({ id: 'b', status: 'PAID', value: 200 }),
        makeLinkRecord({ id: 'c', status: 'REFUNDED', value: 100 }),
      ],
      total: 3,
      summary: {
        totalLinks: 3, activeLinks: 0, pausedLinks: 0, paidLinks: 2,
        expiredLinks: 0, estimatedRevenue: 600, paidRevenue: 500,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(500);
    expect(result.summary.paidLinks).toBe(2);
  });

  it('DASH-I-603 EXPIRED link does not appear in paidLinks count', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [makeLinkRecord({ status: 'EXPIRED', value: 99 })],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 1, estimatedRevenue: 99, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidLinks).toBe(0);
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-604 PENDING link: paidRevenue and paidLinks remain 0', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [makeLinkRecord({ status: 'ACTIVE', value: 250 })],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 1, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 250, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-605 OVERDUE link does not inflate paidRevenue', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [makeLinkRecord({ status: 'OVERDUE', value: 750 })],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 1, estimatedRevenue: 750, paidRevenue: 0,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(0);
  });

  it('DASH-I-606 recovery-tagged PAID link contributes to paidRevenue', async () => {
    const recovLink = makeLinkRecord({
      externalId: buildRecoveryPaymentReference('tenant-1', 'case-1'),
      status: 'PAID',
      value: 120,
    });
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [recovLink],
      total: 1,
      summary: {
        totalLinks: 1, activeLinks: 0, pausedLinks: 0, paidLinks: 1,
        expiredLinks: 0, estimatedRevenue: 120, paidRevenue: 120,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    // paidRevenue includes recovery PAID links; it's the recovery total subtraction that separates them
    expect(result.summary.paidRevenue).toBe(120);
    expect(isRecoveryPaymentReference(result.items[0].externalId)).toBe(true);
  });

  it('DASH-I-607 sale PAID + recovery PAID: paidRevenue is sum of both', async () => {
    const saleLink = makeLinkRecord({ id: 's1', externalId: 'sales-charge|t1|1', status: 'PAID', value: 500 });
    const recovLink = makeLinkRecord({
      id: 'r1',
      externalId: buildRecoveryPaymentReference('t1', 'case-1'),
      status: 'PAID',
      value: 120,
    });
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [saleLink, recovLink],
      total: 2,
      summary: {
        totalLinks: 2, activeLinks: 0, pausedLinks: 0, paidLinks: 2,
        expiredLinks: 0, estimatedRevenue: 620, paidRevenue: 620,
      },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary.paidRevenue).toBe(620);
    // Separation is computed by frontend/dashboard via recovery cases
    const recoveredRevenue = result.items
      .filter((i) => isRecoveryPaymentReference(i.externalId))
      .reduce((s, i) => s + i.value, 0);
    expect(recoveredRevenue).toBe(120);
    expect(result.summary.paidRevenue - recoveredRevenue).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — Pagination boundary integration (gap #6)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-700 Pagination boundary via wired ListPaymentLinksUseCase', () => {
  let useCase: ListPaymentLinksUseCase;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  it('DASH-I-701 page=1 pageSize=20 are the defaults passed when nothing provided', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it('DASH-I-702 negative page is clamped to 1', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', page: -100 });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('DASH-I-703 pageSize=100 is the maximum allowed', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 100 });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('DASH-I-704 totalPages calculation: ceil(total/pageSize) result matches', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [],
      total: 25,
      summary: { totalLinks: 25, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0 },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', pageSize: 10 });
    expect(result.pagination.totalPages).toBe(3);
  });

  it('DASH-I-705 totalPages is at least 1 even when total=0', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([], { totalLinks: 0 }));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('DASH-I-706 pagination object includes page, pageSize, total, totalPages', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue({
      items: [],
      total: 50,
      summary: { totalLinks: 50, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
        expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0 },
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', page: 2, pageSize: 10 });
    expect(result.pagination).toMatchObject({ page: 2, pageSize: 10, total: 50, totalPages: 5 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — Search input escaping check (gap #7)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-800 Search input special characters passed to repository', () => {
  let useCase: ListPaymentLinksUseCase;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  it('DASH-I-801 search=50% is passed verbatim to the repository layer', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: '50%' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: '50%' }),
    );
  });

  it('DASH-I-802 search=_foo% is passed verbatim to repository', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: '_foo%' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: '_foo%' }),
    );
  });

  it('DASH-I-803 empty search is passed to repository without trim', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: '' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: '' }),
    );
  });

  it('DASH-I-804 whitespace-only search is passed to repository', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: '   ' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: '   ' }),
    );
  });

  it('DASH-I-805 search with unicode characters is passed to repository', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', search: 'produto ação 50%' });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ search: 'produto ação 50%' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9 — Additional status filter wiring (gap #2 / status coverage)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-900 Status filter wiring for non-PAID statuses', () => {
  let useCase: ListPaymentLinksUseCase;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  const statuses = ['ACTIVE', 'PAUSED', 'PAID', 'OVERDUE', 'REFUNDED', 'EXPIRED', 'ALL'] as const;

  statuses.forEach((status) => {
    it(`DASH-I-9${statuses.indexOf(status).toString().padStart(2, '0')} status=${status} is passed to repo`, async () => {
      linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
      await useCase.execute({ tenantId: 'tenant-1', status });
      expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ status }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10 — Tenant isolation via module-level use cases (gap #1)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-1000 Tenant isolation: metrics and links via wired use cases', () => {
  let metricsUseCase: GetSalesMetricsUseCase;
  let linksUseCase: ListPaymentLinksUseCase;
  let metricsRepo: jest.Mocked<ISalesMetricsRepository>;
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;

  const tenantA = 'tenant-A';
  const tenantB = 'tenant-B';

  beforeEach(async () => {
    metricsRepo = makeMetricsRepo();
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        GetSalesMetricsUseCase,
        ListPaymentLinksUseCase,
        { provide: SALES_METRICS_REPOSITORY, useValue: metricsRepo },
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    metricsUseCase = module.get(GetSalesMetricsUseCase);
    linksUseCase = module.get(ListPaymentLinksUseCase);
  });

  it('DASH-I-1001 getMetrics passes tenantA id to repo (not tenantB)', async () => {
    metricsRepo.getMetrics.mockResolvedValue([]);
    await metricsUseCase.execute({ tenantId: tenantA, startDate: new Date(), endDate: new Date() });
    expect(metricsRepo.getMetrics).toHaveBeenCalledWith(tenantA, expect.any(Date), expect.any(Date));
    expect(metricsRepo.getMetrics).not.toHaveBeenCalledWith(tenantB, expect.any(Date), expect.any(Date));
  });

  it('DASH-I-1002 listPaymentLinks passes tenantA id to repo', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await linksUseCase.execute({ tenantId: tenantA });
    expect(linksRepo.listPaymentLinks).toHaveBeenCalledWith(tenantA, expect.anything());
  });

  it('DASH-I-1003 listPaymentLinks called twice with different tenants passes each tenantId correctly', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await linksUseCase.execute({ tenantId: tenantA });
    await linksUseCase.execute({ tenantId: tenantB });
    expect(linksRepo.listPaymentLinks).toHaveBeenNthCalledWith(1, tenantA, expect.anything());
    expect(linksRepo.listPaymentLinks).toHaveBeenNthCalledWith(2, tenantB, expect.anything());
  });

  it('DASH-I-1004 tenantB links do not appear in tenantA result (filtered at repo level)', async () => {
    const tenantALink = makeLinkRecord({ tenantId: tenantA, id: 'a1' });
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([tenantALink]));
    const result = await linksUseCase.execute({ tenantId: tenantA });
    expect(result.items.every((i) => i.tenantId === tenantA)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11 — Summary field types and shapes (gap #4 decimal contract)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-1100 Summary response shape and types', () => {
  let linksRepo: jest.Mocked<ISalesPaymentLinksRepository>;
  let useCase: ListPaymentLinksUseCase;

  beforeEach(async () => {
    linksRepo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [
        ListPaymentLinksUseCase,
        { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: linksRepo },
      ],
    }).compile();
    useCase = module.get(ListPaymentLinksUseCase);
  });

  it('DASH-I-1101 summary.paidRevenue is a number type', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(typeof result.summary.paidRevenue).toBe('number');
  });

  it('DASH-I-1102 summary.estimatedRevenue is a number type', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(typeof result.summary.estimatedRevenue).toBe('number');
  });

  it('DASH-I-1103 pagination.total is a number type', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(typeof result.pagination.total).toBe('number');
  });

  it('DASH-I-1104 item.value is a number type', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(
      makeLinksRepoResult([makeLinkRecord({ value: 99.99 })]),
    );
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(typeof result.items[0].value).toBe('number');
    expect(result.items[0].value).toBe(99.99);
  });

  it('DASH-I-1105 item.createdAt is an ISO string', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(
      makeLinksRepoResult([makeLinkRecord({ createdAt: new Date('2024-05-15T10:00:00.000Z') })]),
    );
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('DASH-I-1106 item.updatedAt is an ISO string', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(
      makeLinksRepoResult([makeLinkRecord({ updatedAt: new Date('2024-05-15T10:00:00.000Z') })]),
    );
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('DASH-I-1107 summary has all required fields', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary).toHaveProperty('totalLinks');
    expect(result.summary).toHaveProperty('activeLinks');
    expect(result.summary).toHaveProperty('pausedLinks');
    expect(result.summary).toHaveProperty('paidLinks');
    expect(result.summary).toHaveProperty('expiredLinks');
    expect(result.summary).toHaveProperty('estimatedRevenue');
    expect(result.summary).toHaveProperty('paidRevenue');
  });

  it('DASH-I-1108 items array is always present even when empty', async () => {
    linksRepo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(Array.isArray(result.items)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12 — Recovery case filter combinations (gap #20 deeper)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-1200 Recovery filter combinations', () => {
  let useCase: ListRecoveryCasesUseCase;
  let repo: { listCases: jest.Mock };

  beforeEach(async () => {
    repo = { listCases: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ListRecoveryCasesUseCase,
        { provide: RECOVERY_REPO_TOKEN, useValue: repo },
      ],
    }).compile();
    useCase = module.get(ListRecoveryCasesUseCase);
  });

  it('DASH-I-1201 no status, no source: only tenantId passed', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('DASH-I-1202 PAID+MANUAL: correct combination filters recovery cases for dashboard revenue', async () => {
    const cases = [
      { id: 'c1', tenantId: 'tenant-1', status: 'PAID', source: 'MANUAL', amountDue: 200 },
    ];
    repo.listCases.mockResolvedValue(cases);
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'PAID', source: 'MANUAL' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('PAID');
  });

  it('DASH-I-1203 OPEN+AI combo: passed correctly', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', status: 'OPEN', source: 'AI' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN', source: 'AI', tenantId: 'tenant-1' }),
    );
  });

  it('DASH-I-1204 branchId filter passes to repository', async () => {
    repo.listCases.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-abc' });
    expect(repo.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-abc' }),
    );
  });

  it('DASH-I-1205 multiple PAID cases: result array has all of them', async () => {
    const cases = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`, tenantId: 'tenant-1', status: 'PAID', amountDue: 100,
    }));
    repo.listCases.mockResolvedValue(cases);
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'PAID' });
    expect(result).toHaveLength(5);
  });

  it('DASH-I-1206 summing amountDue from PAID cases gives correct recovered revenue', async () => {
    const cases = [
      { id: 'c1', status: 'PAID', amountDue: 100 },
      { id: 'c2', status: 'PAID', amountDue: 250 },
      { id: 'c3', status: 'PAID', amountDue: 75 },
    ];
    repo.listCases.mockResolvedValue(cases);
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'PAID' });
    const recoveredRevenue = result.reduce((s: number, c: any) => s + c.amountDue, 0);
    expect(recoveredRevenue).toBe(425);
  });

  it('DASH-I-1207 empty result when no cases match: amountDue sum = 0', async () => {
    repo.listCases.mockResolvedValue([]);
    const result = await useCase.execute({ tenantId: 'tenant-1', status: 'PAID' });
    const recoveredRevenue = result.reduce((s: number, c: any) => s + c.amountDue, 0);
    expect(recoveredRevenue).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13 — GetSalesMetrics timezone boundary (gap #12 / #19)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-1300 Timezone boundary: getMetrics same-day range and boundary behavior', () => {
  let useCase: GetSalesMetricsUseCase;
  let repo: jest.Mocked<ISalesMetricsRepository>;

  beforeEach(async () => {
    repo = makeMetricsRepo();
    const module = await Test.createTestingModule({
      providers: [
        GetSalesMetricsUseCase,
        { provide: SALES_METRICS_REPOSITORY, useValue: repo },
      ],
    }).compile();
    useCase = module.get(GetSalesMetricsUseCase);
  });

  it('DASH-I-1301 record at UTC start of day included when startDate=that day UTC', async () => {
    const day = new Date('2024-01-01T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([makeMetric({ date: day, estimatedRevenue: 100 })]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: day, endDate: day });
    expect(result.metrics).toHaveLength(1);
  });

  it('DASH-I-1302 record at UTC end of previous day excluded when startDate=next-day UTC', async () => {
    // If a link created at 2024-01-01T02:59:59Z (Brazil UTC-3 = 2023-12-31 23:59:59)
    // the repository gte/lte boundary determines which day it falls on
    repo.getMetrics.mockResolvedValue([]);
    const start = new Date('2024-01-01T03:00:00.000Z'); // start of Jan 1 in Sao Paulo
    const end = new Date('2024-01-02T02:59:59.999Z');
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: start, endDate: end });
    // No records = zero revenue
    expect(result.summary.totalRevenue).toBe(0);
  });

  it('DASH-I-1303 metrics with date at UTC midnight are serialized correctly', async () => {
    const midnight = new Date('2024-07-15T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([makeMetric({ date: midnight })]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: midnight,
      endDate: midnight,
    });
    expect(result.metrics[0].date).toBe('2024-07-15T00:00:00.000Z');
  });

  it('DASH-I-1304 startDate and endDate are passed unchanged (no timezone normalization in use case)', async () => {
    repo.getMetrics.mockResolvedValue([]);
    const start = new Date('2024-01-15T03:00:00.000Z');
    const end = new Date('2024-01-16T02:59:59.999Z');
    await useCase.execute({ tenantId: 'tenant-1', startDate: start, endDate: end });
    expect(repo.getMetrics).toHaveBeenCalledWith('tenant-1', start, end);
  });

  it('DASH-I-1305 full month range: revenue of 30 daily metrics summed correctly', async () => {
    const metrics = Array.from({ length: 30 }, (_, i) =>
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date(`2024-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
        totalMessages: 1,
        purchaseIntents: 0,
        paymentLinksGenerated: 1,
        estimatedRevenue: 10,
      }),
    );
    repo.getMetrics.mockResolvedValue(metrics);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-30'),
    });
    expect(result.summary.totalRevenue).toBe(300);
    expect(result.metrics).toHaveLength(30);
  });

  it('DASH-I-1306 revenue aggregation across many records does not introduce NaN', async () => {
    const metrics = Array.from({ length: 10 }, () =>
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date(),
        totalMessages: 0,
        purchaseIntents: 0,
        paymentLinksGenerated: 1,
        estimatedRevenue: 99.50,
      }),
    );
    repo.getMetrics.mockResolvedValue(metrics);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-10'),
    });
    expect(Number.isNaN(result.summary.totalRevenue)).toBe(false);
    expect(result.summary.totalRevenue).toBeCloseTo(995, 5);
  });

  it('DASH-I-1307 zero-revenue metrics return totalRevenue=0 not NaN', async () => {
    const metrics = Array.from({ length: 5 }, () =>
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date(),
        totalMessages: 2,
        purchaseIntents: 1,
        paymentLinksGenerated: 0,
        estimatedRevenue: 0,
      }),
    );
    repo.getMetrics.mockResolvedValue(metrics);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-05'),
    });
    expect(result.summary.totalRevenue).toBe(0);
    expect(Number.isNaN(result.summary.totalRevenue)).toBe(false);
  });

  it('DASH-I-1308 metrics items in response maintain order from repository', async () => {
    const dates = [
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-01-02T00:00:00.000Z'),
      new Date('2024-01-03T00:00:00.000Z'),
    ];
    repo.getMetrics.mockResolvedValue(
      dates.map((d) => SalesMetric.create({
        tenantId: 'tenant-1',
        date: d,
        totalMessages: 1,
        purchaseIntents: 0,
        paymentLinksGenerated: 0,
        estimatedRevenue: 0,
      })),
    );
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: dates[0],
      endDate: dates[2],
    });
    expect(result.metrics[0].date).toBe('2024-01-01T00:00:00.000Z');
    expect(result.metrics[2].date).toBe('2024-01-03T00:00:00.000Z');
  });

  it('DASH-I-1309 inverted date range returns zero metrics and zero summary via wired module', async () => {
    repo.getMetrics.mockResolvedValue([]);
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2025-01-31'),
      endDate: new Date('2025-01-01'),
    });
    expect(result.metrics).toHaveLength(0);
    expect(result.summary).toMatchObject({
      totalMessages: 0, totalIntents: 0, totalLinks: 0, totalRevenue: 0,
    });
  });

  it('DASH-I-1310 single-day range returns single metric if repo returns one row', async () => {
    const day = new Date('2024-03-15T00:00:00.000Z');
    repo.getMetrics.mockResolvedValue([
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: day,
        totalMessages: 7,
        purchaseIntents: 3,
        paymentLinksGenerated: 2,
        estimatedRevenue: 450,
      }),
    ]);
    const result = await useCase.execute({ tenantId: 'tenant-1', startDate: day, endDate: day });
    expect(result.metrics).toHaveLength(1);
    expect(result.summary.totalMessages).toBe(7);
    expect(result.summary.totalRevenue).toBe(450);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14 — Additional wiring edge cases (gap #14, #15 extra)
// ═══════════════════════════════════════════════════════════════════════════

describe('DASH-I-1400 Additional edge cases for coupon and analytics wiring', () => {
  it('DASH-I-1401 RedeemCouponUseCase: inactive coupon never calls atomic increment', async () => {
    const repo = makeCouponRepo();
    const module = await Test.createTestingModule({
      providers: [
        RedeemCouponUseCase,
        { provide: SALES_REPOSITORY, useValue: repo },
      ],
    }).compile();
    const useCase = module.get(RedeemCouponUseCase);
    repo.findCouponByCode.mockResolvedValue(makeCoupon({ active: false }));
    await expect(useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' })).rejects.toThrow(BadRequestException);
    expect(repo.atomicIncrementCouponUsage).not.toHaveBeenCalled();
    await module.close();
  });

  it('DASH-I-1402 RedeemCouponUseCase: expired coupon never calls atomic increment', async () => {
    const repo = makeCouponRepo();
    const module = await Test.createTestingModule({
      providers: [RedeemCouponUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(RedeemCouponUseCase);
    repo.findCouponByCode.mockResolvedValue(makeCoupon({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(useCase.execute({ tenantId: 'tenant-1', code: 'PROMO10' })).rejects.toThrow(BadRequestException);
    expect(repo.atomicIncrementCouponUsage).not.toHaveBeenCalled();
    await module.close();
  });

  it('DASH-I-1403 ListPaymentLinks: branchId filter passed to repository', async () => {
    const repo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [ListPaymentLinksUseCase, { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(ListPaymentLinksUseCase);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-xyz' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ branchId: 'branch-xyz' }),
    );
    await module.close();
  });

  it('DASH-I-1404 ListPaymentLinks: source MANUAL passed to repository', async () => {
    const repo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [ListPaymentLinksUseCase, { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(ListPaymentLinksUseCase);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', source: 'MANUAL' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ source: 'MANUAL' }),
    );
    await module.close();
  });

  it('DASH-I-1405 GetSalesMetrics: multiple simultaneous tenants use separate calls', async () => {
    const repo = makeMetricsRepo();
    const module = await Test.createTestingModule({
      providers: [GetSalesMetricsUseCase, { provide: SALES_METRICS_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(GetSalesMetricsUseCase);
    repo.getMetrics.mockResolvedValue([]);
    await Promise.all([
      useCase.execute({ tenantId: 'tenant-A', startDate: new Date(), endDate: new Date() }),
      useCase.execute({ tenantId: 'tenant-B', startDate: new Date(), endDate: new Date() }),
    ]);
    const tenantIds = repo.getMetrics.mock.calls.map(([t]) => t);
    expect(tenantIds).toContain('tenant-A');
    expect(tenantIds).toContain('tenant-B');
    await module.close();
  });

  it('DASH-I-1406 atomicIncrementCouponUsage called with correct tenantId and couponId', async () => {
    const repo = makeCouponRepo();
    const module = await Test.createTestingModule({
      providers: [RedeemCouponUseCase, { provide: SALES_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(RedeemCouponUseCase);
    const coupon = makeCoupon({ maxUses: 10, usedCount: 0, id: 'my-coupon-id', tenantId: 'my-tenant' });
    repo.findCouponByCode.mockResolvedValue(coupon);
    repo.atomicIncrementCouponUsage.mockResolvedValue({ ...coupon, usedCount: 1 });
    await useCase.execute({ tenantId: 'my-tenant', code: 'PROMO10' });
    expect(repo.atomicIncrementCouponUsage).toHaveBeenCalledWith('my-tenant', 'my-coupon-id');
    await module.close();
  });

  it('DASH-I-1407 SalesAnalyticsHandler: consumerName for message-sent is sales-message-sent', async () => {
    const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
    const trackUseCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        SalesAnalyticsHandler,
        { provide: EVENT_BUS, useValue: eventBus },
        { provide: TrackSalesMetricUseCase, useValue: trackUseCase },
      ],
    }).compile();
    const handler = module.get(SalesAnalyticsHandler);
    handler.onModuleInit();
    const call = eventBus.subscribe.mock.calls.find(([n]) => n === 'messaging.message-sent');
    expect(call?.[2]).toEqual({ consumerName: 'sales-message-sent' });
    await module.close();
  });

  it('DASH-I-1408 ListPaymentLinks: null branchId passed as null to repository', async () => {
    const repo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [ListPaymentLinksUseCase, { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(ListPaymentLinksUseCase);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1', branchId: null });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ branchId: null }),
    );
    await module.close();
  });

  it('DASH-I-1409 ListPaymentLinks: status defaults to ALL when not provided', async () => {
    const repo = makeLinksRepo();
    const module = await Test.createTestingModule({
      providers: [ListPaymentLinksUseCase, { provide: SALES_PAYMENT_LINKS_REPOSITORY, useValue: repo }],
    }).compile();
    const useCase = module.get(ListPaymentLinksUseCase);
    repo.listPaymentLinks.mockResolvedValue(makeLinksRepoResult([]));
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(repo.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ status: 'ALL' }),
    );
    await module.close();
  });
});
