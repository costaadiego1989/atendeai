/**
 * dashboard.e2e-new.spec.ts
 * E2E tests for dashboard-facing HTTP endpoints.
 * Gaps covered: 1, 2, 8, 9, 10, 12, 13, 18 from the identified gaps list.
 *
 * Uses the same bootstrapping pattern as dashboard-commercial-metrics.e2e-spec.ts.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import {
  buildRecoveryPaymentReference,
  RECOVERY_PAYMENT_REFERENCE_PREFIX,
  isRecoveryPaymentReference,
} from '@shared/contracts/payment-references';

describe('Dashboard E2E — new tests (DASH-E2E)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  // Tenant A = the primary owner used throughout tests
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;

  const ts = Date.now();
  const ownerEmail = `dash-e2e-owner-${ts}@test.com`;
  const agentEmail = `dash-e2e-agent-${ts}@test.com`;
  const otherOwnerEmail = `dash-e2e-other-${ts}@test.com`;
  const password = 'SenhaForte123!';

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.get('Set-Cookie')![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor(app.get(Reflector)));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 10);

    // Create primary tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Dash E2E Store',
        cnpj: `de2e${ts.toString().slice(-8)}`,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    // Create second tenant
    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Dash E2E Other Store',
        cnpj: `de2eo${ts.toString().slice(-6)}`,
        plan: 'PROFISSIONAL',
      },
    });
    otherTenantId = otherTenant.id;

    // Owner for primary tenant
    await prisma.user.create({
      data: {
        tenantId,
        name: 'E2E Owner',
        email: ownerEmail,
        phone: `119${ts.toString().slice(-7)}`,
        passwordHash,
        role: 'OWNER',
      },
    });

    // Agent for primary tenant
    await prisma.user.create({
      data: {
        tenantId,
        name: 'E2E Agent',
        email: agentEmail,
        phone: `119${(ts + 1).toString().slice(-7)}`,
        passwordHash,
        role: 'AGENT',
      },
    });

    // Owner for other tenant
    await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        name: 'Other Owner',
        email: otherOwnerEmail,
        phone: `119${(ts + 2).toString().slice(-7)}`,
        passwordHash,
        role: 'OWNER',
      },
    });

    ownerCookie = await login(ownerEmail);
    agentCookie = await login(agentEmail);

    // Seed payment links for primary tenant with all statuses
    await prisma.paymentLink.createMany({
      data: [
        {
          tenantId,
          providerLinkId: `prov-paid-${ts}`,
          externalId: `sales-charge|${tenantId}|paid-1`,
          name: 'Link PAID',
          label: 'Pago',
          value: 500,
          url: 'https://pay.test/paid-1',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `prov-refunded-${ts}`,
          externalId: `sales-charge|${tenantId}|refunded-1`,
          name: 'Link REFUNDED',
          label: 'Estornado',
          value: 200,
          url: 'https://pay.test/refunded-1',
          billingType: 'PIX',
          status: 'REFUNDED',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `prov-overdue-${ts}`,
          externalId: `sales-charge|${tenantId}|overdue-1`,
          name: 'Link OVERDUE',
          label: 'Vencido',
          value: 300,
          url: 'https://pay.test/overdue-1',
          billingType: 'PIX',
          status: 'OVERDUE',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `prov-expired-${ts}`,
          externalId: `sales-charge|${tenantId}|expired-1`,
          name: 'Link EXPIRED',
          label: 'Expirado',
          value: 100,
          url: 'https://pay.test/expired-1',
          billingType: 'PIX',
          status: 'EXPIRED',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `prov-active-${ts}`,
          externalId: `sales-charge|${tenantId}|active-1`,
          name: 'Link ACTIVE',
          label: 'Ativo',
          value: 150,
          url: 'https://pay.test/active-1',
          billingType: 'PIX',
          status: 'ACTIVE',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `prov-recovery-${ts}`,
          externalId: buildRecoveryPaymentReference(tenantId, 'case-e2e-1'),
          name: 'Recovery Link',
          label: 'Recuperado',
          value: 120,
          url: 'https://pay.test/recovery-1',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        // Other tenant link
        {
          tenantId: otherTenantId,
          providerLinkId: `prov-other-${ts}`,
          externalId: `sales-charge|${otherTenantId}|other-1`,
          name: 'Other Tenant Link',
          label: 'Outro',
          value: 900,
          url: 'https://pay.test/other-1',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
      ],
    });

    // Recovery cases
    await prisma.recoveryCase.createMany({
      data: [
        {
          tenantId,
          debtorName: 'Devedor A',
          phone: '5511900001111',
          source: 'MANUAL',
          status: 'PAID',
          amountDue: 120,
          paidAt: new Date(),
        },
        {
          tenantId: otherTenantId,
          debtorName: 'Devedor B (outro tenant)',
          phone: '5511900002222',
          source: 'MANUAL',
          status: 'PAID',
          amountDue: 999,
          paidAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.paymentLink
      .deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } })
      .catch(() => {});
    await prisma.recoveryCase
      .deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } })
      .catch(() => {});
    await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId].filter(Boolean) } } }).catch(() => {});
    await app.close();
  });

  // ── Gap #10: unauthenticated requests return 401 ─────────────────────────

  it('DASH-E2E-01 GET /sales/links without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/links?page=1&pageSize=20')
      .expect(401);
  });

  it('DASH-E2E-02 GET /sales/metrics without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics')
      .expect(401);
  });

  // ── Gap #9: AGENT role cannot access /sales/metrics ─────────────────────

  it('DASH-E2E-03 GET /sales/metrics with AGENT cookie returns 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics')
      .set('Cookie', [agentCookie])
      .expect(403);
  });

  // ── Gap #8: invalid date strings return 400 ──────────────────────────────

  it('DASH-E2E-04 GET /sales/metrics with invalid startDate string returns 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?startDate=not-a-date')
      .set('Cookie', [ownerCookie])
      .expect(400);
  });

  it('DASH-E2E-05 GET /sales/metrics with invalid endDate string returns 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?endDate=banana')
      .set('Cookie', [ownerCookie])
      .expect(400);
  });

  it('DASH-E2E-06 GET /sales/metrics with both dates invalid returns 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?startDate=foo&endDate=bar')
      .set('Cookie', [ownerCookie])
      .expect(400);
  });

  // ── Gap #2: non-PAID statuses in paidRevenue summary ────────────────────

  it('DASH-E2E-07 GET /sales/links: REFUNDED link does NOT contribute to paidRevenue', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=ALL&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const paidRevenue = Number(data.summary.paidRevenue);
    // The REFUNDED link (value=200) must not appear in paidRevenue
    // Only PAID items should count: Link PAID (500) + Recovery Link (120) = 620
    expect(paidRevenue).toBeLessThanOrEqual(620);
    // paidRevenue definitely must not include the REFUNDED 200
    expect(paidRevenue).not.toBe(820);
  });

  it('DASH-E2E-08 GET /sales/links?status=REFUNDED returns only REFUNDED items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=REFUNDED&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.items.every((i: any) => i.status === 'REFUNDED')).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('DASH-E2E-09 GET /sales/links?status=OVERDUE returns only OVERDUE items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=OVERDUE&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.items.every((i: any) => i.status === 'OVERDUE')).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('DASH-E2E-10 GET /sales/links?status=EXPIRED returns only EXPIRED items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=EXPIRED&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.items.every((i: any) => i.status === 'EXPIRED')).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  // ── Gap #1: tenant isolation for recovery endpoint ───────────────────────

  it('DASH-E2E-11 GET /tenants/:otherTenantId/recovery/cases with owner cookie returns 403 or empty', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/recovery/cases`)
      .set('Cookie', [ownerCookie]);

    // TenantGuard should return 403; or if the guard allows the route but filters by auth tenant,
    // the result must be empty (not contain otherTenantId data)
    if (res.status === 200) {
      const items = res.body.data ?? res.body;
      expect(Array.isArray(items)).toBe(true);
      if (Array.isArray(items)) {
        expect(items.every((i: any) => i.tenantId !== otherTenantId)).toBe(true);
      }
    } else {
      expect(res.status).toBe(403);
    }
  });

  it('DASH-E2E-12 GET /tenants/:tenantId/recovery/cases with owner cookie returns 200 with only own tenant cases', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    const items = res.body.data ?? res.body;
    if (Array.isArray(items)) {
      expect(items.every((i: any) => i.tenantId !== otherTenantId)).toBe(true);
    }
  });

  // ── Gap #13: dateFrom/dateTo filters on GET /sales/links ─────────────────

  it('DASH-E2E-13 GET /sales/links with future dateFrom returns empty items', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 365).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales/links?dateFrom=${futureDate}&pageSize=100`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.items).toHaveLength(0);
    expect(Number(data.summary.paidRevenue)).toBe(0);
  });

  it('DASH-E2E-14 GET /sales/links with dateTo in the past returns empty items', async () => {
    const pastDate = new Date('2000-01-01T00:00:00.000Z').toISOString();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales/links?dateTo=${pastDate}&pageSize=100`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.items).toHaveLength(0);
  });

  // ── Gap #18: recovery classification via externalId prefix ──────────────

  it('DASH-E2E-15 GET /sales/links: recovery link has externalId starting with RECOVERY_PAYMENT_REFERENCE_PREFIX', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=PAID&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const recoveryItems = data.items.filter((i: any) =>
      isRecoveryPaymentReference(i.externalId),
    );
    expect(recoveryItems.length).toBeGreaterThanOrEqual(1);
  });

  it('DASH-E2E-16 GET /sales/links: non-recovery sale links do NOT have recovery prefix', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=PAID&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const saleOnlyItems = data.items.filter((i: any) =>
      !isRecoveryPaymentReference(i.externalId),
    );
    expect(saleOnlyItems.length).toBeGreaterThanOrEqual(1);
    saleOnlyItems.forEach((item: any) => {
      expect(item.externalId).not.toMatch(
        new RegExp(`^${RECOVERY_PAYMENT_REFERENCE_PREFIX}\\|`),
      );
    });
  });

  // ── Gap #8: valid date range metrics returns 200 ──────────────────────────

  it('DASH-E2E-17 GET /sales/metrics with valid ISO date range returns 200 with summary', async () => {
    const startDate = new Date('2024-01-01').toISOString();
    const endDate = new Date('2024-12-31').toISOString();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales/metrics?startDate=${startDate}&endDate=${endDate}`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalRevenue');
  });

  it('DASH-E2E-18 GET /sales/metrics without date params returns 200 (defaults to last 30 days)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/metrics')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data).toHaveProperty('metrics');
    expect(Array.isArray(data.metrics)).toBe(true);
  });

  // ── Gap #10: GET /sales/links accessible by OWNER ─────────────────────────

  it('DASH-E2E-19 GET /sales/links with OWNER cookie returns 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?page=1&pageSize=20')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('summary');
  });

  it('DASH-E2E-20 GET /sales/links with AGENT cookie returns 200 (AGENT can list)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?page=1&pageSize=20')
      .set('Cookie', [agentCookie])
      .expect(200);

    expect(res.body.data ?? res.body).toHaveProperty('items');
  });

  // ── Gap #2: summary stays correct with all status types present ──────────

  it('DASH-E2E-21 GET /sales/links ALL statuses: summary.paidRevenue = sum of PAID only', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=ALL&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const paidRevenue = Number(data.summary.paidRevenue);
    // Only PAID links count: "Link PAID" (500) + "Recovery Link" (120) = 620
    // REFUNDED (200), OVERDUE (300), EXPIRED (100) must NOT be included
    expect(paidRevenue).toBe(620);
  });

  it('DASH-E2E-22 GET /sales/links: items contain no cross-tenant data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const hasOtherTenantItem = data.items.some((i: any) =>
      i.externalId?.includes(otherTenantId),
    );
    expect(hasOtherTenantItem).toBe(false);
  });

  it('DASH-E2E-23 GET /sales/links with PAID filter: paidRevenue equals sum of returned PAID items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=PAID&pageSize=100')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    const itemsSum = data.items
      .filter((i: any) => i.status === 'PAID')
      .reduce((s: number, i: any) => s + Number(i.value), 0);
    expect(Number(data.summary.paidRevenue)).toBe(itemsSum);
  });

  it('DASH-E2E-24 GET /sales/links pagination: total reflects all items for tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/links?status=ALL&pageSize=1&page=1')
      .set('Cookie', [ownerCookie])
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.pagination.total).toBeGreaterThan(0);
    expect(data.items).toHaveLength(1);
  });

  it('DASH-E2E-25 GET /sales/metrics OWNER role returns 200, AGENT same endpoint returns 403', async () => {
    // OWNER should succeed
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics')
      .set('Cookie', [ownerCookie])
      .expect(200);

    // AGENT should be denied
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics')
      .set('Cookie', [agentCookie])
      .expect(403);
  });
});
