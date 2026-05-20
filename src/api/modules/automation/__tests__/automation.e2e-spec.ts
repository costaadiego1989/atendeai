import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('AutomationController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let otherAuthCookie: string;
  let automationId: string;

  const ownerEmail = `automation-e2e-owner-${Date.now()}@test.com`;
  const otherOwnerEmail = `automation-e2e-other-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `a${Date.now()}`.slice(-14);
  const otherTenantCnpj = `b${Date.now() + 1}`.slice(-14);

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant A
    const tenant = await prisma.tenant.create({
      data: { companyName: 'Automation E2E Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash,
        name: 'Automation Owner',
        phone: '+5511999990001',
        role: 'OWNER',
        tenantId,
      },
    });

    // Create tenant B (for isolation tests)
    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other Automation Store', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.create({
      data: {
        email: otherOwnerEmail,
        passwordHash,
        name: 'Other Owner',
        phone: '+5511999990002',
        role: 'OWNER',
        tenantId: otherTenantId,
      },
    });

    authCookie = await login(ownerEmail);
    otherAuthCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.automationExecution.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.automationStep.deleteMany({ where: { automation: { tenantId: { in: [tenantId, otherTenantId] } } } }).catch(() => {});
    await prisma.automation.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  describe('POST /api/v1/tenants/:tenantId/automations', () => {
    it('should create an automation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .send({
          name: 'Welcome Flow',
          description: 'Sends welcome on contact creation',
          trigger: { type: 'contact_created', config: {} },
          steps: [
            { type: 'send_message', config: { body: 'Welcome!' }, order: 0 },
            { type: 'add_tag', config: { tag: 'welcomed' }, order: 1 },
          ],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Welcome Flow');
      expect(response.body.isActive).toBe(false);
      automationId = response.body.id;
    });
  });

  describe('GET /api/v1/tenants/:tenantId/automations', () => {
    it('should list automations for the tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body.some((a: any) => a.id === automationId)).toBe(true);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/automations/:id', () => {
    it('should update an automation', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${automationId}`)
        .set('Cookie', [authCookie])
        .send({ name: 'Updated Welcome Flow', description: 'Updated description' })
        .expect(200);

      expect(response.body.name).toBe('Updated Welcome Flow');
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/automations/:id/activate', () => {
    it('should activate an automation', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${automationId}/activate`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(response.body.isActive).toBe(true);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/automations/:id/deactivate', () => {
    it('should deactivate an automation', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/automations/${automationId}/deactivate`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not list automations from another tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${otherTenantId}/automations`)
        .set('Cookie', [otherAuthCookie])
        .expect(200);

      const ids = response.body.map((a: any) => a.id);
      expect(ids).not.toContain(automationId);
    });
  });

  describe('DELETE /api/v1/tenants/:tenantId/automations/:id', () => {
    it('should delete an automation', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/automations/${automationId}`)
        .set('Cookie', [authCookie])
        .expect(204);

      // Verify it's gone
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/automations`)
        .set('Cookie', [authCookie])
        .expect(200);

      const ids = response.body.map((a: any) => a.id);
      expect(ids).not.toContain(automationId);
    });
  });
});
