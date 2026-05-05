import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { randomUUID } from 'crypto';

describe('Messaging Webhook Idempotency (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let tenantId: string;

  const whatsappNumber = '5511911112222';
  const webhookSecret = 'idempotency-secret';
  const testCnpj = '60.701.190/0001-04';
  const cleanCnpj = testCnpj.replace(/\D/g, '');
  const ownerEmail = 'messaging-idempotency@test.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    await prisma.$executeRaw(Prisma.sql(`
      CREATE TABLE IF NOT EXISTS messaging_schema.messaging_webhook_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_key VARCHAR(255) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        external_message_id VARCHAR(255) NOT NULL,
        external_account_id VARCHAR(255) NULL,
        from_phone VARCHAR(30) NULL,
        to_phone VARCHAR(30) NULL,
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
      CREATE UNIQUE INDEX IF NOT EXISTS messaging_webhook_receipts_receipt_key_key
      ON messaging_schema.messaging_webhook_receipts (receipt_key)
    `);

    const tenantsToDelete = await (prisma.tenant as any).findMany({
      where: {
        OR: [
          { cnpj: testCnpj },
          { cnpj: cleanCnpj },
          { users: { some: { email: ownerEmail } } },
          { whatsappConfig: { whatsappNumber } },
        ],
      },
    });

    for (const tenant of tenantsToDelete) {
      const id = tenant.id;
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId: id } } })
        .catch(() => { });
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId: id } })
        .catch(() => { });
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId: id } })
        .catch(() => { });
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId: id } })
        .catch(() => { });
      await (prisma.aIConfig as any)
        .deleteMany({ where: { tenantId: id } })
        .catch(() => { });
      await (prisma.whatsAppConfig as any)
        .deleteMany({ where: { tenantId: id } })
        .catch(() => { });
      await (prisma.user as any).deleteMany({ where: { tenantId: id } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id } }).catch(() => { });
    }

    await (prisma.user as any)
      .deleteMany({ where: { email: ownerEmail } })
      .catch(() => { });

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenantResult = await createTenant.execute({
      companyName: 'Messaging Idempotency Store',
      cnpj: testCnpj,
      ownerName: 'Messaging Idempotency Owner',
      ownerEmail,
      ownerPhone: '11955554444',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });
    tenantId = tenantResult.id;

    const tenant = await tenantRepository.findById(tenantId);
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token-idempotency',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      whatsappNumber,
      webhookSecret,
    });
    whatsAppConfig.activate();
    tenant!.configureWhatsApp(whatsAppConfig);
    await tenantRepository.save(tenant!);
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => { });
      await prisma.$executeRaw(Prisma.sql(
        'DELETE FROM messaging_schema.messaging_webhook_receipts WHERE to_phone = $1',
        whatsappNumber,
      ).catch(() => { });
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.contact as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.user as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should ignore duplicated webhook deliveries and persist only one inbound message', async () => {
    const messageId = `dup-${randomUUID()}`;
    const body = {
      event: 'message.received',
      data: {
        messageId,
        from: '5511999997777',
        to: whatsappNumber,
        type: 'text',
        content: { text: 'Mensagem que não pode duplicar' },
        timestamp: new Date().toISOString(),
      },
    };

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature', signature)
      .send(body)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature', signature)
      .send(body)
      .expect(200);

    const contact = await (prisma.contact as any).findFirst({
      where: { tenantId, phone: '5511999997777' },
    });
    expect(contact).toBeDefined();

    const conversation = await (prisma.conversation as any).findFirst({
      where: { tenantId, contactId: contact?.id },
    });
    expect(conversation).toBeDefined();

    const messages = await (prisma.message as any).findMany({
      where: {
        conversationId: conversation?.id,
        direction: 'INBOUND',
        externalId: messageId,
      },
    });
    const receipts = await prisma.$queryRaw<Array<{ receipt_key: string; status: string }>>(
      `
        SELECT receipt_key, status
        FROM messaging_schema.messaging_webhook_receipts
        WHERE external_message_id = $1
      `,
      messageId,
    );

    expect(messages).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toEqual({
      receipt_key: `BUBBLEWHATS:WHATSAPP:${messageId}`,
      status: 'PROCESSED',
    });
  });

  it('should ignore unsupported provider events without creating contacts or conversations', async () => {
    const body = {
      event: 'status.updated',
      data: {
        messageId: `ignored-${randomUUID()}`,
        from: '551188887777',
        to: whatsappNumber,
        type: 'text',
        content: { text: 'evento ignorado' },
        timestamp: new Date().toISOString(),
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send(body)
      .expect(200);

    const contact = await (prisma.contact as any).findFirst({
      where: { tenantId, phone: '551188887777' },
    });

    expect(contact).toBeNull();
  });
});
