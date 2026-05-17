import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';

describe('Dashboard Commercial Metrics Flow (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;

  const ownerEmail = `dashboard-metrics-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `dcm${Date.now()}`;

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return response.get('Set-Cookie')![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(
      new SuccessResponseInterceptor(app.get(Reflector)),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Dashboard Metrics Store',
        cnpj: tenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Dashboard Metrics Other Store',
        cnpj: `dcmo${Date.now().toString().slice(-8)}`,
        plan: 'PROFISSIONAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Dashboard Owner',
        email: ownerEmail,
        phone: '11960000111',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login(ownerEmail);

    await prisma.paymentLink.createMany({
      data: [
        {
          tenantId,
          providerLinkId: `provider-sale-${Date.now()}`,
          externalId: `sales-charge|${tenantId}|1`,
          name: 'Pedido pago',
          label: 'Nova venda',
          value: 500,
          url: 'https://pay.test/new-sale',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `provider-recovery-${Date.now()}`,
          externalId: `recovery|${tenantId}|1`,
          name: 'Cobranca recuperada',
          label: 'Recovery',
          value: 120,
          url: 'https://pay.test/recovery',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId,
          providerLinkId: `provider-pending-${Date.now()}`,
          externalId: `sales-charge|${tenantId}|pending`,
          name: 'Pedido pendente',
          label: 'Venda pendente',
          value: 999,
          url: 'https://pay.test/pending-sale',
          billingType: 'PIX',
          status: 'PENDING',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
        {
          tenantId: otherTenantId,
          providerLinkId: `provider-other-sale-${Date.now()}`,
          externalId: `sales-charge|${otherTenantId}|1`,
          name: 'Pedido pago outro tenant',
          label: 'Venda alheia',
          value: 900,
          url: 'https://pay.test/other-sale',
          billingType: 'PIX',
          status: 'PAID',
          source: 'MANUAL',
          resourceType: 'PAYMENT',
        },
      ],
    });

    await prisma.recoveryCase.create({
      data: {
        tenantId,
        debtorName: 'Cliente em atraso',
        phone: '5511999888777',
        source: 'MANUAL',
        status: 'PAID',
        amountDue: 120,
        paidAt: new Date(),
      },
    });

    await prisma.recoveryCase.create({
      data: {
        tenantId: otherTenantId,
        debtorName: 'Cliente outro tenant',
        phone: '5511999777666',
        source: 'MANUAL',
        status: 'PAID',
        amountDue: 300,
        paidAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.paymentLink
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.recoveryCase
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.subscription
      .deleteMany({ where: { tenantId } })
      .catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant
      .deleteMany({ where: { id: otherTenantId } })
      .catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  it('returns the source data that allows the dashboard to separate new sale revenue from recovered revenue', async () => {
    const linksResponse = await request(app.getHttpServer())
      .get('/api/v1/sales/links?page=1&pageSize=20')
      .set('Cookie', [authCookie])
      .expect(200);

    const recoveryResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .expect(200);

    const recoveryItems = recoveryResponse.body.data ?? recoveryResponse.body;
    const linksData = linksResponse.body.data ?? linksResponse.body;
    const paidRevenue = Number(linksData.summary.paidRevenue);
    const recoveredRevenue = recoveryItems
      .filter((item: any) => item.status === 'PAID')
      .reduce(
        (total: number, item: any) => total + Number(item.amountDue ?? 0),
        0,
      );
    const newSaleRevenue = paidRevenue - recoveredRevenue;

    expect(paidRevenue).toBe(620);
    expect(recoveredRevenue).toBe(120);
    expect(newSaleRevenue).toBe(500);
    expect(linksData.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: expect.stringContaining('sales-charge|'),
        }),
        expect.objectContaining({
          externalId: expect.stringContaining('recovery|'),
        }),
      ]),
    );
    expect(linksData.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: expect.stringContaining(`sales-charge|${otherTenantId}|`),
        }),
      ]),
    );
    expect(recoveryItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: otherTenantId,
        }),
      ]),
    );
  });
});
