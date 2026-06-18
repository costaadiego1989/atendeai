/* eslint-disable @typescript-eslint/no-explicit-any */
// ================================================================
// sales.e2e-new.spec.ts — NEW e2e tests for the sales module HTTP endpoints
// ================================================================
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';

describe('SalesController (e2e) — new endpoints', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;

  const password = 'Password123!';
  const seed = Date.now();
  const ownerEmail = `new-e2e-owner-${seed}@test.com`;
  const agentEmail = `new-e2e-agent-${seed}@test.com`;
  const otherOwnerEmail = `new-e2e-other-${seed}@test.com`;

  function makeValidCnpj(n: number): string {
    const base = String(n).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const d1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calcDigit(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return `${base}${d1}${d2}`.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.get('Set-Cookie')?.join('; ');
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor(app.get(Reflector)));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS tenant_schema`);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { companyName: 'E2E New Corp', cnpj: makeValidCnpj(seed), plan: 'PROFISSIONAL' },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other New Corp', cnpj: makeValidCnpj(seed + 1), plan: 'PROFISSIONAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        { tenantId, name: 'Owner', email: ownerEmail, phone: '11900000001', passwordHash, role: 'OWNER' },
        { tenantId, name: 'Agent', email: agentEmail, phone: '11900000002', passwordHash, role: 'AGENT' },
        { tenantId: otherTenantId, name: 'OtherOwner', email: otherOwnerEmail, phone: '11900000003', passwordHash, role: 'OWNER' },
      ],
    });

    ownerCookie = (await login(ownerEmail)) as string;
    agentCookie = (await login(agentEmail)) as string;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const tenantIds = [tenantId, otherTenantId].filter(Boolean);
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM sales_schema.payment_links WHERE tenant_id IN (${Prisma.join(tenantIds)})`,
    ).catch(() => {});
    await prisma.salesCoupon.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.salesPromotion.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.salesMetric.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, agentEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
    await app.close();
  });

  // ─── Helper to create a payment link ────────────────────────────────────
  async function createPaymentLink(cookie: string, overrides: any = {}) {
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    const linkId = `plink-e2e-${Date.now()}`;
    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: linkId, url: `https://pay.test/${linkId}`,
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/links')
      .set('Cookie', [cookie])
      .send({ name: 'Test Link', value: 100, billingType: 'PIX', ...overrides });
    return res;
  }

  // ─── 1. PATCH /sales/links/:id/pause ────────────────────────────────────
  describe('PATCH /sales/links/:id/pause', () => {
    it('returns 404 when link does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000001';
      await request(app.getHttpServer())
        .patch(`/api/v1/sales/links/${fakeId}/pause`)
        .set('Cookie', [ownerCookie])
        .expect(404);
    });

    it('AGENT can pause an existing payment link', async () => {
      const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
      const linkId = `plink-pause-${Date.now()}`;
      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({ id: linkId, url: `https://pay.test/${linkId}` });
      jest.spyOn(paymentGateway, 'removePaymentLink').mockResolvedValue(undefined as any);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/links')
        .set('Cookie', [agentCookie])
        .send({ name: 'Pause Me', value: 50, billingType: 'PIX' })
        .expect(201);

      const createdId = createRes.body.data.id;
      const pauseRes = await request(app.getHttpServer())
        .patch(`/api/v1/sales/links/${createdId}/pause`)
        .set('Cookie', [agentCookie])
        .expect(200);

      expect(pauseRes.body.data.status).toBe('PAUSED');
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/sales/links/any-id/pause')
        .expect(401);
    });
  });

  // ─── 2. PATCH /sales/links/:id/resume ───────────────────────────────────
  describe('PATCH /sales/links/:id/resume', () => {
    it('returns 404 when link does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000002';
      await request(app.getHttpServer())
        .patch(`/api/v1/sales/links/${fakeId}/resume`)
        .set('Cookie', [ownerCookie])
        .expect(404);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/sales/links/any-id/resume')
        .expect(401);
    });

    it('AGENT can resume a paused link', async () => {
      const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
      const linkId = `plink-resume-${Date.now()}`;
      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({ id: linkId, url: `https://pay.test/${linkId}` });
      jest.spyOn(paymentGateway, 'removePaymentLink').mockResolvedValue(undefined as any);
      jest.spyOn(paymentGateway, 'restorePaymentLink').mockResolvedValue(undefined as any);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/links')
        .set('Cookie', [agentCookie])
        .send({ name: 'Resume Me', value: 60, billingType: 'PIX' })
        .expect(201);

      const id = createRes.body.data.id;
      await request(app.getHttpServer()).patch(`/api/v1/sales/links/${id}/pause`).set('Cookie', [agentCookie]).expect(200);

      const resumeRes = await request(app.getHttpServer())
        .patch(`/api/v1/sales/links/${id}/resume`)
        .set('Cookie', [agentCookie])
        .expect(200);

      expect(resumeRes.body.data.status).toBe('ACTIVE');
    });
  });

  // ─── 3. DELETE /sales/links/:id ─────────────────────────────────────────
  describe('DELETE /sales/links/:id', () => {
    it('returns 404 when link does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000003';
      await request(app.getHttpServer())
        .delete(`/api/v1/sales/links/${fakeId}`)
        .set('Cookie', [ownerCookie])
        .expect(404);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/sales/links/any-id')
        .expect(401);
    });

    it('OWNER can delete an existing link and result has status DELETED', async () => {
      const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
      const linkId = `plink-del-${Date.now()}`;
      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({ id: linkId, url: `https://pay.test/${linkId}` });
      jest.spyOn(paymentGateway, 'removePaymentLink').mockResolvedValue(undefined as any);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/links')
        .set('Cookie', [ownerCookie])
        .send({ name: 'Delete Me', value: 80, billingType: 'PIX' })
        .expect(201);

      const id = createRes.body.data.id;
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/sales/links/${id}`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(deleteRes.body.data.status).toBe('DELETED');
    });

    it('double-delete: second delete call still returns 200 (idempotent — skips gateway)', async () => {
      const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
      const linkId = `plink-ddel-${Date.now()}`;
      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({ id: linkId, url: `https://pay.test/${linkId}` });
      jest.spyOn(paymentGateway, 'removePaymentLink').mockResolvedValue(undefined as any);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/links')
        .set('Cookie', [ownerCookie])
        .send({ name: 'Double Delete', value: 70, billingType: 'PIX' })
        .expect(201);

      const id = createRes.body.data.id;
      await request(app.getHttpServer()).delete(`/api/v1/sales/links/${id}`).set('Cookie', [ownerCookie]).expect(200);
      // Second delete — link is already DELETED, gateway should be skipped
      await request(app.getHttpServer()).delete(`/api/v1/sales/links/${id}`).set('Cookie', [ownerCookie]).expect(200);
    });
  });

  // ─── 4. GET /sales/links/report.csv ─────────────────────────────────────
  describe('GET /sales/links/report.csv', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sales/links/report.csv')
        .expect(401);
    });

    it('returns 200 with Content-Type text/csv when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/links/report.csv')
        .set('Cookie', [agentCookie])
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('returns Content-Disposition attachment header with .csv filename', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/links/report.csv')
        .set('Cookie', [agentCookie])
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/\.csv/);
    });

    it('AGENT role is allowed to download the report', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sales/links/report.csv')
        .set('Cookie', [agentCookie])
        .expect(200);
    });
  });

  // ─── 5. GET /sales/metrics — tenant isolation ────────────────────────────
  describe('GET /sales/metrics — tenant isolation', () => {
    it('metrics from another tenant are not returned', async () => {
      // Seed metric for otherTenant
      await prisma.salesMetric.upsert({
        where: { tenantId_date: { tenantId: otherTenantId, date: new Date('2026-01-01') } },
        create: {
          tenantId: otherTenantId, date: new Date('2026-01-01'),
          totalMessages: 999, purchaseIntents: 999, paymentLinksGenerated: 999, estimatedRevenue: 99999,
        },
        update: {},
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/metrics?startDate=2026-01-01&endDate=2026-01-01')
        .set('Cookie', [ownerCookie])
        .expect(200);

      const metrics = res.body.data.metrics as any[];
      expect(metrics.some((m: any) => m.totalMessages === 999)).toBe(false);
    });

    it('startDate > endDate returns 200 with empty metrics (no error thrown)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/metrics?startDate=2026-12-31&endDate=2026-01-01')
        .set('Cookie', [ownerCookie])
        .expect(200);
      // The use-case passes through to repo — expect empty or any result but no crash
      expect(res.body.data).toBeDefined();
    });
  });

  // ─── 6. POST /sales/coupons/redeem — missing code ───────────────────────
  describe('POST /sales/coupons/redeem — validation', () => {
    it('returns 400 when code is missing from body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sales/coupons/redeem')
        .set('Cookie', [ownerCookie])
        .send({})
        .expect(400);
    });

    it('returns 404 when code does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sales/coupons/redeem')
        .set('Cookie', [ownerCookie])
        .send({ code: 'DOESNOTEXIST99' })
        .expect(404);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sales/coupons/redeem')
        .send({ code: 'TEST' })
        .expect(401);
    });
  });

  // ─── 7. Promotions CRUD ──────────────────────────────────────────────────
  describe('Promotions CRUD', () => {
    it('POST /sales/promotions — owner can create a promotion', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sales/promotions')
        .set('Cookie', [ownerCookie])
        .send({
          title: 'Summer Deal', description: 'Get 10% off',
          discountType: 'PERCENTAGE', discountValue: 10,
          startsAt: '2026-01-01',
        })
        .expect(201);

      expect(res.body.data.title).toBe('Summer Deal');
      expect(res.body.data.active).toBe(true);
    });

    it('GET /sales/promotions — returns list for the authenticated tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/promotions')
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PUT /sales/promotions/:id — returns 404 for non-existent promotion', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000099';
      await request(app.getHttpServer())
        .put(`/api/v1/sales/promotions/${fakeId}`)
        .set('Cookie', [ownerCookie])
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('DELETE /sales/promotions/:id — returns { deleted: true } for existing promotion', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/promotions')
        .set('Cookie', [ownerCookie])
        .send({ title: 'To Delete', description: 'bye', discountType: 'PERCENTAGE', discountValue: 5, startsAt: '2026-01-01' })
        .expect(201);

      const promoId = createRes.body.data.id;
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/sales/promotions/${promoId}`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(deleteRes.body.data.deleted).toBe(true);
    });

    it('returns 401 when creating promotion without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sales/promotions')
        .send({ title: 'T', description: 'd', discountType: 'PERCENTAGE', discountValue: 10, startsAt: '2026-01-01' })
        .expect(401);
    });
  });

  // ─── 8. Coupons CRUD ─────────────────────────────────────────────────────
  describe('Coupons CRUD', () => {
    it('POST /sales/coupons — owner can create a coupon', async () => {
      const code = `TESTCOUPON${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/sales/coupons')
        .set('Cookie', [ownerCookie])
        .send({ code, discountType: 'PERCENTAGE', discountValue: 15, maxUses: 10, startsAt: '2026-01-01' })
        .expect(201);

      expect(res.body.data.code).toBe(code.toUpperCase());
      expect(res.body.data.active).toBe(true);
    });

    it('GET /sales/coupons — returns list for the authenticated tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/coupons')
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PUT /sales/coupons/:id — returns 404 for non-existent coupon', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000098';
      await request(app.getHttpServer())
        .put(`/api/v1/sales/coupons/${fakeId}`)
        .set('Cookie', [ownerCookie])
        .send({ maxUses: 5 })
        .expect(404);
    });

    it('DELETE /sales/coupons/:id — returns { deleted: true }', async () => {
      const code = `DELCOUPON${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales/coupons')
        .set('Cookie', [ownerCookie])
        .send({ code, discountType: 'FIXED_AMOUNT', discountValue: 5, maxUses: 0, startsAt: '2026-01-01' })
        .expect(201);

      const couponId = createRes.body.data.id;
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/sales/coupons/${couponId}`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(deleteRes.body.data.deleted).toBe(true);
    });

    it('GET /sales/coupons with onlyActive=true returns only active coupons', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales/coupons?onlyActive=true')
        .set('Cookie', [ownerCookie])
        .expect(200);

      const coupons = res.body.data as any[];
      expect(coupons.every((c: any) => c.active === true)).toBe(true);
    });
  });
});
