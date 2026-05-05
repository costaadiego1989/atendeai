import { INestApplication, ValidationPipe } from '@nestjs/common';
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

describe('SalesController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;

  const password = 'Password123!';
  const ownerEmail = `sales-owner-${Date.now()}@test.com`;
  const agentEmail = `sales-agent-${Date.now()}@test.com`;
  const otherOwnerEmail = `sales-other-owner-${Date.now()}@test.com`;

  function makeValidCnpj(seed: number): string {
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

    return response.get('Set-Cookie')?.join('; ');
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS tenant_schema`);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Sales Controller Store',
        cnpj: makeValidCnpj(Date.now()),
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Sales Controller Store',
        cnpj: makeValidCnpj(Date.now() + 1),
        plan: 'PROFISSIONAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Sales Owner',
          email: ownerEmail,
          phone: '11990000001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId,
          name: 'Sales Agent',
          email: agentEmail,
          phone: '11990000002',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Sales Owner',
          email: otherOwnerEmail,
          phone: '11990000003',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    await prisma.salesMetric.createMany({
      data: [
        {
          tenantId,
          date: new Date('2026-03-10T00:00:00.000Z'),
          totalMessages: 2,
          purchaseIntents: 1,
          paymentLinksGenerated: 1,
          estimatedRevenue: 80,
        },
        {
          tenantId,
          date: new Date('2026-03-11T00:00:00.000Z'),
          totalMessages: 3,
          purchaseIntents: 2,
          paymentLinksGenerated: 0,
          estimatedRevenue: 0,
        },
        {
          tenantId: otherTenantId,
          date: new Date('2026-03-10T00:00:00.000Z'),
          totalMessages: 99,
          purchaseIntents: 99,
          paymentLinksGenerated: 99,
          estimatedRevenue: 999,
        },
      ],
    });

    ownerCookie = (await login(ownerEmail)) as string;
    agentCookie = (await login(agentEmail)) as string;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.salesMetric
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => { });
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM sales_schema.payment_links
      WHERE tenant_id IN (${Prisma.join([tenantId, otherTenantId].filter(Boolean))})
    `).catch(() => { });
    await prisma.subscription
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => { });
    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [ownerEmail, agentEmail, otherOwnerEmail],
          },
        },
      })
      .catch(() => { });
    await prisma.tenant
      .deleteMany({
        where: {
          id: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => { });

    if (app) {
      await app.close();
    }
  });

  it('should return metrics only for the tenant from the authenticated token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?startDate=2026-03-10&endDate=2026-03-11')
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(response.body.data.summary).toEqual({
      totalMessages: 5,
      totalIntents: 3,
      totalLinks: 1,
      totalRevenue: 80,
    });
    expect(response.body.data.metrics).toHaveLength(2);
    expect(
      response.body.data.metrics.some(
        (metric: any) => metric.totalMessages === 99,
      ),
    ).toBe(false);
  });

  it('should reject invalid metrics dates and forbid AGENT access to metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?startDate=invalid&endDate=2026-03-11')
      .set('Cookie', [ownerCookie])
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/sales/metrics?startDate=2026-03-10&endDate=2026-03-11')
      .set('Cookie', [agentCookie])
      .expect(403);
  });

  it('should allow an AGENT to generate a payment link', async () => {
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-sales-controller',
      url: 'https://pay.test/plink-sales-controller',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/sales/links')
      .set('Cookie', [agentCookie])
      .send({
        name: 'serviço Premium',
        value: 149.9,
        billingType: 'PIX',
      })
      .expect(201);

    expect(response.body.data).toEqual({
      id: expect.any(String),
      url: 'https://pay.test/plink-sales-controller',
      name: 'serviço Premium',
      value: 149.9,
      billingType: 'PIX',
      status: 'ACTIVE',
      source: 'MANUAL',
      createdAt: expect.any(String),
    });

    const todaysMetric = await prisma.salesMetric.findFirst({
      where: { tenantId },
      orderBy: { date: 'desc' },
    });
    expect(todaysMetric?.paymentLinksGenerated).toBeGreaterThanOrEqual(1);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/sales/links?page=1&pageSize=20')
      .set('Cookie', [agentCookie])
      .expect(200);

    expect(listResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'serviço Premium',
          status: 'ACTIVE',
          source: 'MANUAL',
        }),
      ]),
    );
  });

  it('should require authentication for sales endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/sales/metrics').expect(401);
  });
});
