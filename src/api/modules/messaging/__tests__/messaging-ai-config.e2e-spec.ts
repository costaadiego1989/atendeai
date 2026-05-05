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
import { AI_ENGINE, IAIEngine, AIResponse } from '@modules/ai/application/ports/IAIEngine';
import { ExpressAdapter } from '@nestjs/platform-express';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '../../../shared/application/ports/IntegrationEvent';

describe('AI Config & Agent Treasure Injection (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authTokenArr: string[];

  const whatsappNumber = '5511977770002';
  const webhookSecret = 'ai-config-secret';
  const testCnpj = '66.231.944/0001-88';
  const cleanCnpj = testCnpj.replace(/\D/g, '');
  const ownerEmail = 'ai-config-test@test.com';
  const ownerPassword = 'SenhaForte123!';

  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => ({
      text: `Mocked response for testing configs`,
      tokensUsed: 10,
      confidence: 0.95,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
    })),
  };

  const subscribedHandlers = new Map<
    string,
    Array<{
      consumerName?: string;
      handle: (event: Record<string, unknown>) => Promise<void>;
    }>
  >();

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const handlers = subscribedHandlers.get(event.queue) || [];
      const serialized = event.toJSON ? event.toJSON() : event;

      for (const handler of handlers) {
        if (handler.consumerName === 'tenant-twilio-provisioning') {
          continue;
        }

        await handler.handle(serialized as Record<string, unknown>);
      }
    },
    subscribe<T extends IntegrationEvent>(
      queue: string,
      handler: (event: T) => Promise<void>,
      options?: { consumerName?: string },
    ): void {
      const handlers = subscribedHandlers.get(queue) || [];
      handlers.push({
        consumerName: options?.consumerName,
        handle: handler as unknown as (event: Record<string, unknown>) => Promise<void>,
      });
      subscribedHandlers.set(queue, handlers);
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_ENGINE)
      .useValue(mockAiEngine)
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    const tenantsToDelete = await (prisma.tenant as any).findMany({
      where: {
        OR: [{ cnpj: testCnpj }, { cnpj: cleanCnpj }, { users: { some: { email: ownerEmail } } }],
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
      await (prisma.tenantAgentRule as any).deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma as any).user.deleteMany({ where: { tenantId: tId } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id: tId } }).catch(() => { });
    }
    await (prisma as any).user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenantResult = await createTenant.execute({
      companyName: 'AI Config Test Store',
      cnpj: testCnpj,
      ownerName: 'Config Owner',
      ownerEmail,
      ownerPhone: '11955550002',
      ownerPassword,
      plan: 'ESSENCIAL',
    });
    tenantId = tenantResult.id;

    const tenant = await tenantRepository.findById(tenantId);
    const wsConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '9091',
        token: 'ai-config-e2e',
        apiUrl: 'https://9091.bubblewhats.com',
      },
      whatsappNumber,
      webhookSecret,
    });
    wsConfig.activate();
    tenant!.configureWhatsApp(wsConfig);
    await tenantRepository.save(tenant!);

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
      await (prisma.tenantAgentRule as any).deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma as any).user.deleteMany({ where: { tenantId } }).catch(() => { });
      await (prisma.tenant as any).delete({ where: { id: tenantId } }).catch(() => { });
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

  async function waitForMessages(phone: string, minOutbound: number = 1) {
    for (let i = 0; i < 20; i++) {
      const contact = await (prisma.contact as any).findFirst({ where: { tenantId, phone } });
      if (contact) {
        const conversation = await (prisma.conversation as any).findFirst({ where: { tenantId, contactId: contact.id } });
        if (conversation) {
          const messages = await (prisma.message as any).findMany({
            where: { conversationId: conversation.id, direction: 'OUTBOUND' },
          });
          if (messages.length >= minOutbound) return messages;
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }

  describe('Scenario 1: Base AI Settings (Front-end Settings Panel)', () => {
    it('should configure AI settings via API', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', authTokenArr)
        .send({
          systemPrompt: 'Você é um assistente cirúrgico focado em vendas.',
          tone: 'PROFESSIONAL',
          language: 'pt-BR',
          maxTokensPerResponse: 250,
          confidenceThreshold: 0.8,
          escalationMessage: 'Transferindo para a equipe médica.',
        });

      expect(response.status).toBe(200);
    });

    it('should inject base configs into the AI Engine prompt', async () => {
      const phone = '5511900000001';
      await sendInboundWebhook(phone, 'Gostaria de saber mais.');

      const messages = await waitForMessages(phone);
      expect(messages).not.toBeNull();

      expect(mockAiEngine.generateResponse).toHaveBeenCalledTimes(1);
      const aiCallArgs = (mockAiEngine.generateResponse as jest.Mock).mock.calls[0][0];

      expect(aiCallArgs.maxTokens).toBe(250);
      expect(aiCallArgs.systemPrompt).toContain('Você é um assistente cirúrgico focado em vendas.');
      expect(aiCallArgs.systemPrompt).toContain('Response Tone: PROFESSIONAL');
      expect(aiCallArgs.systemPrompt).toContain('Preferred Language: pt-BR');
    });
  });

  describe('Scenario 2: Module-specific Agent Treasure (Agent Rules)', () => {
    it('should configure a custom agent rule for messaging', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/agent-rules/messaging`)
        .set('Cookie', authTokenArr)
        .send({
          customPrompt: 'SEMPRE termine suas frases com: "Posso agendar sua consulta?"',
          fallbackToGlobal: true,
          isActive: true,
        });

      expect(response.status).toBe(200);
    });

    it('should append the agent treasure rule to the AI Engine prompt', async () => {
      const phone = '5511900000002';
      await sendInboundWebhook(phone, 'Como funciona o atendimento?');

      const messages = await waitForMessages(phone);
      expect(messages).not.toBeNull();

      const aiCallArgs = (mockAiEngine.generateResponse as jest.Mock).mock.calls[0][0];

      expect(aiCallArgs.systemPrompt).toContain('Você é um assistente cirúrgico focado em vendas.');
      expect(aiCallArgs.systemPrompt).toContain('[DIRETRIZES PERSONALIZADAS DE CONVERSAS DO TENANT]:');
      expect(aiCallArgs.systemPrompt).toContain('SEMPRE termine suas frases com: "Posso agendar sua consulta?"');
    });

    it('should override global prompt if fallbackToGlobal is false', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/agent-rules/messaging`)
        .set('Cookie', authTokenArr)
        .send({ customPrompt: 'SEMPRE termine suas frases com: "Posso agendar sua consulta?"', fallbackToGlobal: false, isActive: true });

      const phone = '5511900000003';
      await sendInboundWebhook(phone, 'Qual o valor?');

      await waitForMessages(phone);

      const aiCallArgs = (mockAiEngine.generateResponse as jest.Mock).mock.calls[0][0];

      expect(aiCallArgs.systemPrompt).toContain('[ATENCAO: AS DIRETRIZES DO TENANT ABAIXO DEVEM TER PRIORIDADE SOBRE O TOM PADRAO.]');
      expect(aiCallArgs.systemPrompt).toContain('SEMPRE termine suas frases com: "Posso agendar sua consulta?"');
    });
  });

  describe('Scenario 3: Handoff Threshold Configuration', () => {
    it('should respect the escalationMessage and confidenceThreshold when confidence is low', async () => {
      (mockAiEngine.generateResponse as jest.Mock).mockResolvedValueOnce({
        text: `Eu não sei responder isso`,
        tokensUsed: 15,
        confidence: 0.5, // Below the 0.8 threshold we configured
        finishReason: 'stop',
        intent: 'UNKNOWN',
        sentiment: 'NEUTRAL',
      });

      const phone = '5511900000004';
      await sendInboundWebhook(phone, 'Quero falar de um problema cirúrgico complexo');

      const messages = await waitForMessages(phone);
      expect(messages).not.toBeNull();

      const lastMessage = messages![messages!.length - 1];
      expect(lastMessage.content.text).toBe('Transferindo para a equipe médica.');
      expect(lastMessage.sentBy).toBe('AI');
    });
  });
});
