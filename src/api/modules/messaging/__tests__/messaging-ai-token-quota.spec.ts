import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { randomUUID } from 'crypto';
import request from 'supertest';
import * as crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { AIResponseGeneratedIntegrationEvent } from '@modules/ai/application/integration-events/publishers/AIIntegrationEvents';
import { ExpressAdapter } from '@nestjs/platform-express';

describe('AI Token Quota Enforcement (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authTokenArr: string[];

  const whatsappNumber = '5511977770001';
  const webhookSecret = 'token-quota-secret';
  const testCnpj = '66.231.944/0001-88';
  const cleanCnpj = testCnpj.replace(/\D/g, '');
  const ownerEmail = 'token-quota-test@test.com';
  const ownerPassword = 'SenhaForte123!';

  // Intentionally low AI token quota for testing enforcement
  const AI_TOKEN_QUOTA = 500;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    eventBus = app.get<IEventBus>(EVENT_BUS);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    // Cleanup any previous test data
    const tenantsToDelete = await (prisma.tenant as any).findMany({
      where: {
        OR: [
          { cnpj: testCnpj },
          { cnpj: cleanCnpj },
          { users: { some: { email: ownerEmail } } },
        ],
      },
    });

    for (const t of tenantsToDelete) {
      const tId = t.id;
      await (prisma.message as any).deleteMany({ where: { conversation: { tenantId: tId } } }).catch(() => { });
      await (prisma.conversation as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.contact as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.aISession as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.usageRecord as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.subscription as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.aIConfig as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.whatsAppConfig as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma as any).user.deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id: tId } }).catch(() => { });
    }

    await (prisma as any).user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenantResult = await createTenant.execute({
      companyName: 'Token Quota Test Store',
      cnpj: testCnpj,
      ownerName: 'Token Quota Owner',
      ownerEmail,
      ownerPhone: '11955550001',
      ownerPassword,
      plan: 'ESSENCIAL',
    });
    tenantId = tenantResult.id;

    const tenant = await tenantRepository.findById(tenantId);
    const wsConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '9090',
        token: 'token-quota-e2e',
        apiUrl: 'https://9090.bubblewhats.com',
      },
      whatsappNumber,
      webhookSecret,
    });
    wsConfig.activate();
    tenant!.configureWhatsApp(wsConfig);
    await tenantRepository.save(tenant!);

    await new Promise((r) => setTimeout(r, 2000));

    await (prisma.subscription as any).updateMany({
      where: { tenantId },
      data: { aiTokensQuota: AI_TOKEN_QUOTA },
    });

    await (prisma.usageRecord as any).updateMany({
      where: { tenantId },
      data: { aiTokensUsed: 0, messagesUsed: 0, contactsUsed: 0 },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: ownerPassword });

    authTokenArr = response.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any).deleteMany({ where: { conversation: { tenantId } } }).catch(() => { });
      await (prisma.conversation as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.contact as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.usageRecord as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.subscription as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.aIConfig as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.whatsAppConfig as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma as any).user.deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id: tenantId } }).catch(() => { });
    }
    if (app) {
      await app.close();
    }
  });

  async function sendInboundWebhook(customerPhone: string, text: string) {
    const body = {
      event: 'message.received',
      data: {
        messageId: `msg-${randomUUID()}`,
        from: customerPhone,
        to: whatsappNumber,
        type: 'text',
        content: { text },
        timestamp: new Date().toISOString(),
      },
    };

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const signature = hmac.update(JSON.stringify(body)).digest('hex');

    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature', signature)
      .send(body);
  }

  async function getUsage(): Promise<{
    aiTokens: { used: number; quota: number };
    messages: { used: number; quota: number };
  }> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/usage`)
      .set('Cookie', authTokenArr)
      .expect(200);

    return {
      aiTokens: response.body.usage?.aiTokens || response.body.aiTokens,
      messages: response.body.usage?.messages || response.body.messages,
    };
  }

  async function getUsageRecordDirect() {
    return (prisma.usageRecord as any).findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  describe('Scenario 1: AI token consumption is tracked per response', () => {
    const customerPhone = '5511988880001';
    let conversationId: string;

    it('should receive an inbound message and create a conversation', async () => {
      const response = await sendInboundWebhook(
        customerPhone,
        'Olá, gostaria de saber sobre seus produtos',
      );
      expect(response.status).toBe(200);

      let conversation: any = null;
      for (let i = 0; i < 15; i++) {
        const contact = await (prisma.contact as any).findFirst({
          where: { tenantId, phone: customerPhone },
        });
        if (contact) {
          conversation = await (prisma.conversation as any).findFirst({
            where: { tenantId, contactId: contact.id },
          });
        }
        if (conversation) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      expect(conversation).toBeDefined();
      conversationId = conversation.id;
    });

    it('should record AI token usage when an AI response event is published', async () => {
      const usageBefore = await getUsageRecordDirect();
      const tokensBefore = usageBefore?.aiTokensUsed ?? 0;

      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId, phone: customerPhone },
      });

      const aiEvent = new AIResponseGeneratedIntegrationEvent({
        conversationId,
        tenantId,
        contactId: contact!.id,
        aiSessionId: randomUUID(),
        response: {
          type: 'TEXT',
          text: 'Olá! Temos diversos produtos disponíveis. Como posso ajudar?',
        },
        intent: 'SALES',
        sentiment: 'POSITIVE',
        confidence: 0.92,
        tokensUsed: 120,
      });

      await eventBus.publish(aiEvent);
      await new Promise((r) => setTimeout(r, 2000));

      const usageAfter = await getUsageRecordDirect();
      expect(usageAfter).toBeDefined();
      const delta = usageAfter.aiTokensUsed - tokensBefore;
      expect(delta).toBeGreaterThanOrEqual(360);
    }, 20000);

    it('should reflect cumulative token usage via the usage API', async () => {
      const usage = await getUsage();
      expect(usage.aiTokens.used).toBeGreaterThanOrEqual(360);
      expect(usage.aiTokens.quota).toBe(AI_TOKEN_QUOTA);
    });
  });

  describe('Scenario 2: Multiple AI responses accumulate token usage', () => {
    it('should accumulate tokens across multiple AI responses', async () => {
      await (prisma.usageRecord as any).updateMany({
        where: { tenantId },
        data: { aiTokensUsed: 0 },
      });

      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId },
      });
      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId },
      });

      const tokenAmounts = [85, 150, 95];

      for (const tokens of tokenAmounts) {
        const aiEvent = new AIResponseGeneratedIntegrationEvent({
          conversationId: conversation!.id,
          tenantId,
          contactId: contact!.id,
          aiSessionId: randomUUID(),
          response: {
            type: 'TEXT',
            text: `Resposta da IA com ${tokens} tokens`,
          },
          intent: 'SUPPORT',
          sentiment: 'NEUTRAL',
          confidence: 0.88,
          tokensUsed: tokens,
        });

        await eventBus.publish(aiEvent);
        await new Promise((r) => setTimeout(r, 500));
      }

      await new Promise((r) => setTimeout(r, 2000));

      const usageAfter = await getUsageRecordDirect();
      const expectedTotal = (85 + 150 + 95) * 3; // billable tokens
      expect(usageAfter.aiTokensUsed).toBe(expectedTotal);
    }, 20000);
  });

  describe('Scenario 3: Quota enforcement — usage exceeds quota', () => {
    it('should report usage exceeding quota when tokens are exhausted', async () => {
      await (prisma.usageRecord as any).updateMany({
        where: { tenantId },
        data: { aiTokensUsed: AI_TOKEN_QUOTA + 1 },
      });

      const usage = await getUsage();

      expect(usage.aiTokens.used).toBe(AI_TOKEN_QUOTA + 1);
      expect(usage.aiTokens.quota).toBe(AI_TOKEN_QUOTA);
      expect(usage.aiTokens.used).toBeGreaterThan(usage.aiTokens.quota);
    });
  });

  describe('Scenario 4: Token consumption stays within reasonable bounds', () => {
    it('should ensure a single AI response records exact token count', async () => {
      await (prisma.usageRecord as any).updateMany({
        where: { tenantId },
        data: { aiTokensUsed: 0 },
      });

      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId },
      });
      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId },
      });

      const aiEvent = new AIResponseGeneratedIntegrationEvent({
        conversationId: conversation!.id,
        tenantId,
        contactId: contact!.id,
        aiSessionId: randomUUID(),
        response: {
          type: 'TEXT',
          text: 'Resposta longa simulada para teste de limite de tokens',
        },
        intent: 'SALES',
        sentiment: 'POSITIVE',
        confidence: 0.95,
        tokensUsed: 450,
      });

      await eventBus.publish(aiEvent);
      await new Promise((r) => setTimeout(r, 2000));

      const usage = await getUsageRecordDirect();

      expect(usage.aiTokensUsed).toBe(1350);
      expect(usage.aiTokensUsed).toBeLessThanOrEqual(6000);
    }, 15000);
  });

  describe('Scenario 5: Usage API returns correct quota ratio', () => {
    it('should return percentage-safe quota values for frontend display', async () => {
      const eightyPercent = AI_TOKEN_QUOTA * 0.8;
      await (prisma.usageRecord as any).updateMany({
        where: { tenantId },
        data: { aiTokensUsed: eightyPercent },
      });

      const usage = await getUsage();

      expect(usage.aiTokens.used).toBe(eightyPercent);
      expect(usage.aiTokens.quota).toBe(AI_TOKEN_QUOTA);

      const percentage = (usage.aiTokens.used / usage.aiTokens.quota) * 100;
      expect(percentage).toBe(80);
    });
  });
});

