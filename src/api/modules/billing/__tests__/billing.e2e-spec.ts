import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { randomUUID } from 'crypto';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { ICheckQuotaUseCase } from '../application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  IRecordUsageUseCase,
  UsageType,
} from '../application/use-cases/interfaces/IRecordUsageUseCase';
import { EVENT_BUS, IEventBus } from '@shared/infrastructure/event-bus';
import { PaymentConfirmedIntegrationEvent } from '../../payment/application/integration-events/PaymentIntegrationEvents';

describe('BillingModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createTenant: ICreateTenantUseCase;
  let checkQuota: ICheckQuotaUseCase;
  let recordUsage: IRecordUsageUseCase;
  let eventBus: IEventBus;
  let tenantId: string;
  let paidTenantId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    checkQuota = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);
    recordUsage = app.get<IRecordUsageUseCase>(IRecordUsageUseCase);
    eventBus = app.get(EVENT_BUS);

    const tenant = await createTenant.execute({
      companyName: 'Billing Test Store',
      cnpj: '11.222.333/0001-81',
      ownerName: 'Billing Test Owner',
      ownerEmail: 'billing-test@test.com',
      ownerPhone: '11977776666',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL', // Quota: 2000 mensagens
    });
    tenantId = tenant.id;

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.usageRecord
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    }
    if (paidTenantId) {
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: paidTenantId } })
        .catch(() => { });
      await prisma.subscription
        .deleteMany({ where: { tenantId: paidTenantId } })
        .catch(() => { });
      await prisma.user
        .deleteMany({ where: { tenantId: paidTenantId } })
        .catch(() => { });
      await prisma.tenant
        .delete({ where: { id: paidTenantId } })
        .catch(() => { });
    }
    if (app) {
      await app.close();
    }
  });

  describe('Cenário 1: Controle de Quotas', () => {
    it('deve permitir processamento quando dentro da quota', async () => {
      const result = await checkQuota.execute({
        tenantId,
        type: UsageType.MESSAGE,
      });

      expect(result.canProceed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.quota).toBe(2000);
    });

    it('deve bloquear processamento quando a quota é atingida', async () => {
      await prisma.usageRecord.updateMany({
        where: { tenantId },
        data: { messagesUsed: 2000 },
      });

      const result = await checkQuota.execute({
        tenantId,
        type: UsageType.MESSAGE,
      });

      expect(result.canProceed).toBe(false);
      expect(result.used).toBe(2000);
    });
  });

  describe('Cenário 2: Renovação de Ciclo', () => {
    it('deve resetar o uso ao receber confirmação de pagamento de mensalidade', async () => {
      await prisma.usageRecord.updateMany({
        where: { tenantId },
        data: { messagesUsed: 1500, aiTokensUsed: 50000 },
      });

      await eventBus.publish(
        new PaymentConfirmedIntegrationEvent({
          tenantId,
          paymentId: randomUUID(),
          amount: 99.9,
          confirmedAt: new Date(),
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await checkQuota.execute({
        tenantId,
        type: UsageType.MESSAGE,
      });

      expect(result.canProceed).toBe(true);
      expect(result.used).toBe(0);
    });
  });

  describe('Cenário 3: Provisionamento via Fila (BullMQ)', () => {
    it('deve enfileirar e processar o provisionamento real no Asaas para planos pagos de forma assíncrona', async () => {
      const tenant = await createTenant.execute({
        companyName: 'BullMQ Test Store',
        cnpj: '06.990.590/0001-23',
        ownerName: 'BullMQ Owner',
        ownerEmail: 'bullmq@test.com',
        ownerPhone: '11988887777',
        ownerPassword: 'SenhaForte123!',
        plan: 'PROFISSIONAL',
      });
      paidTenantId = tenant.id;

      // Aguarda a fila assíncrona do BullMQ consumir o trabalho e executar o Worker.
      // Como conectamos com o Asaas Sandbox real, usamos polling no banco para evitar timeout rasteiro ou longo d+.
      let subscription: any = null;
      for (let i = 0; i < 25; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        subscription = await prisma.subscription.findUnique({
          where: { tenantId: paidTenantId },
        });
        if (
          subscription &&
          subscription.asaasCustomerId &&
          subscription.asaasSubscriptionId
        ) {
          break;
        }
      }

      expect(subscription).toBeDefined();
      expect(subscription!.asaasCustomerId).toBeDefined();
      expect(subscription!.asaasCustomerId?.length).toBeGreaterThan(5);
      expect(subscription!.asaasSubscriptionId).toBeDefined();
      expect(subscription!.asaasSubscriptionId?.length).toBeGreaterThan(5);
    }, 30000);
  });
});
