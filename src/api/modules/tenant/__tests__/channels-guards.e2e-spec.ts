import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Channels guards (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;
  let otherOwnerCookie: string;

  const ownerEmail = 'channels-guards-owner@test.com';
  const agentEmail = 'channels-guards-agent@test.com';
  const otherOwnerEmail = 'channels-guards-other@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = generateValidCnpj(Date.now() + 100);
  const otherTenantCnpj = generateValidCnpj(Date.now() + 101);

  function generateValidCnpj(seed: number): string {
    const base = String(seed).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const digit1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const digit2 = calcDigit(
      `${base}${digit1}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    const cnpj = `${base}${digit1}${digit2}`;
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

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

    await prisma.user
      .deleteMany({
        where: { email: { in: [ownerEmail, agentEmail, otherOwnerEmail] } },
      })
      .catch(() => {});

    await prisma.tenant
      .deleteMany({ where: { cnpj: { in: [tenantCnpj, otherTenantCnpj] } } })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Channels Guards Store',
        cnpj: tenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Channels Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Owner',
          email: ownerEmail,
          phone: '11970000020',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId,
          name: 'Agent',
          email: agentEmail,
          phone: '11970000021',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11970000022',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    ownerCookie = await login(ownerEmail);
    agentCookie = await login(agentEmail);
    otherOwnerCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await prisma.whatsAppConfig
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({
        where: { id: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await app.close();
  });

  // --- WhatsApp Twilio Sender ---

  describe('POST /tenants/:id/whatsapp/twilio/sender', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/sender`)
        .send({ phoneNumber: '5511999990000', wabaId: 'waba123' })
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/sender`)
        .set('Cookie', [agentCookie])
        .send({ phoneNumber: '5511999990000', wabaId: 'waba123' })
        .expect(403);
    });

    it('should return 401 for cross-tenant access', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${otherTenantId}/whatsapp/twilio/sender`)
        .set('Cookie', [ownerCookie])
        .send({ phoneNumber: '5511999990000', wabaId: 'waba123' })
        .expect(401);
    });

    it('should return 400 for empty phoneNumber', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/sender`)
        .set('Cookie', [ownerCookie])
        .send({ phoneNumber: '', wabaId: 'waba123' })
        .expect(400);
    });

    it('should return 400 for empty wabaId', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/sender`)
        .set('Cookie', [ownerCookie])
        .send({ phoneNumber: '5511999990000', wabaId: '' })
        .expect(400);
    });
  });

  // --- WhatsApp Twilio Verify ---

  describe('POST /tenants/:id/whatsapp/twilio/verify', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/verify`)
        .send({ verificationCode: '123456' })
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/verify`)
        .set('Cookie', [agentCookie])
        .send({ verificationCode: '123456' })
        .expect(403);
    });

    it('should return 400 for empty verificationCode', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/verify`)
        .set('Cookie', [ownerCookie])
        .send({ verificationCode: '' })
        .expect(400);
    });
  });

  // --- WhatsApp Twilio Refresh ---

  describe('POST /tenants/:id/whatsapp/twilio/refresh', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/refresh`)
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/whatsapp/twilio/refresh`)
        .set('Cookie', [agentCookie])
        .expect(403);
    });
  });

  // --- WhatsApp Connection (GET) ---

  describe('GET /tenants/:id/whatsapp-connection', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/whatsapp-connection`)
        .expect(401);
    });
  });

  // --- Instagram Config (PUT) ---

  describe('PUT /tenants/:id/instagram-config', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/instagram-config`)
        .send({ instagramAccountId: 'ig123' })
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/instagram-config`)
        .set('Cookie', [agentCookie])
        .send({ instagramAccountId: 'ig123' })
        .expect(403);
    });

    it('should return 400 for empty instagramAccountId', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/instagram-config`)
        .set('Cookie', [ownerCookie])
        .send({ instagramAccountId: '' })
        .expect(400);
    });
  });

  // --- Instagram Meta Connection (POST /channels/instagram/meta/start) ---

  describe('POST /channels/instagram/meta/start', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/channels/instagram/meta/start')
        .send({})
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/channels/instagram/meta/start')
        .set('Cookie', [agentCookie])
        .send({})
        .expect(403);
    });
  });
});
