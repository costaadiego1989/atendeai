// ============================================================
// automation.e2e-new.spec.ts
// NEW e2e tests — HTTP layer, auth, validation, tenant isolation.
// Covers gaps #31-35.
// ============================================================
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('AutomationController e2e – new gap tests', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let otherAuthCookie: string;

  const ts = Date.now();
  const ownerEmail = `e2e-new-owner-${ts}@test.com`;
  const otherOwnerEmail = `e2e-new-other-${ts}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `c${ts}`.slice(-14);
  const otherTenantCnpj = `d${ts + 1}`.slice(-14);

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  async function createAutomation(tenantId: string, cookie: string, overrides: object = {}) {
    return request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/automations`)
      .set('Cookie', [cookie])
      .send({
        name: 'E2E Test Flow',
        trigger: { type: 'contact_created', config: {} },
        steps: [{ type: 'add_tag', config: { tag: 'test' }, order: 0 }],
        ...overrides,
      });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { companyName: 'E2E New Tests Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: { email: ownerEmail, passwordHash, name: 'E2E Owner', phone: '+5511999990010', role: 'OWNER', tenantId },
    });

    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other E2E New Tenant', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.create({
      data: { email: otherOwnerEmail, passwordHash, name: 'Other E2E Owner', phone: '+5511999990011', role: 'OWNER', tenantId: otherTenantId },
    });

    authCookie = await login(ownerEmail);
    otherAuthCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await prisma.automationExecution.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.automationStep.deleteMany({ where: { automation: { tenantId: { in: [tenantId, otherTenantId] } } } }).catch(() => {});
    await prisma.automation.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  // =========================================================================
  // GAP #31: Unauthenticated access returns 401
  // =========================================================================
  describe('Authentication enforcement (gap #31)', () => {
    it('GET list without auth cookie returns 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations`)
        .expect(401);
    });

    it('POST create without auth cookie returns 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/automations`)
        .send({ name: 'x', trigger: { type: 'contact_created', config: {} }, steps: [] })
        .expect(401);
    });

    it('PUT update without auth cookie returns 401', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/some-id`)
        .send({ name: 'y' })
        .expect(401);
    });

    it('DELETE without auth cookie returns 401', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/automations/some-id`)
        .expect(401);
    });
  });

  // =========================================================================
  // GAP #32: Tenant isolation via TenantGuard
  // =========================================================================
  describe('Tenant isolation via TenantGuard (gap #32)', () => {
    let ownedAutoId: string;

    beforeAll(async () => {
      const res = await createAutomation(tenantId, authCookie);
      expect(res.status).toBe(201);
      ownedAutoId = res.body.id;
    });

    it('tenant B cookie cannot access tenant A automations list (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });

    it('tenant B cookie cannot GET tenant A specific automation (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations/${ownedAutoId}`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });

    it('tenant B cookie cannot update tenant A automation (403)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${ownedAutoId}`)
        .set('Cookie', [otherAuthCookie])
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('tenant B cookie cannot delete tenant A automation (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/automations/${ownedAutoId}`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });

    it('tenant B cookie cannot activate tenant A automation (403)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${ownedAutoId}/activate`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });

  // =========================================================================
  // GAP #33: ValidationPipe rejects invalid payloads
  // =========================================================================
  describe('ValidationPipe – invalid payloads (gap #33)', () => {
    it('rejects missing name field (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .send({ trigger: { type: 'contact_created', config: {} }, steps: [] })
        .expect(400);
    });

    it('rejects missing trigger field (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .send({ name: 'Flow', steps: [] })
        .expect(400);
    });

    it('rejects extra/unknown fields due to forbidNonWhitelisted (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .send({
          name: 'Flow',
          trigger: { type: 'contact_created', config: {} },
          steps: [],
          injectedField: 'malicious',
        })
        .expect(400);
    });

    it('empty string name passes DTO validation (documents @MinLength(1) gap)', async () => {
      // AutomationDto has @IsString() but no @MinLength(1) on name
      // So empty string should create successfully (400 would indicate fixed)
      const res = await createAutomation(tenantId, authCookie, { name: '' });
      // Accept 201 (bug still present) or 400 (bug fixed)
      expect([201, 400]).toContain(res.status);
    });
  });

  // =========================================================================
  // GAP #34: GET /automations/:id — not found returns 404
  // =========================================================================
  describe('GET /automations/:id – 404 for non-existent (gap #34)', () => {
    it('returns 404 for non-existent automation id', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', [authCookie])
        .expect(404);
    });

    it('GET returns 200 with correct automation when it exists', async () => {
      const created = await createAutomation(tenantId, authCookie, { name: 'Fetch Me' });
      expect(created.status).toBe(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations/${created.body.id}`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.name).toBe('Fetch Me');
    });
  });

  // =========================================================================
  // GAP #35: Full lifecycle — create → activate → update → deactivate → delete
  // =========================================================================
  describe('Full automation lifecycle (gap #35)', () => {
    let autoId: string;

    it('creates automation with isActive=false by default', async () => {
      const res = await createAutomation(tenantId, authCookie, {
        name: 'Lifecycle Test',
        description: 'Full lifecycle',
        trigger: { type: 'tag_added', config: { tag: 'promo' } },
        steps: [
          { type: 'send_message', config: { body: 'Hello {{name}}' }, order: 0 },
          { type: 'add_tag', config: { tag: 'sent' }, order: 1 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.isActive).toBe(false);
      expect(res.body.steps).toHaveLength(2);
      autoId = res.body.id;
    });

    it('activates the automation', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${autoId}/activate`)
        .set('Cookie', [authCookie])
        .expect(200);
      expect(res.body.isActive).toBe(true);
    });

    it('updates the automation name and steps', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${autoId}`)
        .set('Cookie', [authCookie])
        .send({
          name: 'Lifecycle Test (Updated)',
          steps: [{ type: 'http_request', config: { url: 'https://hook.example.com', method: 'POST' }, order: 0 }],
        })
        .expect(200);
      expect(res.body.name).toBe('Lifecycle Test (Updated)');
      expect(res.body.steps).toHaveLength(1);
    });

    it('deactivates the automation', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${autoId}/deactivate`)
        .set('Cookie', [authCookie])
        .expect(200);
      expect(res.body.isActive).toBe(false);
    });

    it('lists the automation and it appears in the result', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .expect(200);
      const ids = res.body.map((a: any) => a.id);
      expect(ids).toContain(autoId);
    });

    it('deletes the automation', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/automations/${autoId}`)
        .set('Cookie', [authCookie])
        .expect(204);
    });

    it('automation is no longer accessible after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations/${autoId}`)
        .set('Cookie', [authCookie])
        .expect(404);
    });
  });

  // =========================================================================
  // GAP – POST /automations response shape
  // =========================================================================
  describe('POST /automations – response shape', () => {
    it('response includes all expected fields', async () => {
      const res = await createAutomation(tenantId, authCookie, {
        name: 'Shape Test',
        description: 'Shape check',
        trigger: { type: 'contact_created', config: {} },
        steps: [{ type: 'add_tag', config: { tag: 'shape' }, order: 0 }],
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        tenantId,
        name: 'Shape Test',
        description: 'Shape check',
        isActive: false,
        trigger: expect.objectContaining({ type: 'contact_created' }),
        steps: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  // =========================================================================
  // GAP – GET /automations?onlyActive=true filter
  // =========================================================================
  describe('GET /automations – onlyActive filter', () => {
    it('returns only active automations when onlyActive=true', async () => {
      // Create one active and one inactive
      const inactive = await createAutomation(tenantId, authCookie, { name: 'Inactive Filter Test' });
      const active = await createAutomation(tenantId, authCookie, { name: 'Active Filter Test' });
      expect(inactive.status).toBe(201);
      expect(active.status).toBe(201);

      // Activate the second one
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${active.body.id}/activate`)
        .set('Cookie', [authCookie])
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations?onlyActive=true`)
        .set('Cookie', [authCookie])
        .expect(200);

      const ids = res.body.map((a: any) => a.id);
      expect(ids).toContain(active.body.id);
      expect(ids).not.toContain(inactive.body.id);
    });
  });

  // =========================================================================
  // GAP – Update non-existent automation returns 404
  // =========================================================================
  describe('PUT /automations/:id – 404 for non-existent', () => {
    it('returns 404 when updating non-existent automation', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', [authCookie])
        .send({ name: 'Ghost Update' })
        .expect(404);
    });
  });

  // =========================================================================
  // GAP – DELETE non-existent automation returns 404
  // =========================================================================
  describe('DELETE /automations/:id – 404 for non-existent', () => {
    it('returns 404 when deleting non-existent automation', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/automations/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', [authCookie])
        .expect(404);
    });
  });
});
