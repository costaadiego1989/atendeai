import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/database/PrismaService';
import { IEventBus, EVENT_BUS } from '../../../shared/infrastructure/event-bus';
import {
  AIResponseGeneratedIntegrationEvent,
  LeadScoredIntegrationEvent,
} from '../../ai/application/integration-events/publishers/AIIntegrationEvents';
import { ICreatePaymentLinkUseCase } from '../application/use-cases/interfaces/ICreatePaymentLinkUseCase';
import { randomUUID } from 'crypto';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';

describe('SalesModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantId: string;
  const testCnpj = '60.701.190/0001-04';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    eventBus = app.get(EVENT_BUS);

    await prisma.$executeRaw(
      Prisma.sql`CREATE SCHEMA IF NOT EXISTS tenant_schema`,
    );

    const testEmail = `sales-owner-${Date.now()}@test.com`;
    const existingTenant = await prisma.tenant.findUnique({
      where: { cnpj: testCnpj },
    });
    if (existingTenant) {
      await prisma.salesMetric
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.tenant
        .delete({ where: { id: existingTenant.id } })
        .catch(() => {});
    }
    await prisma.user
      .deleteMany({ where: { email: { contains: 'sales-owner' } } })
      .catch(() => {});

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Sales Test Corp',
        cnpj: testCnpj,
        plan: 'PROFISSIONAL',
        users: {
          create: {
            name: 'Sales Owner',
            email: testEmail,
            phone: '11999998888',
            passwordHash: 'hashed',
          },
        },
      },
    });
    tenantId = tenant.id;

    await prisma.subscription.create({
      data: {
        tenantId,
        plan: 'PROFISSIONAL',
        status: 'ACTIVE',
        messagesQuota: 1000,
        aiTokensQuota: 100000,
        contactsQuota: 100,
        billingCycleStart: new Date(),
        billingCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.salesMetric
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM sales_schema.payment_links
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    await app.close();
  });

  const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  describe('Scenario 2: Analytics Tracking', () => {
    it('should track AI messages correctly via events', async () => {
      const event = new AIResponseGeneratedIntegrationEvent({
        tenantId,
        conversationId: randomUUID(),
        contactId: randomUUID(),
        aiSessionId: randomUUID(),
        response: { type: 'text', text: 'Hello' },
        intent: 'GREETING',
        sentiment: 'POSITIVE',
        confidence: 0.99,
        tokensUsed: 10,
      });

      await eventBus.publish(event);

      // Poll for the metric to be updated (async event handling)
      let metric: any = null;
      for (let i = 0; i < 20; i++) {
        metric = await prisma.salesMetric.findUnique({
          where: { tenantId_date: { tenantId, date: getToday() } },
        });
        if (metric?.totalMessages >= 1) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(metric?.totalMessages).toBeGreaterThanOrEqual(1);
    }, 15000);

    it('should track purchase intents correctly', async () => {
      const event = new LeadScoredIntegrationEvent({
        tenantId,
        conversationId: randomUUID(),
        contactId: randomUUID(),
        score: 90,
        isHot: true,
        intent: 'PURCHASE',
        sentiment: 'POSITIVE',
      });

      await eventBus.publish(event);

      let metric: any = null;
      for (let i = 0; i < 20; i++) {
        metric = await prisma.salesMetric.findUnique({
          where: { tenantId_date: { tenantId, date: getToday() } },
        });
        if (metric?.purchaseIntents >= 1) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(metric?.purchaseIntents).toBeGreaterThanOrEqual(1);
    }, 15000);
  });

  describe('Scenario 1: Payment Link Generation', () => {
    it('should generate a payment link and track revenue', async () => {
      const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
        id: 'plink-sales-e2e',
        url: 'https://pay.test/sales-e2e',
      });

      const useCase = app.get<ICreatePaymentLinkUseCase>(
        ICreatePaymentLinkUseCase,
      );

      const result = await useCase.execute({
        tenantId,
        name: 'Product X',
        value: 100.5,
        billingType: 'PIX',
      });

      expect(result.url).toBeDefined();

      const metric = await prisma.salesMetric.findUnique({
        where: { tenantId_date: { tenantId, date: getToday() } },
      });

      expect(metric?.paymentLinksGenerated).toBeGreaterThanOrEqual(1);
      expect(Number(metric?.estimatedRevenue)).toBeGreaterThanOrEqual(100.5);
    });
  });

  describe('Concurrency: Atomic Increments', () => {
    it('should handle multiple simultaneous increments', async () => {
      const useCase = app.get<ICreatePaymentLinkUseCase>(
        ICreatePaymentLinkUseCase,
      );

      // Trigger 5 link generations in parallel
      await Promise.all([
        useCase.execute({
          tenantId,
          name: 'P1',
          value: 10,
          billingType: 'PIX',
        }),
        useCase.execute({
          tenantId,
          name: 'P2',
          value: 10,
          billingType: 'PIX',
        }),
        useCase.execute({
          tenantId,
          name: 'P3',
          value: 10,
          billingType: 'PIX',
        }),
        useCase.execute({
          tenantId,
          name: 'P4',
          value: 10,
          billingType: 'PIX',
        }),
        useCase.execute({
          tenantId,
          name: 'P5',
          value: 10,
          billingType: 'PIX',
        }),
      ]);

      const metric = await prisma.salesMetric.findUnique({
        where: { tenantId_date: { tenantId, date: getToday() } },
      });

      // We had 1 from previous test + 5 here = 6
      expect(metric?.paymentLinksGenerated).toBe(6);
      expect(Number(metric?.estimatedRevenue)).toBe(150.5); // 100.50 + 50
    });
  });
});
