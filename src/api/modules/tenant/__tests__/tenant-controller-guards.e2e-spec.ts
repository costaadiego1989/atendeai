import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { Prisma } from '@prisma/client';

describe('TenantController guards (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;

  const ownerEmail = 'tenant-guards-owner@test.com';
  const agentEmail = 'tenant-guards-agent@test.com';
  const otherOwnerEmail = 'tenant-guards-other-owner@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = generateValidCnpj(Date.now());
  const otherTenantCnpj = generateValidCnpj(Date.now() + 1);

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
        where: {
          email: {
            in: [ownerEmail, agentEmail, otherOwnerEmail],
          },
        },
      })
      .catch(() => {});

    await prisma.tenant
      .deleteMany({
        where: {
          cnpj: {
            in: [tenantCnpj, otherTenantCnpj],
          },
        },
      })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Tenant Guards Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Tenant Store',
        cnpj: otherTenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Owner User',
          email: ownerEmail,
          phone: '11970000010',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId,
          name: 'Agent User',
          email: agentEmail,
          phone: '11970000011',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11970000012',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    ownerCookie = await login(ownerEmail);
    agentCookie = await login(agentEmail);
  });

  afterAll(async () => {
    await prisma.aIConfig
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma
      .$executeRaw(
        Prisma.sql`DELETE FROM tenant_schema.instagram_configs WHERE tenant_id = ${tenantId}::uuid OR tenant_id = ${otherTenantId}::uuid`,
      )
      .catch(() => {});
    await prisma.whatsAppConfig
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.subscription
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
  });

  it('should return 401 without auth cookie on protected routes', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/business-data`)
      .send({ description: 'Sem auth' })
      .expect(401);
  });

  it('should return 403 for users without OWNER or ADMIN role', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/business-data`)
      .set('Cookie', [agentCookie])
      .send({ description: 'Tentativa do agent' })
      .expect(403);
  });

  it('should return 401 for cross-tenant access', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${otherTenantId}/business-data`)
      .set('Cookie', [ownerCookie])
      .send({ description: 'Tentativa cross-tenant' })
      .expect(401);
  });

  it('should return 400 for invalid whatsapp config payload', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/whatsapp-config`)
      .set('Cookie', [ownerCookie])
      .send({
        whatsappNumber: '',
        bubbleWhatsId: '',
        bubbleWhatsToken: '',
        bubbleWhatsApiUrl: '',
      })
      .expect(400);
  });

  it('should return 400 for invalid ai config payload', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/ai-config`)
      .set('Cookie', [ownerCookie])
      .send({
        systemPrompt: '',
        tone: 'INVALID',
        confidenceThreshold: 2,
      })
      .expect(400);
  });

  it('should return 400 for invalid instagram config payload', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/instagram-config`)
      .set('Cookie', [ownerCookie])
      .send({
        instagramAccountId: '',
      })
      .expect(400);
  });
});
