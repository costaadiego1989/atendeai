import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as request from 'supertest';
import * as crypto from 'crypto';

describe('Payment webhook controller (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const webhookSecret = 'payment-webhook-secret';
  const testCnpj = `pw${Date.now()}`;

  function signPayload(body: Record<string, unknown>) {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  async function waitFor(
    assertion: () => Promise<void>,
    attempts = 20,
    intervalMs = 300,
  ) {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw lastError;
  }

  beforeAll(async () => {
    process.env.ASAAS_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.$executeRaw(Prisma.sql(
      'CREATE SCHEMA IF NOT EXISTS payment_schema',
    );
    await prisma.$executeRaw(Prisma.sql(`
      CREATE TABLE IF NOT EXISTS payment_schema.payment_webhook_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_key VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        tenant_id UUID NULL,
        raw_reference VARCHAR(255) NULL,
        signature TEXT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
        ignore_reason VARCHAR(100) NULL,
        processed_at TIMESTAMPTZ NULL,
        ignored_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_receipts_receipt_key_key
      ON payment_schema.payment_webhook_receipts (receipt_key)
    `);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Payment Webhook Tenant',
        cnpj: testCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql(
        'DELETE FROM payment_schema.payment_webhook_receipts WHERE tenant_id = $1::uuid',
        tenantId,
      ).catch(() => { });
      await prisma.usageRecord.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }
  });

  beforeEach(async () => {
    await prisma.usageRecord.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.$executeRaw(Prisma.sql(
      'DELETE FROM payment_schema.payment_webhook_receipts WHERE tenant_id = $1::uuid',
      tenantId,
    );

    await prisma.subscription.create({
      data: {
        tenantId,
        plan: 'PROFISSIONAL',
        status: 'PENDING',
        messagesQuota: 10000,
        aiTokensQuota: 2000000,
        contactsQuota: 5000,
        billingCycleStart: new Date('2026-01-01T00:00:00.000Z'),
        billingCycleEnd: new Date('2026-02-01T00:00:00.000Z'),
      },
    });
  });

  it('should ignore unknown webhook events without changing the subscription', async () => {
    const body = {
      event: 'UNSUPPORTED_EVENT',
      dateCreated: '2026-03-01T08:00:00.000Z',
      payment: {
        id: 'pay-unknown',
        externalReference: tenantId,
        value: 50,
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(body))
      .send(body)
      .expect(200, { received: true });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    const receipts = await prisma.$queryRaw<Array<{ status: string }>>(
      `
        SELECT status
        FROM payment_schema.payment_webhook_receipts
        WHERE tenant_id = $1::uuid
        ORDER BY created_at DESC
      `,
      tenantId,
    );

    expect(subscription?.status).toBe('PENDING');
    expect(await prisma.usageRecord.count({ where: { tenantId } })).toBe(0);
    expect(receipts[0]?.status).toBe('IGNORED');
  });

  it('should process duplicate confirmed webhooks idempotently', async () => {
    const body = {
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2026-03-02T08:00:00.000Z',
      payment: {
        id: 'pay-duplicate-1',
        externalReference: tenantId,
        value: 199,
        confirmedDate: '2026-03-02T08:00:00.000Z',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(body))
      .send(body)
      .expect(200, { received: true });

    await waitFor(async () => {
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
      });
      expect(subscription?.status).toBe('ACTIVE');
      expect(await prisma.usageRecord.count({ where: { tenantId } })).toBe(1);
    });

    const firstSubscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    const firstCycleStart = firstSubscription?.billingCycleStart.toISOString();

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(body))
      .send(body)
      .expect(200, { received: true });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalSubscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    const receipts = await prisma.$queryRaw<Array<{ receipt_key: string; status: string }>>(
      `
        SELECT receipt_key, status
        FROM payment_schema.payment_webhook_receipts
        WHERE tenant_id = $1::uuid
        ORDER BY created_at DESC
      `,
      tenantId,
    );

    expect(finalSubscription?.status).toBe('ACTIVE');
    expect(finalSubscription?.billingCycleStart.toISOString()).toBe(
      firstCycleStart,
    );
    expect(await prisma.usageRecord.count({ where: { tenantId } })).toBe(1);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toEqual({
      receipt_key: 'ASAAS:PAYMENT_CONFIRMED:pay-duplicate-1',
      status: 'PROCESSED',
    });
  });
});
