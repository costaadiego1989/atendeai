import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { AIResponseGeneratedIntegrationEvent } from '@modules/ai/application/integration-events/publishers/AIIntegrationEvents';
import * as crypto from 'crypto';
import * as cookieParser from 'cookie-parser';
import { ExpressAdapter } from '@nestjs/platform-express';

describe('MessagingModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authTokenArr: string[];
  const whatsappNumber = '5511911112222';
  const webhookSecret = 'test-secret';
  const testCnpj = '00.000.000/0001-91';
  const cleanCnpj = testCnpj.replace(/\D/g, '');

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

    const tenantsToDelete = await (prisma.tenant as any).findMany({
      where: {
        OR: [
          { cnpj: testCnpj },
          { cnpj: cleanCnpj },
          { users: { some: { email: 'messaging-test@test.com' } } },
          { whatsappConfig: { whatsappNumber: whatsappNumber } },
        ],
      },
    });

    for (const t of tenantsToDelete) {
      const tId = t.id;
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId: tId } } })
        .catch(() => {});
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.aISession as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.usageRecord as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.aIConfig as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.whatsAppConfig as any)
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma as any).user
        .deleteMany({ where: { tenantId: tId } })
        .catch(() => {});
      await (prisma.tenant as any)
        .delete({ where: { id: tId } })
        .catch(() => {});
    }

    await (prisma as any).user
      .deleteMany({ where: { email: 'messaging-test@test.com' } })
      .catch(() => {});

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenantResult = await createTenant.execute({
      companyName: 'Messaging Test Store',
      cnpj: testCnpj,
      ownerName: 'Messaging Test Owner',
      ownerEmail: 'messaging-test@test.com',
      ownerPhone: '11955554444',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });
    tenantId = tenantResult.id;

    const tenant = await tenantRepository.findById(tenantId);
    const wsConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token-e2e',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      whatsappNumber,
      webhookSecret,
    });
    wsConfig.activate();
    tenant!.configureWhatsApp(wsConfig);
    await tenantRepository.save(tenant!);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'messaging-test@test.com',
        password: 'SenhaForte123!',
      });

    authTokenArr = response.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).user
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.tenant as any)
        .delete({ where: { id: tenantId } })
        .catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  describe('Cenário 1: Processamento de Mensagem Inbound', () => {
    it('deve receber um webhook, criar conversa e publicar evento', async () => {
      const body = {
        event: 'message.received',
        data: {
          messageId: `msg-${randomUUID()}`,
          from: '5511999998888',
          to: whatsappNumber,
          type: 'text',
          content: { text: 'Oi, quero comprar um tênis' },
          timestamp: new Date().toISOString(),
        },
      };

      const hmac = crypto.createHmac('sha256', webhookSecret);
      const signature = hmac.update(JSON.stringify(body)).digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature', signature)
        .send(body);

      expect(response.status).toBe(200);

      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId, phone: '5511999998888' },
      });
      expect(contact).toBeDefined();

      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId, contactId: contact?.id },
      });
      expect(conversation).toBeDefined();

      const message = await (prisma.message as any).findFirst({
        where: { conversationId: conversation?.id, direction: 'INBOUND' },
      });
      expect((message?.content as any).text).toContain(
        'Oi, quero comprar um tênis',
      );
    });
  });

  describe('Cenário 2: Resposta Automatizada (Outbound)', () => {
    it('deve salvar resposta da IA na conversa e simular envio via provider', async () => {
      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId },
      });
      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId },
      });

      const uniqueText = 'Olá! UNIQUE_AI_RESPONSE_123';
      const event = new AIResponseGeneratedIntegrationEvent({
        conversationId: conversation!.id,
        tenantId: tenantId,
        contactId: contact!.id,
        aiSessionId: randomUUID(),
        response: { type: 'TEXT', text: uniqueText },
        intent: 'SALES',
        sentiment: 'POSITIVE',
        confidence: 0.95,
        tokensUsed: 50,
      });

      let message = null;
      for (let i = 0; i < 20; i++) {
        const messages = await (prisma.message as any).findMany({
          where: {
            conversationId: conversation!.id,
            direction: 'OUTBOUND',
            sentBy: 'AI',
          },
        });

        message = messages.find((m: any) => {
          const content =
            typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
          const textResponse =
            content?.text || content?.content?.text || JSON.stringify(content);
          return textResponse.includes('UNIQUE_AI_RESPONSE_123');
        });

        if (message) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.dir(message, { depth: null });
      expect(message).toBeDefined();
      expect(message).not.toBeNull();

      const content =
        typeof message?.content === 'string'
          ? JSON.parse(message.content)
          : message?.content;
      const textResponse =
        content?.text || content?.content?.text || JSON.stringify(content);
      expect(textResponse).toContain('UNIQUE_AI_RESPONSE_123');
    }, 25000);
  });

  describe('Cenário 3: Recuperação de Histórico', () => {
    it('deve listar as mensagens da conversa corretamente', async () => {
      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId },
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/conversations/${conversation!.id}/messages`,
        )
        .set('Cookie', authTokenArr);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  describe('Cenário 4: Envio Manual de Mensagem (Human)', () => {
    it('deve enviar uma mensagem manual e enfileirar para entrega', async () => {
      const conversation = await (prisma.conversation as any).findFirst({
        where: { tenantId },
      });

      const payload = {
        content: {
          type: 'TEXT',
          text: 'Olá do humano',
        },
      };

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/tenants/${tenantId}/conversations/${conversation!.id}/messages`,
        )
        .set('Cookie', authTokenArr)
        .send(payload);

      console.log('API RESPONSE BODY:', response.body);
      expect(response.status).toBe(201);
      const messageId =
        response.body?.data?.messageId ||
        response.body?.messageId ||
        response.body?.id;
      expect(messageId).toBeDefined();

      let message = null;
      for (let i = 0; i < 10; i++) {
        message = await (prisma.message as any).findFirst({
          where: {
            conversationId: conversation!.id,
            direction: 'OUTBOUND',
            sentBy: 'HUMAN',
          },
        });
        if (message) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      expect(message).toBeDefined();
      expect(message).not.toBeNull();
      const content =
        typeof message?.content === 'string'
          ? JSON.parse(message.content)
          : message?.content;
      const textResponse =
        content?.text || content?.content?.text || JSON.stringify(content);
      expect(textResponse).toBe('Olá do humano');
    }, 15000);
  });

  describe('Cenário 5: Validação de Assinatura de Webhook (Negativo)', () => {
    it('deve rejeitar webhook com assinatura inválida', async () => {
      const body = {
        event: 'message.received',
        data: {
          messageId: `msg-err-${randomUUID()}`,
          from: '123',
          to: whatsappNumber,
          type: 'text',
          content: { text: 'oi' },
          timestamp: new Date().toISOString(),
        },
      };

      const hmac = crypto.createHmac('sha256', webhookSecret);
      const invalidSignature =
        hmac.update(JSON.stringify(body)).digest('hex') + 'wrong';

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature', invalidSignature)
        .send(body);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid signature');
    }, 10000);
  });
});
