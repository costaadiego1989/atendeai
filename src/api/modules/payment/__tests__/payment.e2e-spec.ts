import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';

describe('PaymentModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const webhookSecret = 'test-asaas-secret';
  // Unique valid CNPJ for this test file: 00.000.001/0001-36
  const testCnpj = '00.000.001/0001-36';
  const realCnpj = '60.701.190/0001-04';
  const cleanCnpj = testCnpj.replace(/\D/g, '');
  const cleanRealCnpj = realCnpj.replace(/\D/g, '');

  beforeAll(async () => {
    process.env.ASAAS_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const tenantsToDelete = await prisma.tenant.findMany({
      where: {
        OR: [
          { cnpj: testCnpj },
          { cnpj: cleanCnpj },
          { cnpj: realCnpj },
          { cnpj: cleanRealCnpj },
          { users: { some: { email: 'payment-test@test.com' } } },
          { users: { some: { email: 'real-payment@test.com' } } },
        ],
      },
    });

    for (const t of tenantsToDelete) {
      const tId = t.id;
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma as any).user
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await prisma.tenant.delete({ where: { id: tId } }).catch(() => {});
    }

    await (prisma as any).user
      .deleteMany({ where: { email: 'payment-test@test.com' } })
      .catch(() => {});

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenantResult = await createTenant.execute({
      companyName: 'Payment Test Store',
      cnpj: testCnpj,
      ownerName: 'Payment Test Owner',
      ownerEmail: 'payment-test@test.com',
      ownerPhone: '11944443333',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });
    tenantId = tenantResult.id;

    let retryCount = 0;
    let subscriptionCreated = false;
    while (retryCount < 10 && !subscriptionCreated) {
      const sub = await prisma.subscription.findUnique({ where: { tenantId } });
      if (sub) {
        subscriptionCreated = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryCount++;
      }
    }

    if (!subscriptionCreated) {
      throw new Error(
        `Subscription was not created for tenant ${tenantId} after 5 seconds`,
      );
    }
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.usageRecord
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).user
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    await app.close();
  });

  describe('Scenario 1: Security Validation', () => {
    it('should return 403 if signature is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .send({ event: 'PAYMENT_CONFIRMED' })
        .expect(403);
    });

    it('should return 403 if signature is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .set('asaas-api-signature', 'invalid-sig')
        .send({ event: 'PAYMENT_CONFIRMED' })
        .expect(403);
    });

    it('should return 200 if signature is valid', async () => {
      const body = {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          status: 'CONFIRMED',
          externalReference: tenantId,
        },
      };
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .set('asaas-api-signature', hash)
        .send(body)
        .expect(200);
    });
  });

  describe('Scenario 2: Status Mapping', () => {
    it('should activate subscription on PAYMENT_CONFIRMED', async () => {
      await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'PENDING' },
      });

      const body = {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_confirm_22',
          customer: 'cus_22',
          status: 'CONFIRMED',
          externalReference: tenantId,
        },
      };
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .set('asaas-api-signature', hash)
        .send(body)
        .expect(200);

      let sub: any = null;
      for (let i = 0; i < 20; i++) {
        sub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (sub?.status === 'ACTIVE') break;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(sub?.status).toBe('ACTIVE');
    }, 15000);

    it('should mark as OVERDUE on PAYMENT_OVERDUE', async () => {
      const body = {
        event: 'PAYMENT_OVERDUE',
        payment: {
          id: 'pay_overdue_33',
          customer: 'cus_33',
          status: 'OVERDUE',
          externalReference: tenantId,
        },
      };
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .set('asaas-api-signature', hash)
        .send(body)
        .expect(200);

      let sub: any = null;
      for (let i = 0; i < 20; i++) {
        sub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (sub?.status === 'OVERDUE') break;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(sub?.status).toBe('OVERDUE');
    }, 15000);

    it('should mark as OVERDUE on PAYMENT_REFUNDED', async () => {
      const body = {
        event: 'PAYMENT_REFUNDED',
        payment: {
          id: 'pay_refund_44',
          customer: 'cus_44',
          status: 'REFUNDED',
          externalReference: tenantId,
        },
      };
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/asaas')
        .set('asaas-api-signature', hash)
        .send(body)
        .expect(200);

      let sub: any = null;
      for (let i = 0; i < 20; i++) {
        sub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (sub?.status === 'OVERDUE') break;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(sub?.status).toBe('OVERDUE');
    }, 15000);
  });

  describe('Scenario 3: Real Asaas Integration (Deep Testing)', () => {
    let realTenantId: string;
    const realCnpjValue = '60.701.190/0001-04'; // Itaú CNPJ

    it('should provision a real Asaas Customer and Subscription for PROFISSIONAL plan', async () => {
      const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
      const result = await createTenant.execute({
        companyName: 'Real Payment Test',
        cnpj: realCnpjValue,
        ownerName: 'Real Owner',
        ownerEmail: 'real-payment@test.com',
        ownerPhone: '11988887777',
        ownerPassword: 'Password123!',
        plan: 'PROFISSIONAL',
      });
      realTenantId = result.id;

      // Wait for subscription to be provisioned with Asaas IDs
      let retryCount = 0;
      let provisioned = false;
      let sub: any = null;

      while (retryCount < 25 && !provisioned) {
        sub = await prisma.subscription.findUnique({
          where: { tenantId: realTenantId },
        });
        if (sub && sub.asaasSubscriptionId) {
          provisioned = true;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          retryCount++;
        }
      }

      expect(provisioned).toBe(true);
      expect(sub.asaasCustomerId).toBeDefined();
      expect(sub.asaasSubscriptionId).toBeDefined();
      console.log(
        `Real Asaas Subscription: ${sub.asaasSubscriptionId} for customer ${sub.asaasCustomerId}`,
      );
    }, 30000);

    afterAll(async () => {
      if (realTenantId) {
        await prisma.subscription
          .deleteMany({ where: { tenantId: realTenantId } })
          .catch(() => {});
        await prisma.usageRecord
          .deleteMany({ where: { tenantId: realTenantId } })
          .catch(() => {});
        await (prisma as any).user
          .deleteMany({ where: { tenantId: realTenantId } })
          .catch(() => {});
        await prisma.tenant
          .delete({ where: { id: realTenantId } })
          .catch(() => {});
      }
    });
  });

  describe('Scenario 4: Payment Link Generation', () => {
    it('should generate a payment link via PaymentService', async () => {
      const {
        PaymentService,
      } = require('../application/services/PaymentService');
      const paymentService = app.get(PaymentService);

      const result = await paymentService.createPaymentLink({
        name: 'Teste Link Deep',
        value: 49.9,
        billingType: 'UNDEFINED',
        chargeType: 'DETACHED',
        dueDateLimitDays: 7,
      });

      expect(result.id).toBeDefined();
      expect(result.url).toContain('asaas.com');
      console.log(`Generated Payment Link: ${result.url}`);
    });
  });
});
