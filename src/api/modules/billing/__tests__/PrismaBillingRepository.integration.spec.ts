import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../domain/repositories/IBillingRepository';
import { Subscription } from '../domain/entities/Subscription';
import { UsageRecord } from '../domain/entities/UsageRecord';
import { TenantId } from '@shared/domain/TenantId';

describe('PrismaBillingRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IBillingRepository;
  let tenantId: string;
  const testCnpj = `br${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IBillingRepository>(BILLING_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Billing Repository Store',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.usageRecord.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should save and load subscriptions by tenant', async () => {
    const subscription = Subscription.create(
      TenantId.create(tenantId),
      'PROFISSIONAL',
    );
    subscription.updateAsaasInfo('cus-1', 'sub-1');
    subscription.markAsOverdue();

    await repository.saveSubscription(subscription);

    const result = await repository.findSubscription(tenantId);

    expect(result).not.toBeNull();
    expect(result?.tenantId.toString()).toBe(tenantId);
    expect(result?.plan).toBe('PROFISSIONAL');
    expect(result?.status).toBe('OVERDUE');
    expect(result?.asaasCustomerId).toBe('cus-1');
    expect(result?.asaasSubscriptionId).toBe('sub-1');
  });

  it('should save usage records and fetch both current and latest cycle usage', async () => {
    const current = UsageRecord.create(
      TenantId.create(tenantId),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );
    current.recordMessage();
    current.recordTokens(200);

    const latest = UsageRecord.create(
      TenantId.create(tenantId),
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-03-01T00:00:00.000Z'),
    );
    latest.recordContact();

    await repository.saveUsage(current);
    await repository.saveUsage(latest);

    const currentResult = await repository.getUsage(
      tenantId,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const latestResult = await repository.findLatestUsage(tenantId);

    expect(currentResult?.messagesUsed).toBe(1);
    expect(currentResult?.aiTokensUsed).toBe(200);
    expect(latestResult?.periodStart.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    expect(latestResult?.contactsUsed).toBe(1);
  });
});
