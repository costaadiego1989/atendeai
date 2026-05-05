import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { AI_ENGINE, AIResponse, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import { IProcessAIResponseUseCase } from '@modules/ai/application/use-cases/interfaces/IProcessAIResponseUseCase';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '@modules/ai/application/ports/IChatHistoryRepository';

type AICall = {
  systemPrompt: string;
  userMessage: string;
};

describe('Agent rules impact cross-module (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processAIResponseUseCase: IProcessAIResponseUseCase;
  let chatHistoryRepository: IChatHistoryRepository;

  let tenantId: string;
  let tenantIdTwo: string;
  let authCookies: string[];
  let authCookiesTwo: string[];

  const seed = Date.now();
  const ownerEmail = `agent-rules-impact-${seed}@test.com`;
  const ownerEmailTwo = `agent-rules-impact-other-${seed}@test.com`;
  const password = 'SenhaForte123!';

  const aiCalls: AICall[] = [];

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const queue = event.queue;
      const handlers = subscribers.get(queue) || [];
      const payload = event.toJSON ? event.toJSON() : event;

      for (const handler of handlers) {
        if (handler.consumerName === 'tenant-twilio-provisioning') {
          continue;
        }
        await handler.handle(payload as Record<string, unknown>);
      }
    },
    subscribe<T extends IntegrationEvent>(
      queue: string,
      handler: (event: T) => Promise<void>,
      options?: { consumerName?: string },
    ): void {
      const handlers = subscribers.get(queue) || [];
      handlers.push({
        consumerName: options?.consumerName,
        handle: handler as unknown as (event: Record<string, unknown>) => Promise<void>,
      });
      subscribers.set(queue, handlers);
    },
  };

  const subscribers = new Map<
    string,
    Array<{
      consumerName?: string;
      handle: (event: Record<string, unknown>) => Promise<void>;
    }>
  >();

  const mockQuotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 100000,
      status: 'ACTIVE',
    })),
  };

  const mockAIEngine: IAIEngine = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => {
      aiCalls.push({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
      });

      const prompt = request.systemPrompt;

      if (prompt.includes('REGRA_MESSAGING_OVERRIDE')) {
        return {
          text: 'SUGESTAO_MESSAGING_OVERRIDE',
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('REGRA_MESSAGING_TENANT')) {
        return {
          text: 'SUGESTAO_MESSAGING_TENANT',
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('REGRA_SALES_CUSTOM')) {
        return {
          text: JSON.stringify({
            name: 'Link Regra Sales',
            description: 'Gerado por regra customizada',
            label: 'Oferta VIP',
            value: 199,
            billingType: 'PIX',
            expiresAt: null,
          }),
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('REGRA_PROSPECT_BRANCH')) {
        return {
          text: 'MENSAGEM_PROSPECT_BRANCH',
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('REGRA_PROSPECT_GLOBAL')) {
        return {
          text: 'MENSAGEM_PROSPECT_GLOBAL',
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('REGRA_CHECKOUT_CUSTOM')) {
        return {
          text: 'MENSAGEM_CHECKOUT_CUSTOM',
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      if (prompt.includes('Formato exato: {"name":"","description":"","label":"","value":0')) {
        return {
          text: JSON.stringify({
            name: 'RESPOSTA_PADRAO_SEM_REGRA',
            description: 'Sem personalizacao',
            label: 'Padrao',
            value: 99,
            billingType: 'PIX',
            expiresAt: null,
          }),
          tokensUsed: 0,
          confidence: 0.98,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }

      return {
        text: 'RESPOSTA_PADRAO_SEM_REGRA',
        tokensUsed: 0,
        confidence: 0.98,
        finishReason: 'stop',
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
      };
    }),
  };

  async function login(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!;
  }

  async function upsertAgentRule(
    targetTenantId: string,
    moduleId: string,
    cookies: string[],
    customPrompt: string,
    options?: {
      branchId?: string;
      isActive?: boolean;
      fallbackToGlobal?: boolean;
      notes?: string;
    },
  ) {
    const query = options?.branchId ? `?branchId=${options.branchId}` : '';
    return request(app.getHttpServer())
      .put(`/api/v1/tenants/${targetTenantId}/agent-rules/${moduleId}${query}`)
      .set('Cookie', cookies)
      .send({
        customPrompt,
        isActive: options?.isActive ?? true,
        fallbackToGlobal: options?.fallbackToGlobal ?? true,
        notes: options?.notes ?? 'Regra de e2e',
      })
      .expect(200);
  }

  async function createConversationForTenant(targetTenantId: string, name: string, phone: string) {
    const contact = await prisma.contact.create({
      data: {
        tenantId: targetTenantId,
        name,
        phone,
        stage: 'LEAD',
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId: targetTenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    await prisma.message.create({
      data: {
        id: randomUUID(),
        conversationId: conversation.id,
        direction: 'INBOUND',
        sentBy: 'CONTACT',
        content: { type: 'TEXT', text: 'Quero ajuda com meu pedido' },
        externalId: `msg-${randomUUID()}`,
      },
    });

    return { contact, conversation };
  }

  function latestAICall(): AICall {
    const last = aiCalls[aiCalls.length - 1];
    expect(last).toBeDefined();
    return last!;
  }

  function makeValidCnpj(seedValue: number): string {
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
    const cnpj = `${base}${digit1}${digit2}`;
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_ENGINE)
      .useValue(mockAIEngine)
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(mockQuotaUseCase)
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    processAIResponseUseCase = app.get(IProcessAIResponseUseCase);
    chatHistoryRepository = app.get(CHAT_HISTORY_REPOSITORY);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);

    const tenantOne = await createTenant.execute({
      companyName: 'Agent Rules Impact One',
      cnpj: makeValidCnpj(seed),
      ownerName: 'Owner One',
      ownerEmail,
      ownerPhone: '11971000021',
      ownerPassword: password,
      plan: 'ESSENCIAL',
      businessType: 'MARKET',
    });
    tenantId = tenantOne.id;

    const tenantTwo = await createTenant.execute({
      companyName: 'Agent Rules Impact Two',
      cnpj: makeValidCnpj(seed + 1),
      ownerName: 'Owner Two',
      ownerEmail: ownerEmailTwo,
      ownerPhone: '11971000022',
      ownerPassword: password,
      plan: 'ESSENCIAL',
      businessType: 'MARKET',
    });
    tenantIdTwo = tenantTwo.id;

    authCookies = await login(ownerEmail);
    authCookiesTwo = await login(ownerEmailTwo);
  });

  beforeEach(() => {
    aiCalls.length = 0;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (prisma) {
      const tenantIds = [tenantId, tenantIdTwo].filter(Boolean);

      for (const id of tenantIds) {
        await prisma
          .$executeRaw(Prisma.sql`
            DELETE FROM tenant_schema.tenant_agent_rule_history
            WHERE tenant_id = ${id}::uuid
          `)
          .catch(() => {});
        await prisma
          .$executeRaw(Prisma.sql`
            DELETE FROM tenant_schema.tenant_agent_rules
            WHERE tenant_id = ${id}::uuid
          `)
          .catch(() => {});
      }

      await prisma.message
        .deleteMany({
          where: {
            conversation: {
              tenantId: { in: tenantIds },
            },
          },
        })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.contact
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.aISession
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.aIConfig
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: { in: tenantIds } } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('messaging: aplica regra ativa e altera sugestao final', async () => {
    await upsertAgentRule(
      tenantId,
      'messaging',
      authCookies,
      'REGRA_MESSAGING_TENANT: usar tom consultivo e objetivo.',
    );

    const { conversation } = await createConversationForTenant(
      tenantId,
      'Contato Messaging',
      `551190${String(Date.now()).slice(-7)}`,
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/${conversation.id}/suggest-reply`)
      .set('Cookie', authCookies)
      .expect(201);

    expect(response.body).toEqual({ text: 'SUGESTAO_MESSAGING_TENANT' });
    const last = latestAICall();
    expect(last.systemPrompt).toContain('[DIRETRIZES DE TOM DE VOZ E ATENDIMENTO]');
    expect(last.systemPrompt).toContain('REGRA_MESSAGING_TENANT');
  });

  it('messaging: fallback false prioriza regra e regra inativa nao deve impactar', async () => {
    await upsertAgentRule(
      tenantId,
      'messaging',
      authCookies,
      'REGRA_MESSAGING_OVERRIDE: ignorar regras globais de tom.',
      { fallbackToGlobal: false },
    );

    const first = await createConversationForTenant(
      tenantId,
      'Contato Messaging Override',
      `551191${String(Date.now()).slice(-7)}`,
    );

    const overrideResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/${first.conversation.id}/suggest-reply`)
      .set('Cookie', authCookies)
      .expect(201);

    expect(overrideResponse.body).toEqual({ text: 'SUGESTAO_MESSAGING_OVERRIDE' });
    const promptWithOverride = latestAICall().systemPrompt;
    expect(promptWithOverride).toContain('[IGONORE REGRAS DE OUTROS AGENTES]');
    expect(promptWithOverride).toContain('REGRA_MESSAGING_OVERRIDE');

    await upsertAgentRule(
      tenantId,
      'messaging',
      authCookies,
      'REGRA_MESSAGING_INATIVA: nao deveria aparecer.',
      { isActive: false, fallbackToGlobal: true },
    );

    const second = await createConversationForTenant(
      tenantId,
      'Contato Messaging Inativo',
      `551192${String(Date.now()).slice(-7)}`,
    );

    const inactiveResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/${second.conversation.id}/suggest-reply`)
      .set('Cookie', authCookies)
      .expect(201);

    expect(inactiveResponse.body).toEqual({ text: 'RESPOSTA_PADRAO_SEM_REGRA' });
    const promptWithoutActiveRule = latestAICall().systemPrompt;
    expect(promptWithoutActiveRule).not.toContain('REGRA_MESSAGING_INATIVA');
  });

  it('sales: injeta regra do modulo e altera payload final', async () => {
    await upsertAgentRule(
      tenantId,
      'sales',
      authCookies,
      'REGRA_SALES_CUSTOM: enfatizar oferta VIP e PIX.',
      { fallbackToGlobal: false },
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/sales/links/ai-suggestions')
      .set('Cookie', authCookies)
      .send({ prompt: 'Crie um link para plano premium de onboarding' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        name: 'Link Regra Sales',
        label: 'Oferta VIP',
        value: 199,
        billingType: 'PIX',
      }),
    );

    const last = latestAICall();
    expect(last.systemPrompt).toContain('[DIRETRIZES PERSONALIZADAS DO AGENTE DE VENDAS]');
    expect(last.systemPrompt).toContain('REGRA_SALES_CUSTOM');
    expect(last.systemPrompt).toContain('IGNORE INSTRUCOES GERAIS DA EMPRESA');
  });

  it('prospecting: regra de branch deve prevalecer sobre global', async () => {
    const branchId = randomUUID();

    await upsertAgentRule(
      tenantId,
      'prospecting',
      authCookies,
      'REGRA_PROSPECT_GLOBAL: usar abertura institucional.',
    );

    await upsertAgentRule(
      tenantId,
      'prospecting',
      authCookies,
      'REGRA_PROSPECT_BRANCH: usar abertura local da filial.',
      { branchId, fallbackToGlobal: false },
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/prospecting/campaigns/message-suggestion?branchId=${branchId}`)
      .set('Cookie', authCookies)
      .send({
        objective: 'Aumentar agendamentos',
        audienceType: 'CONTACT_LIST',
        channels: ['WHATSAPP'],
        selectedCount: 2,
        selectedContacts: [
          { name: 'Contato A', stage: 'LEAD' },
          { name: 'Contato B', stage: 'LEAD' },
        ],
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        messageTemplate: 'MENSAGEM_PROSPECT_BRANCH',
      }),
    );

    const last = latestAICall();
    expect(last.systemPrompt).toContain('REGRA_PROSPECT_BRANCH');
    expect(last.systemPrompt).not.toContain('REGRA_PROSPECT_GLOBAL');
  });

  it('checkout(commerce): moduleId checkout injeta regra e persiste resposta final no historico', async () => {
    await upsertAgentRule(
      tenantId,
      'checkout',
      authCookies,
      'REGRA_CHECKOUT_CUSTOM: retomar carrinho de forma consultiva.',
      { fallbackToGlobal: false },
    );

    const { contact, conversation } = await createConversationForTenant(
      tenantId,
      'Contato Checkout',
      `551193${String(Date.now()).slice(-7)}`,
    );

    const result = await processAIResponseUseCase.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      moduleId: 'checkout',
      content: {
        type: 'TEXT',
        text: 'Quero retomar meu carrinho',
      },
    });

    expect(result).toEqual({ success: true });
    const last = latestAICall();
    expect(last.systemPrompt).toContain('REGRA_CHECKOUT_CUSTOM');

    const history = await chatHistoryRepository.getHistory(conversation.id);
    const assistantMessages = history.filter((entry) => entry.role === 'assistant');
    expect(assistantMessages.some((entry) => entry.content.includes('MENSAGEM_CHECKOUT_CUSTOM'))).toBe(
      true,
    );
  });

  it('isolamento: regra de tenant/modulo nao contamina outro tenant nem outro modulo', async () => {
    await upsertAgentRule(
      tenantIdTwo,
      'sales',
      authCookiesTwo,
      'REGRA_SALES_TENANT_2: exclusiva do tenant 2.',
    );

    await upsertAgentRule(
      tenantId,
      'messaging',
      authCookies,
      'REGRA_MESSAGING_EXCLUSIVA: exclusiva do messaging.',
    );
    await upsertAgentRule(
      tenantId,
      'sales',
      authCookies,
      'REGRA_SALES_INATIVA: nao deve impactar o tenant 1.',
      { isActive: false },
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/sales/links/ai-suggestions')
      .set('Cookie', authCookies)
      .send({ prompt: 'Gerar oferta de assinatura mensal' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        name: 'RESPOSTA_PADRAO_SEM_REGRA',
      }),
    );

    const last = latestAICall().systemPrompt;
    expect(last).not.toContain('REGRA_SALES_TENANT_2');
    expect(last).not.toContain('REGRA_MESSAGING_EXCLUSIVA');
  });
});
