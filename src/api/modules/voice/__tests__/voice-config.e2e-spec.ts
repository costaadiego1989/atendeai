import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as bcrypt from 'bcryptjs';

describe('VoiceConfigController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let otherAuthCookie: string;

  const ownerEmail = `voice-config-owner-${Date.now()}@test.com`;
  const otherOwnerEmail = `voice-config-other-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `vc${Date.now()}`.slice(-14);
  const otherTenantCnpj = `vo${Date.now() + 1}`.slice(-14);

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = res.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
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
      data: { companyName: 'Voice Config Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other Voice Store', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        { tenantId, name: 'Voice Owner', email: ownerEmail, phone: '11970000071', passwordHash, role: 'OWNER' },
        { tenantId: otherTenantId, name: 'Other Owner', email: otherOwnerEmail, phone: '11970000072', passwordHash, role: 'OWNER' },
      ],
    });

    authCookie = await login(ownerEmail);
    otherAuthCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await prisma.voiceAgentConfig.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  describe('GET /api/v1/tenants/:tenantId/voice/config', () => {
    it('should return default config when none exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.enabled).toBe(false);
      expect(res.body.persona).toBeDefined();
      expect(res.body.allowedHours).toBeDefined();
      expect(res.body.allowedHours.start).toBe('09:00');
      expect(res.body.allowedHours.end).toBe('18:00');
      expect(Array.isArray(res.body.scripts)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/config`)
        .expect(401);
    });

    it('should return 403 when accessing another tenant config', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/voice/config', () => {
    it('should enable voice agent', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .send({ enabled: true })
        .expect(200);

      expect(res.body.enabled).toBe(true);
    });

    it('should update persona voiceId and language', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .send({ persona: { voiceId: 'pt-BR-FranciscaNeural', language: 'pt-BR' } })
        .expect(200);

      expect(res.body.persona.voiceId).toBe('pt-BR-FranciscaNeural');
      expect(res.body.persona.language).toBe('pt-BR');
    });

    it('should update call window hours', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .send({ allowedHours: { start: '08:00', end: '20:00' } })
        .expect(200);

      expect(res.body.allowedHours.start).toBe('08:00');
      expect(res.body.allowedHours.end).toBe('20:00');
    });

    it('should persist config across GET after PUT', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .send({ enabled: true, persona: { voiceId: 'test-voice-id' } })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.enabled).toBe(true);
      expect(res.body.persona.voiceId).toBe('test-voice-id');
    });

    it('should return 403 when updating another tenant config', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/voice/config`)
        .set('Cookie', [otherAuthCookie])
        .send({ enabled: true })
        .expect(403);
    });
  });

  describe('GET /api/v1/tenants/:tenantId/voice/calls', () => {
    it('should return empty paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/calls`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.page).toBe('number');
      expect(typeof res.body.totalPages).toBe('number');
    });

    it('should respect pagination params', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/calls?page=1&limit=5`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.page).toBe(1);
    });

    it('should return 403 for wrong tenant', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/calls`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });

  describe('GET /api/v1/tenants/:tenantId/voice/metrics', () => {
    it('should return metrics shape', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/metrics`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(typeof res.body.totalCalls).toBe('number');
      expect(typeof res.body.answeredRate).toBe('number');
      expect(typeof res.body.agreementRate).toBe('number');
      expect(typeof res.body.totalRecovered).toBe('number');
    });

    it('should return 403 for wrong tenant', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/voice/metrics`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });
});
