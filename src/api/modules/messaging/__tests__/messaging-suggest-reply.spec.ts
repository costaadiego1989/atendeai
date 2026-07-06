import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '../../tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '../../tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '../../tenant/domain/entities/WhatsAppConfig';
import {
  AI_ENGINE,
  AIResponse,
  IAIEngine,
} from '../../ai/application/ports/IAIEngine';
import { MESSAGE_QUEUE } from '../domain/ports/IMessageQueue';
import { FollowUpService } from '../application/services/FollowUpService';
import {
  EVENT_BUS,
  IEventBus,
} from '../../../shared/application/ports/IEventBus';
import { IntegrationEvent } from '../../../shared/application/ports/IntegrationEvent';

describe('Suggest AI Agent Reply (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authCookies: string[];
  const userPhone = '5521993001883';

  const seed = Date.now();
  const ownerEmail = `suggest-reply-owner-${seed}@test.com`;
  const ownerPassword = 'SenhaForte123!';
  const bubbleWhatsId = `bw-sr-${seed}`;
  const whatsappNumber = `55219${String(seed).slice(-8)}`;
  const testCnpj = generateValidCnpj(seed);

  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(
      async (request): Promise<AIResponse> => ({
        text: `Rascunho Inteligente IA: Próximo Passo Mapeado`,
        tokensUsed: 20,
        confidence: 0.99,
        finishReason: 'stop',
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
      }),
    ),
    generateStructuredResponse: jest.fn(),
    generateTextResponse: jest.fn(
      async () => `Rascunho Inteligente IA: Próximo Passo Mapeado`,
    ),
  };

  const mockMessageQueue = {
    addJob: jest.fn(async () => {}),
  };

  const mockFollowUpService = {
    cancelFollowUps: jest.fn(async () => {}),
    scheduleFollowUps: jest.fn(async () => {}),
  };

  const subscribedHandlers = new Map<
    string,
    Array<(event: Record<string, unknown>) => Promise<void>>
  >();

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const handlers = subscribedHandlers.get(event.queue) || [];
      const serialized = event.toJSON();
      for (const handler of handlers) await handler(serialized);
    },
    subscribe<T extends IntegrationEvent>(
      queue: string,
      handler: (event: T) => Promise<void>,
    ): void {
      const handlers = subscribedHandlers.get(queue) || [];
      handlers.push(
        handler as unknown as (event: Record<string, unknown>) => Promise<void>,
      );
      subscribedHandlers.set(queue, handlers);
    },
  };

  function generateValidCnpj(seedValue: number): string {
    const base = String(seedValue).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const digit1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const digit2 = calcDigit(
      `${base}${digit1}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return `${base}${digit1}${digit2}`.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  async function seedBilling(tenantId: string, aiQuota: number = 5000) {
    const cycleStart = new Date();
    cycleStart.setDate(1);
    cycleStart.setHours(0, 0, 0, 0);

    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_schema.subscriptions (
        id, tenant_id, plan, status, messages_quota, ai_tokens_quota, contacts_quota,
        billing_cycle_start, billing_cycle_end, created_at
      ) VALUES (
        gen_random_uuid(), ${tenantId}::uuid, 'ESSENCIAL', 'ACTIVE', 1000, ${aiQuota}, 100,
        ${cycleStart}::date, ${cycleEnd}::date, now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        ai_tokens_quota = EXCLUDED.ai_tokens_quota,
        status = EXCLUDED.status,
        billing_cycle_start = EXCLUDED.billing_cycle_start,
        billing_cycle_end = EXCLUDED.billing_cycle_end
    `);

    return { cycleStart, cycleEnd };
  }

  async function getUsage(tenantId: string, periodStart: Date) {
    return prisma.usageRecord.findUnique({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart,
        },
      },
    });
  }

  async function sendInbound(phone: string, text: string, externalId: string) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({
        id: externalId,
        fromNumber: phone,
        toNumber: whatsappNumber,
        body: text,
        messageContext: {
          key: { fromMe: false, id: externalId },
          message: { extendedTextMessage: { text } },
        },
      })
      .expect(200);
  }

  async function waitForConversation(phone: string) {
    for (let i = 0; i < 20; i++) {
      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId, phone },
      });
      if (contact) {
        const conversation = await (prisma.conversation as any).findFirst({
          where: { tenantId, contactId: contact.id },
        });
        if (conversation) return { contact, conversation };
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return null;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .overrideProvider(AI_ENGINE)
      .useValue(mockAiEngine)
      .overrideProvider(MESSAGE_QUEUE)
      .useValue(mockMessageQueue)
      .overrideProvider(FollowUpService)
      .useValue(mockFollowUpService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'Suggest AI Reply Store',
      cnpj: testCnpj,
      ownerName: 'Suggest Owner',
      ownerEmail,
      ownerPhone: '11955554444',
      ownerPassword,
      plan: 'ESSENCIAL',
    });
    tenantId = tenant.id;

    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    await configureAI.execute({
      tenantId,
      systemPrompt: 'Assistente e Copiloto Comercial',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 300,
      confidenceThreshold: 0.7,
      businessRules: [],
    });

    const savedTenant = await tenantRepository.findById(tenantId);
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: bubbleWhatsId,
        token: 'ai-suggest-token',
        apiUrl: `https://${bubbleWhatsId}.bubblewhats.com`,
      },
      whatsappNumber,
      webhookSecret: null,
    });
    whatsAppConfig.activate();
    savedTenant!.configureWhatsApp(whatsAppConfig);
    await tenantRepository.save(savedTenant!);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);

    authCookies = loginResponse.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM messaging_schema.conversation_intelligence WHERE tenant_id = ${tenantId}::uuid`,
      );
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.aIConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.whatsAppConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});

      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM billing_schema.usage_records WHERE tenant_id = ${tenantId}::uuid`,
      );
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM billing_schema.subscriptions WHERE tenant_id = ${tenantId}::uuid`,
      );

      await (prisma.user as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.tenant as any)
        .delete({ where: { id: tenantId } })
        .catch(() => {});
    }
    await app.close();
  });

  it('should create an inbound conversation from user phone, execute Suggest Reply and deduct REAL quota x3', async () => {
    const { cycleStart } = await seedBilling(tenantId, 5000);

    const firstText = 'Gostaria de agendar uma demonstração do AtendeAi';
    await sendInbound(userPhone, firstText, `ai-sugg-real-${Date.now()}`);

    const persisted = await waitForConversation(userPhone);
    expect(persisted).not.toBeNull();
    const { conversation } = persisted!;

    (mockAiEngine.generateResponse as jest.Mock).mockClear();

    const suggestResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversation.id}/suggest-reply`,
      )
      .set('Cookie', authCookies)
      .expect(201);

    expect(suggestResponse.body).toEqual({
      text: 'Rascunho Inteligente IA: Próximo Passo Mapeado',
    });

    const usage = await getUsage(tenantId, cycleStart);
    expect(usage).not.toBeNull();
    expect(usage?.aiTokensUsed).toBe(60);
  });

  it('should return error text if REAL quota is exhausted in database', async () => {
    const { cycleStart } = await seedBilling(tenantId, 10);

    await prisma.usageRecord.upsert({
      where: { tenantId_periodStart: { tenantId, periodStart: cycleStart } },
      create: {
        tenantId,
        periodStart: cycleStart,
        periodEnd: cycleStart,
        aiTokensUsed: 10,
      },
      update: { aiTokensUsed: 10 },
    });

    const phone = '5511988887777';
    await sendInbound(phone, 'Ola exausto', `ai-sugg-exhaust-${Date.now()}`);
    const persisted = await waitForConversation(phone);
    const { conversation } = persisted!;

    const suggestResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversation.id}/suggest-reply`,
      )
      .set('Cookie', authCookies)
      .expect(201);

    expect(suggestResponse.body).toEqual({
      text: 'Limite de uso da IA atingido. Renove seu plano para gerar sugestões.',
    });
  });

  it('should return provisioning message when subscription does not exist (NO_SUBSCRIPTION)', async () => {
    // Remove any existing subscription and usage for the tenant
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM billing_schema.usage_records WHERE tenant_id = ${tenantId}::uuid`,
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM billing_schema.subscriptions WHERE tenant_id = ${tenantId}::uuid`,
    );

    const phone = '5511977776666';
    await sendInbound(
      phone,
      'Ola sem subscription',
      `ai-sugg-nosub-${Date.now()}`,
    );
    const persisted = await waitForConversation(phone);
    const { conversation } = persisted!;

    const suggestResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversation.id}/suggest-reply`,
      )
      .set('Cookie', authCookies)
      .expect(201);

    // Should NOT say "Limite de uso da IA atingido" — should indicate provisioning issue
    expect(suggestResponse.body.text).not.toContain(
      'Limite de uso da IA atingido',
    );
    expect(suggestResponse.body.text).toContain('sendo configurada');
  });
});
