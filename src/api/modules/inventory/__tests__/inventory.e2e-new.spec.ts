// ─── inventory.e2e-new.spec.ts ─────────────────────────────────────────────────
// NEW e2e tests for inventory module HTTP endpoints.
// Covers: unauthenticated access (401), VIEWER role rejection (403),
//   DTO validation (400), duplicate connection 409,
//   job listing, download endpoint paths, and report errors.
//
// NOTE: These tests require a live NestJS application (AppModule) with a real
// database. They follow the exact patterns from inventory.e2e-spec.ts.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('InventoryController (e2e) – new gap coverage', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  let ownerTenantId: string;
  let ownerAuthCookie: string;
  let viewerAuthCookie: string;

  const password = 'SenhaForte123!';
  const ownerEmail = `inv-e2e-new-owner-${Date.now()}@test.com`;
  const viewerEmail = `inv-e2e-new-viewer-${Date.now()}@test.com`;
  const tenantCnpj = `e2enew${Date.now()}`;

  async function loginAs(email: string): Promise<string> {
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { companyName: 'E2E New Test Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    ownerTenantId = tenant.id;

    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } }).catch(() => {});

    await prisma.user.create({
      data: { tenantId: ownerTenantId, name: 'Owner', email: ownerEmail, phone: '11970000099', passwordHash, role: 'OWNER' },
    });

    await prisma.user.create({
      data: { tenantId: ownerTenantId, name: 'Viewer', email: viewerEmail, phone: '11970000098', passwordHash, role: 'VIEWER' },
    });

    ownerAuthCookie = await loginAs(ownerEmail);
    viewerAuthCookie = await loginAs(viewerEmail);
  });

  afterAll(async () => {
    if (ownerTenantId) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_async_jobs WHERE tenant_id = ${ownerTenantId}::uuid`).catch(() => {});
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${ownerTenantId}::uuid`).catch(() => {});
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${ownerTenantId}::uuid`).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId: ownerTenantId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: ownerTenantId } }).catch(() => {});
    }
    if (app) await app.close();
  });

  // ─── 1. Unauthenticated access (401) ─────────────────────────────────────

  it('INV-E2E-NEW-001: GET /inventory/items without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/items`)
      .expect(401);
  });

  it('INV-E2E-NEW-002: POST /inventory/connections without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: 'test', config: {} })
      .expect(401);
  });

  it('INV-E2E-NEW-003: POST /inventory/items/sync without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .send({ sku: 'test', name: 'test', availableQuantity: 1, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(401);
  });

  it('INV-E2E-NEW-004: GET /inventory/connections without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .expect(401);
  });

  it('INV-E2E-NEW-005: GET /inventory/jobs without auth cookie returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/jobs`)
      .expect(401);
  });

  // ─── 2. VIEWER role rejection (403) ──────────────────────────────────────

  it('INV-E2E-NEW-006: POST /inventory/connections with VIEWER role returns 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [viewerAuthCookie])
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: 'Viewer Attempt', config: {} })
      .expect(403);
  });

  it('INV-E2E-NEW-007: POST /inventory/items/sync with VIEWER role returns 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [viewerAuthCookie])
      .send({ sku: 'V1', name: 'Viewer', availableQuantity: 1, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(403);
  });

  it('INV-E2E-NEW-008: GET /inventory/items with VIEWER role returns 403', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/items`)
      .set('Cookie', [viewerAuthCookie])
      .expect(403);
  });

  it('INV-E2E-NEW-009: GET /inventory/connections with VIEWER role returns 403', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [viewerAuthCookie])
      .expect(403);
  });

  // ─── 3. DTO validation – invalid inputs return 400 ───────────────────────

  it('INV-E2E-NEW-010: POST /inventory/items/sync with invalid sourceType returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: 'SKU-1', name: 'Test', availableQuantity: 1, availabilityStatus: 'AVAILABLE', source: 'INVALID_SOURCE_TYPE' })
      .expect(400);
  });

  it('INV-E2E-NEW-011: POST /inventory/items/sync with negative availableQuantity returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: 'SKU-NEG', name: 'Negative', availableQuantity: -1, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(400);
  });

  it('INV-E2E-NEW-012: POST /inventory/items/sync with invalid availabilityStatus returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: 'SKU-BAD', name: 'Bad', availableQuantity: 1, availabilityStatus: 'INVALID_STATUS', source: 'MANUAL_SNAPSHOT' })
      .expect(400);
  });

  it('INV-E2E-NEW-013: POST /inventory/connections with invalid sourceType returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sourceType: 'NOT_A_REAL_SOURCE', providerName: 'Bad', config: {} })
      .expect(400);
  });

  it('INV-E2E-NEW-014: POST /inventory/items/sync missing required sku field returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ name: 'No SKU', availableQuantity: 1, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(400);
  });

  // ─── 4. Duplicate connection returns 409 ─────────────────────────────────

  it('INV-E2E-NEW-015: POST /inventory/connections duplicate provider+name returns 409', async () => {
    const body = { sourceType: 'MANUAL_SNAPSHOT', providerName: `DupConn-${Date.now()}`, config: {} };

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [ownerAuthCookie])
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [ownerAuthCookie])
      .send(body)
      .expect(409);
  });

  // ─── 5. Job listing and download ─────────────────────────────────────────

  it('INV-E2E-NEW-016: GET /inventory/jobs returns 200 with empty array when no jobs', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/jobs`)
      .set('Cookie', [ownerAuthCookie])
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('INV-E2E-NEW-017: GET /inventory/jobs/:jobId/download for non-existent job returns 404 or error', async () => {
    const fakeJobId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/jobs/${fakeJobId}/download`)
      .set('Cookie', [ownerAuthCookie]);

    expect([404, 500]).toContain(res.status);
  });

  it('INV-E2E-NEW-018: GET /inventory/jobs after creating a report job returns job in list', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: 'JOB-LIST-TEST', name: 'Test Item', availableQuantity: 1, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(201);

    const jobRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/report-jobs`)
      .set('Cookie', [ownerAuthCookie])
      .send({ availableOnly: false })
      .expect(202);

    const jobId = jobRes.body.id;

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/jobs`)
      .set('Cookie', [ownerAuthCookie])
      .expect(200);

    expect(listRes.body.some((j: any) => j.id === jobId)).toBe(true);
  });

  // ─── 6. HTTP status codes ─────────────────────────────────────────────────

  it('INV-E2E-NEW-019: POST /inventory/connections returns 201 on successful creation', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: `StatusCheck-${Date.now()}`, config: {} })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
  });

  it('INV-E2E-NEW-020: POST /inventory/items/sync returns 201 on successful sync', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: `STATUS-SKU-${Date.now()}`, name: 'Status Test', availableQuantity: 5, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(201);

    expect(res.body.id).toBeDefined();
  });

  it('INV-E2E-NEW-021: POST /inventory/report-jobs returns 202 Accepted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/report-jobs`)
      .set('Cookie', [ownerAuthCookie])
      .send({ availableOnly: false, statuses: [] })
      .expect(202);

    expect(res.body.status).toMatch(/QUEUED|PROCESSING/);
    expect(res.body.type).toBe('EXPORT_INVENTORY_REPORT_CSV');
  });

  it('INV-E2E-NEW-022: GET /inventory/items returns 200 with array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/items`)
      .set('Cookie', [ownerAuthCookie])
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('INV-E2E-NEW-023: GET /inventory/connections returns 200 with array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/connections`)
      .set('Cookie', [ownerAuthCookie])
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('INV-E2E-NEW-024: GET /inventory/jobs/:jobId returns 200 with job object for existing job', async () => {
    const jobRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/report-jobs`)
      .set('Cookie', [ownerAuthCookie])
      .send({ availableOnly: false })
      .expect(202);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${ownerTenantId}/inventory/jobs/${jobRes.body.id}`)
      .set('Cookie', [ownerAuthCookie])
      .expect(200);

    expect(getRes.body.id).toBe(jobRes.body.id);
    expect(getRes.body.tenantId).toBe(ownerTenantId);
  });

  it('INV-E2E-NEW-025: POST /inventory/items/sync with zero availableQuantity (boundary) returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${ownerTenantId}/inventory/items/sync`)
      .set('Cookie', [ownerAuthCookie])
      .send({ sku: `ZERO-QTY-${Date.now()}`, name: 'Zero Qty', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(201);

    expect(res.body.availableQuantity).toBe(0);
    expect(res.body.availabilityStatus).toBe('UNAVAILABLE');
  });
});
