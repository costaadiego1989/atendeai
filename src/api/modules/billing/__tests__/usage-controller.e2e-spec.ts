import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('UsageController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let noSubscriptionTenantId: string;
  let authCookie: string;

  const ownerEmail = 'usage-owner@test.com';
  const otherOwnerEmail = 'usage-other-owner@test.com';
  const noSubscriptionOwnerEmail = 'usage-no-sub-owner@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = `ug${Date.now()}`;
  const otherTenantCnpj = `ug${Date.now() + 1}`;
  const noSubscriptionTenantCnpj = `ug${Date.now() + 2}`;

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
            in: [ownerEmail, otherOwnerEmail, noSubscriptionOwnerEmail],
          },
        },
      })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Usage Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Usage Store',
        cnpj: otherTenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    otherTenantId = otherTenant.id;

    const noSubscriptionTenant = await prisma.tenant.create({
      data: {
        companyName: 'No Subscription Store',
        cnpj: noSubscriptionTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    noSubscriptionTenantId = noSubscriptionTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Usage Owner',
          email: ownerEmail,
          phone: '11970000001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11970000002',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: noSubscriptionTenantId,
          name: 'No Subscription Owner',
          email: noSubscriptionOwnerEmail,
          phone: '11970000003',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    await prisma.subscription.createMany({
      data: [
        {
          tenantId,
          plan: 'ESSENCIAL',
          status: 'ACTIVE',
          messagesQuota: 2000,
          aiTokensQuota: 500000,
          contactsQuota: 500,
          billingCycleStart: new Date('2026-01-01T00:00:00.000Z'),
          billingCycleEnd: new Date('2026-02-01T00:00:00.000Z'),
        },
        {
          tenantId: otherTenantId,
          plan: 'PROFISSIONAL',
          status: 'ACTIVE',
          messagesQuota: 10000,
          aiTokensQuota: 2000000,
          contactsQuota: 5000,
          billingCycleStart: new Date('2026-01-01T00:00:00.000Z'),
          billingCycleEnd: new Date('2026-02-01T00:00:00.000Z'),
        },
      ],
    });

    await prisma.usageRecord.create({
      data: {
        tenantId,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T00:00:00.000Z'),
        messagesUsed: 25,
        aiTokensUsed: 1200,
        contactsUsed: 10,
      },
    });

    authCookie = await login(ownerEmail);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usageRecord
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId, noSubscriptionTenantId].filter(
                Boolean,
              ),
            },
          },
        })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId, noSubscriptionTenantId].filter(
                Boolean,
              ),
            },
          },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId, noSubscriptionTenantId].filter(
                Boolean,
              ),
            },
          },
        })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({
          where: {
            id: {
              in: [tenantId, otherTenantId, noSubscriptionTenantId].filter(
                Boolean,
              ),
            },
          },
        })
        .catch(() => {});
    }
  });

  it('should return usage for the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/usage`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId,
        plan: 'ESSENCIAL',
        usage: expect.objectContaining({
          messages: { used: 25, quota: 2000 },
          aiTokens: { used: 1200, quota: 500000 },
          contacts: { used: 10, quota: 500 },
        }),
      }),
    );
  });

  it('should return the billing plan catalog for the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/subscription/plans`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId,
        plans: expect.arrayContaining([
          expect.objectContaining({
            code: 'ESSENCIAL',
            monthlyPrice: 0,
            messagesQuota: 2000,
            aiTokensQuota: 500000,
            contactsQuota: 500,
          }),
          expect.objectContaining({
            code: 'PROFISSIONAL',
            monthlyPrice: 297,
          }),
        ]),
      }),
    );
  });

  it('should reject requests without authentication', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/usage`)
      .expect(401);
  });

  it('should reject cross-tenant usage access', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/usage`)
      .set('Cookie', [authCookie])
      .expect(401);
  });

  it('should return 404 when the tenant has no subscription', async () => {
    const noSubscriptionCookie = await login(noSubscriptionOwnerEmail);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${noSubscriptionTenantId}/usage`)
      .set('Cookie', [noSubscriptionCookie])
      .expect(404);
  });
});
