import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as bcrypt from 'bcryptjs';

describe('WidgetConfigController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let otherAuthCookie: string;

  const ownerEmail = `widget-config-owner-${Date.now()}@test.com`;
  const otherOwnerEmail = `widget-config-other-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `wc${Date.now()}`.slice(-14);
  const otherTenantCnpj = `wo${Date.now() + 1}`.slice(-14);

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
      data: { companyName: 'Widget Config Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other Widget Store', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        { tenantId, name: 'Widget Owner', email: ownerEmail, phone: '11970000091', passwordHash, role: 'OWNER' },
        { tenantId: otherTenantId, name: 'Other Owner', email: otherOwnerEmail, phone: '11970000092', passwordHash, role: 'OWNER' },
      ],
    });

    authCookie = await login(ownerEmail);
    otherAuthCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await prisma.widgetConfig.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  describe('GET /api/v1/tenants/:tenantId/widget-config', () => {
    it('should return default config when none exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.publicToken).toBeDefined();
      expect(res.body.enabled).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/widget-config`)
        .expect(401);
    });

    it('should return 403 when accessing another tenant config', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/widget-config', () => {
    it('should update widget config', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [authCookie])
        .send({ name: 'Meu Widget', greeting: 'Olá! Como posso ajudar?', color: '#ff5733' })
        .expect(200);

      expect(res.body.name).toBe('Meu Widget');
      expect(res.body.greeting).toBe('Olá! Como posso ajudar?');
    });

    it('should save backgroundColor field', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [authCookie])
        .send({ backgroundColor: '#f0f0f0' })
        .expect(200);

      expect(res.body.backgroundColor).toBe('#f0f0f0');
    });

    it('should update position to bottom-left', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [authCookie])
        .send({ position: 'bottom-left' })
        .expect(200);

      expect(res.body.position).toBe('bottom-left');
    });

    it('should save collectEmail and collectCpf fields', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [authCookie])
        .send({ collectEmail: false, collectCpf: true })
        .expect(200);

      expect(res.body.collectEmail).toBe(false);
      expect(res.body.collectCpf).toBe(true);
    });

    it('should return 403 when updating another tenant config', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/widget-config`)
        .set('Cookie', [otherAuthCookie])
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  describe('POST /api/v1/tenants/:tenantId/widget-config/avatar', () => {
    it('should upload avatar and return avatarUrl', async () => {
      const fakeImage = Buffer.from('fake-image-content');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/widget-config/avatar`)
        .set('Cookie', [authCookie])
        .attach('file', fakeImage, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
        .expect(201);

      expect(res.body.avatarUrl).toBeDefined();
      expect(typeof res.body.avatarUrl).toBe('string');
    });

    it('should reject invalid mime type', async () => {
      const fakeFile = Buffer.from('fake-pdf-content');

      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/widget-config/avatar`)
        .set('Cookie', [authCookie])
        .attach('file', fakeFile, { filename: 'document.pdf', contentType: 'application/pdf' })
        .expect(422);
    });

    it('should return 403 for wrong tenant', async () => {
      const fakeImage = Buffer.from('fake-image');

      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/widget-config/avatar`)
        .set('Cookie', [otherAuthCookie])
        .attach('file', fakeImage, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(403);
    });
  });
});
