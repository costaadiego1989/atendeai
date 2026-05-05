import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '@modules/tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import { IUpdateBusinessDataUseCase } from '@modules/tenant/application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import {
  AI_ENGINE,
  AIResponse,
  IAIEngine,
} from '@modules/ai/application/ports/IAIEngine';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { MESSAGE_QUEUE } from '../domain/ports/IMessageQueue';
import { FollowUpService } from '../application/services/FollowUpService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import Redis from 'ioredis';
import { CreateSchedulingCategoryUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingCategoryUseCase';
import { CreateSchedulingProfessionalUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingProfessionalUseCase';
import { AssignProfessionalCategoriesUseCase } from '@modules/scheduling/application/use-cases/AssignProfessionalCategoriesUseCase';
import { SetProfessionalAvailabilityUseCase } from '@modules/scheduling/application/use-cases/SetProfessionalAvailabilityUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';

type ScenarioDefinition = {
  key: 'mercado' | 'barbearia' | 'clinica' | 'petshop' | 'curso';
  userType: string;
  needType: string;
  companyType: string;
  companyName: string;
  inboundText: string;
  phone: string;
  businessDescription: string;
  services: string;
  expectedFragments: string[];
  expectedCtaFragments: string[];
  expectedCommercialContext?: 'inventory' | 'catalog';
  expectedSchedulingContext?: boolean;
  expectsPaymentLink?: boolean;
  tenantId?: string;
  whatsappNumber?: string;
};

type EventTrace = {
  queue: string;
  eventName?: string;
  payload: Record<string, any>;
  handlerCount: number;
};

type AICallTrace = {
  companyName: string;
  businessType?: string;
  userMessage: string;
  guardrailApplied: boolean;
  historyLength: number;
  commercialContextType: 'inventory' | 'catalog' | null;
  schedulingContextIncluded: boolean;
};

type QueueTrace = {
  messageId: string;
};

type ScenarioResult = {
  webhookStatus: number;
  contactId: string;
  conversationId: string;
  outboundText: string;
  aiTrace: AICallTrace;
  eventQueues: string[];
  queuedCount: number;
  followUpCount: number;
};

describe('WhatsApp commercial discovery flow (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let redis: Redis;

  const createdTenantIds: string[] = [];
  const eventTraces: EventTrace[] = [];
  const aiTraces: AICallTrace[] = [];
  const queueTraces: QueueTrace[] = [];
  const followUpTraces: Array<{
    conversationId: string;
    tenantId: string;
    contactId: string;
  }> = [];

  const scenarios: Record<ScenarioDefinition['key'], ScenarioDefinition> = {
    mercado: {
      key: 'mercado',
      userType: 'comprador objetivo',
      needType: 'consulta de preço e estoque',
      companyType: 'mercado',
      companyName: 'Mercado Bom preço',
      inboundText: 'Quanto esta o cafe 500g?',
      phone: '5511997003001',
      businessDescription: 'Mercado de bairro com foco em conveniencia.',
      services: 'Mercearia, bebidas, limpeza e itens do dia a dia',
      expectedFragments: ['Oi!', 'Cafe torrado 500g', 'R$ 14,90', 'disponivel'],
      expectedCtaFragments: ['Se quiser', 'melhor opção'],
      expectedCommercialContext: 'inventory',
    },
    barbearia: {
      key: 'barbearia',
      userType: 'cliente consultivo',
      needType: 'descoberta de serviço',
      companyType: 'barbearia',
      companyName: 'Barbearia Prime',
      inboundText: 'Tenho um casamento no sabado, o que voce recomenda?',
      phone: '5511997003002',
      businessDescription: 'Barbearia premium com atendimento personalizado.',
      services: 'Corte masculino, barba, acabamento e combo premium',
      expectedFragments: ['Oi!', 'Combo Premium Noivo', 'casamento', 'classico ou moderno'],
      expectedCtaFragments: ['Me diz', 'classico ou moderno'],
      expectedCommercialContext: 'catalog',
    },
    clinica: {
      key: 'clinica',
      userType: 'cliente decidido',
      needType: 'fechamento de agendamento',
      companyType: 'clinica',
      companyName: 'Clinica Sorriso',
      inboundText: 'Quero marcar clareamento amanha e ja reservar minha vaga',
      phone: '5511997003003',
      businessDescription: 'Clinica odontologica com foco em estetica dental.',
      services: 'Avaliação, limpeza, clareamento e lentes de resina',
      expectedFragments: ['Oi!', 'clareamento', 'Dra. Ana', '14:00', 'reservar esse horário'],
      expectedCtaFragments: ['Se quiser', 'reservar esse horário'],
      expectedSchedulingContext: true,
    },
    petshop: {
      key: 'petshop',
      userType: 'cliente de conveniência',
      needType: 'horário de funcionamento',
      companyType: 'petshop',
      companyName: 'Pet Feliz',
      inboundText: 'Vocês abrem hoje até que horas?',
      phone: '5511997003004',
      businessDescription: 'Pet shop com banho, tosa e loja de acessórios.',
      services: 'Banho, tosa, vacinas, rações e acessórios',
      expectedFragments: ['Oi!', 'funcionamento', '08:00', '18:00'],
      expectedCtaFragments: ['Se quiser', 'melhor horário'],
    },
    curso: {
      key: 'curso',
      userType: 'lead com intenção clara de compra',
      needType: 'fechamento com pagamento',
      companyType: 'curso',
      companyName: 'Inglês de Impacto',
      inboundText: 'Quero garantir minha matrícula no intensivo de inglês hoje',
      phone: '5511997003005',
      businessDescription: 'Escola de idiomas com cursos intensivos e acompanhamento individual.',
      services: 'Matrícula, intensivo de inglês, aulas em grupo e mentoria',
      expectedFragments: ['Oi!', 'matrícula', 'intensivo de inglês'],
      expectedCtaFragments: ['concluir sua matrícula', 'https://pay.test/'],
      expectsPaymentLink: true,
    },
  };

  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => {
      const companyName = extractPromptValue(
        request.systemPrompt,
        'Company Name: ',
      );
      const businessType = extractPromptValue(
        request.systemPrompt,
        'Business Type: ',
      );
      const guardrailApplied = request.systemPrompt.includes(
        'First interaction guardrail:',
      );
      const commercialContextType = request.systemPrompt.includes(
        'Inventory context:',
      )
        ? 'inventory'
        : request.systemPrompt.includes('Catalog context:')
          ? 'catalog'
          : null;
      const schedulingContextIncluded = request.systemPrompt.includes(
        'Scheduling context:',
      );

      aiTraces.push({
        companyName,
        businessType,
        userMessage: request.userMessage,
        guardrailApplied,
        historyLength: request.contextHistory.length,
        commercialContextType,
        schedulingContextIncluded,
      });

      if (commercialContextType === 'inventory') {
        const itemName = extractPromptValue(request.systemPrompt, '- Item: ');
        const currentPrice = extractPromptValue(
          request.systemPrompt,
          '- Current price: ',
        );
        const displayPrice = currentPrice
          .replace('BRL ', 'R$ ')
          .replace('.', ',');

        return {
          text: `Oi! ${itemName} esta por ${displayPrice} e esta disponivel agora. Se quiser, eu tambem posso te sugerir a melhor opção de marca para a sua compra.`,
          tokensUsed: 45,
          confidence: 0.97,
          finishReason: 'stop',
          intent: 'QUESTION',
          sentiment: 'POSITIVE',
        };
      }

      if (schedulingContextIncluded) {
        const professionalName = extractPromptValue(
          request.systemPrompt,
          '- Professional: ',
        );
        const availableSlots = extractPromptValue(
          request.systemPrompt,
          '- Available slots: ',
        );

        return {
          text: `Oi! Para clareamento, tenho ${professionalName} com horário livre amanha as ${availableSlots.split(',')[0]?.split('-')[0]}. Se quiser, posso reservar esse horário para voce agora.`,
          tokensUsed: 57,
          confidence: 0.97,
          finishReason: 'stop',
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
        };
      }

      if (businessType === 'petshop') {
        const operatingHours = extractPromptValue(
          request.systemPrompt,
          'Operating Hours: ',
        );
        const schedule = operatingHours.includes('08:00')
          ? 'Hoje estamos operando das 08:00 às 18:00.'
          : 'Hoje estamos em horário normal de atendimento.';

        return {
          text: `Oi! ${schedule} Se quiser, eu também posso te indicar o melhor horário para banho, tosa ou retirada de produtos sem fila.`,
          tokensUsed: 38,
          confidence: 0.95,
          finishReason: 'stop',
          intent: 'QUESTION',
          sentiment: 'POSITIVE',
        };
      }

      if (businessType === 'curso') {
        return {
          text: 'Oi! A matrícula do intensivo de inglês pode ser concluída agora. Segue o link para pagamento: [PAYMENT_LINK: Matricula Intensivo de Ingles, 99.90]. Se quiser, já posso deixar sua vaga confirmada hoje.',
          tokensUsed: 52,
          confidence: 0.97,
          finishReason: 'stop',
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
        };
      }

      if (commercialContextType === 'catalog') {
        const itemName = extractPromptValue(request.systemPrompt, '- Item: ');
        return {
          text: `Oi! Para esse casamento, o ${itemName} e uma opção forte para voce chegar bem alinhado. Me diz: voce prefere algo mais classico ou moderno para eu te orientar melhor?`,
          tokensUsed: 49,
          confidence: 0.96,
          finishReason: 'stop',
          intent: 'QUESTION',
          sentiment: 'POSITIVE',
        };
      }

      return {
        text: 'Oi! Como posso te ajudar hoje?',
        tokensUsed: 20,
        confidence: 0.9,
        finishReason: 'stop',
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
      };
    }),
  };

  const mockQuotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    })),
  };

  const mockMessageQueue = {
    addJob: jest.fn(async (job) => {
      queueTraces.push({
        messageId: job.messageId,
      });
    }),
  };

  const mockFollowUpService = {
    cancelFollowUps: jest.fn(async () => { }),
    scheduleFollowUps: jest.fn(
      async (conversationId: string, tenantId: string, contactId: string) => {
        followUpTraces.push({
          conversationId,
          tenantId,
          contactId,
        });
      },
    ),
  };

  const mockPaymentGateway: IPaymentGateway = {
    createCustomer: jest.fn(),
    getCustomer: jest.fn(),
    createSubaccount: jest.fn(),
    listSubaccounts: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    getSubscription: jest.fn(),
    createPayment: jest.fn(),
    deletePayment: jest.fn(),
    restorePayment: jest.fn(),
    createPaymentLink: jest.fn(async ({ name }) => ({
      id: `plink-${name.toLowerCase().replace(/\s+/g, '-')}`,
      url: 'https://pay.test/clareamento-dental',
    })),
    removePaymentLink: jest.fn(),
    restorePaymentLink: jest.fn(),
    parseWebhook: jest.fn(() => null),
  };

  const subscribedHandlers = new Map<
    string,
    Array<(event: Record<string, unknown>) => Promise<void>>
  >();

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const handlers = subscribedHandlers.get(event.queue) || [];
      const serialized = event.toJSON() as Record<string, any>;

      eventTraces.push({
        queue: event.queue,
        eventName: serialized.eventName,
        payload: serialized.payload || serialized,
        handlerCount: handlers.length,
      });

      for (const handler of handlers) {
        await handler(serialized);
      }
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

  function extractPromptValue(prompt: string, prefix: string): string {
    const line = prompt
      .split('\n')
      .find((currentLine) => currentLine.startsWith(prefix));

    return line ? line.slice(prefix.length).trim() : '';
  }

  function makeValidCnpj(seed: number): string {
    const base = String(seed).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce(
          (acc, digit, index) => acc + Number(digit) * weights[index],
          0,
        );
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

  async function createScenarioTenant(
    scenario: ScenarioDefinition,
    index: number,
  ): Promise<void> {
    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    const updateBusiness = app.get<IUpdateBusinessDataUseCase>(
      IUpdateBusinessDataUseCase,
    );

    const tenant = await createTenant.execute({
      companyName: scenario.companyName,
      cnpj: makeValidCnpj(Date.now() + index),
      ownerName: `${scenario.companyType} owner`,
      ownerEmail: `${scenario.companyType}-${Date.now()}-${index}@test.com`,
      ownerPhone: `11955554${String(index).padStart(3, '0')}`,
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });

    createdTenantIds.push(tenant.id);
    scenario.tenantId = tenant.id;
    scenario.whatsappNumber = `55219988${String(Date.now() + index).slice(-6)}`;

    await configureAI.execute({
      tenantId: tenant.id,
      systemPrompt: 'Voce e uma assistente comercial consultiva.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 400,
      confidenceThreshold: 0.7,
      businessRules: ['Descobrir a necessidade antes de ofertar'],
    });

    await updateBusiness.execute({
      tenantId: tenant.id,
      businessType: scenario.companyType,
      description: scenario.businessDescription,
      services: scenario.services,
      catalogUrl: `https://${scenario.companyType}.test/catalogo`,
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
      },
    });

    const savedTenant = await tenantRepository.findById(tenant.id);
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: `bw-${scenario.companyType}-${index}`,
        token: `tenant-token-${scenario.companyType}-${index}`,
        apiUrl: `https://bw-${scenario.companyType}-${index}.bubblewhats.com`,
      },
      whatsappNumber: scenario.whatsappNumber,
      webhookSecret: null,
    });

    whatsAppConfig.activate();
    savedTenant!.configureWhatsApp(whatsAppConfig);
    await tenantRepository.save(savedTenant!);

    await seedScenarioData(scenario);
  }

  async function seedScenarioData(scenario: ScenarioDefinition) {
    if (scenario.key === 'mercado') {
      const createCategoryUseCase = app.get(CreateCatalogCategoryUseCase);
      const createItemUseCase = app.get(CreateCatalogItemUseCase);
      const syncInventoryItemUseCase = app.get(SyncInventoryItemUseCase);

      const category = await createCategoryUseCase.execute({
        tenantId: scenario.tenantId!,
        name: 'Mercearia',
      });

      const item = await createItemUseCase.execute({
        tenantId: scenario.tenantId!,
        categoryId: category.id,
        type: 'PRODUCT',
        name: 'Cafe torrado 500g',
        description: 'Cafe tradicional para o dia a dia',
        basePrice: '13.90',
        tags: ['cafe', 'mercado', '500g'],
      });

      await syncInventoryItemUseCase.execute({
        tenantId: scenario.tenantId!,
        catalogItemId: item.id,
        sku: 'CAFE-500',
        externalReference: 'ERP-CAFE-500',
        name: 'Cafe torrado 500g',
        availableQuantity: 12,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '14.90',
        source: 'MANUAL_SNAPSHOT',
      });
    }

    if (scenario.key === 'barbearia') {
      const createCategoryUseCase = app.get(CreateCatalogCategoryUseCase);
      const createItemUseCase = app.get(CreateCatalogItemUseCase);

      const category = await createCategoryUseCase.execute({
        tenantId: scenario.tenantId!,
        name: 'Combos',
      });

      await createItemUseCase.execute({
        tenantId: scenario.tenantId!,
        categoryId: category.id,
        type: 'SERVICE',
        name: 'Combo Premium Noivo',
        description: 'Corte, barba e acabamento para eventos especiais',
        basePrice: '180.00',
        tags: ['casamento', 'noivo', 'premium', 'barbearia'],
      });
    }

    if (scenario.key === 'clinica') {
      await seedSchedulingForClinicScenario(scenario.tenantId!);
    }
  }

  async function seedSchedulingForClinicScenario(tenantId: string) {
    const createCategoryUseCase = app.get(CreateSchedulingCategoryUseCase);
    const createProfessionalUseCase = app.get(
      CreateSchedulingProfessionalUseCase,
    );
    const assignProfessionalCategoriesUseCase = app.get(
      AssignProfessionalCategoriesUseCase,
    );
    const setProfessionalAvailabilityUseCase = app.get(
      SetProfessionalAvailabilityUseCase,
    );
    const tomorrow = getTomorrowDate();

    const category = await createCategoryUseCase.execute({
      tenantId,
      name: 'Clareamento',
      unit: 'PER_SESSION',
      durationMinutes: 60,
    });

    const professional = await createProfessionalUseCase.execute({
      tenantId,
      name: 'Dra. Ana',
      role: 'dentista',
    });

    await assignProfessionalCategoriesUseCase.execute({
      tenantId,
      professionalId: professional.id,
      categoryIds: [category.id],
    });

    await setProfessionalAvailabilityUseCase.execute({
      tenantId,
      professionalId: professional.id,
      date: tomorrow,
      slots: [
        {
          startsAt: '14:00',
          endsAt: '15:00',
          label: 'Clareamento',
        },
      ],
    });
  }

  function getTomorrowDate(): string {
    const currentDate = new Date();
    const tomorrow = new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() + 1,
      ),
    );

    return tomorrow.toISOString().slice(0, 10);
  }

  async function waitForConversation(tenantId: string, phone: string) {
    for (let i = 0; i < 20; i++) {
      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId, phone },
      });

      if (contact) {
        const conversation = await (prisma.conversation as any).findFirst({
          where: { tenantId, contactId: contact.id },
        });

        if (conversation) {
          return { contact, conversation };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return null;
  }

  async function waitForMessages(
    conversationId: string,
    predicate: (messages: any[]) => boolean,
  ) {
    for (let i = 0; i < 30; i++) {
      const messages = await (prisma.message as any).findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      if (predicate(messages)) {
        return messages;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return null;
  }

  async function sendInbound(
    whatsappNumber: string,
    phone: string,
    text: string,
    externalId: string,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({
        id: externalId,
        fromNumber: phone,
        toNumber: whatsappNumber,
        body: text,
        messageContext: {
          key: {
            fromMe: false,
            id: externalId,
          },
          message: {
            extendedTextMessage: {
              text,
            },
          },
        },
      })
      .expect(200);
  }

  function renderScenarioLog(input: {
    scenario: ScenarioDefinition;
    result: ScenarioResult;
  }): string {
    return [
      `=== ${input.scenario.companyName} | ${input.scenario.companyType} ===`,
      `usuario: ${input.scenario.userType}`,
      `necessidade: ${input.scenario.needType}`,
      `webhook: ${input.result.webhookStatus} OK`,
      `contactId: ${input.result.contactId}`,
      `conversationId: ${input.result.conversationId}`,
      `mensagem inbound: ${input.scenario.inboundText}`,
      `guardrail primeira interação: ${input.result.aiTrace.guardrailApplied ? 'sim' : 'não'}`,
      `contexto comercial no prompt: ${input.result.aiTrace.commercialContextType || 'não'}`,
      `contexto de agenda no prompt: ${input.result.aiTrace.schedulingContextIncluded ? 'sim' : 'não'}`,
      `historico enviado para IA: ${input.result.aiTrace.historyLength} mensagens`,
      `eventos publicados: ${input.result.eventQueues.join(' -> ')}`,
      `jobs outbound enfileirados: ${input.result.queuedCount}`,
      `follow-ups agendados: ${input.result.followUpCount}`,
      `mensagem outbound: ${input.result.outboundText}`,
    ].join('\n');
  }

  async function executeScenario(
    scenario: ScenarioDefinition,
  ): Promise<ScenarioResult> {
    const eventStartIndex = eventTraces.length;
    const aiStartIndex = aiTraces.length;
    const queueStartIndex = queueTraces.length;
    const followUpStartIndex = followUpTraces.length;

    const webhookResponse = await sendInbound(
      scenario.whatsappNumber!,
      scenario.phone,
      scenario.inboundText,
      `${scenario.key}-${Date.now()}`,
    );

    const persisted = await waitForConversation(scenario.tenantId!, scenario.phone);

    expect(persisted).not.toBeNull();

    const messages = await waitForMessages(
      persisted!.conversation.id,
      (currentMessages) =>
        currentMessages.some(
          (message) =>
            message.direction === 'OUTBOUND' && message.sentBy === 'AI',
        ),
    );

    expect(messages).not.toBeNull();

    const outboundMessage = messages!.find(
      (message: any) =>
        message.direction === 'OUTBOUND' && message.sentBy === 'AI',
    );
    const outboundText = outboundMessage?.content?.text || '';

    for (const expectedFragment of scenario.expectedFragments) {
      expect(outboundText).toContain(expectedFragment);
    }

    expect(outboundText).not.toContain('Company Name:');
    expect(outboundText).not.toContain('Operating Hours:');
    expect(outboundText).not.toContain('Location:');

    const aiTrace = aiTraces[aiStartIndex];
    expect(aiTrace).toBeDefined();
    expect(aiTrace.companyName).toBe(scenario.companyName);
    expect(aiTrace.guardrailApplied).toBe(true);
    expect(aiTrace.historyLength).toBe(0);

    if (scenario.expectedCommercialContext) {
      expect(aiTrace.commercialContextType).toBe(
        scenario.expectedCommercialContext,
      );
    } else {
      expect(aiTrace.commercialContextType).toBeNull();
    }

    if (scenario.expectedSchedulingContext) {
      expect(aiTrace.schedulingContextIncluded).toBe(true);
    } else {
      expect(aiTrace.schedulingContextIncluded).toBe(false);
    }

    for (const expectedCtaFragment of scenario.expectedCtaFragments) {
      expect(outboundText).toContain(expectedCtaFragment);
    }

    if (scenario.expectsPaymentLink) {
      expect(outboundText).toContain('https://pay.test/');
      expect(outboundText).not.toContain('[PAYMENT_LINK:');
    }

    const scenarioEvents = eventTraces.slice(eventStartIndex);
    const scenarioQueues = scenarioEvents.map((entry) => entry.queue);

    expect(scenarioQueues).toContain('messaging.message-received');
    expect(scenarioQueues).toContain('ai.response-generated');

    const queuedOutboundJobs = queueTraces.slice(queueStartIndex);
    expect(queuedOutboundJobs.length).toBeGreaterThanOrEqual(1);

    const scheduledFollowUps = followUpTraces.slice(followUpStartIndex);
    expect(scheduledFollowUps.length).toBeGreaterThanOrEqual(1);

    return {
      webhookStatus: webhookResponse.status,
      contactId: persisted!.contact.id,
      conversationId: persisted!.conversation.id,
      outboundText,
      aiTrace,
      eventQueues: scenarioQueues,
      queuedCount: queuedOutboundJobs.length,
      followUpCount: scheduledFollowUps.length,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .overrideProvider(AI_ENGINE)
      .useValue(mockAiEngine)
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(mockQuotaUseCase)
      .overrideProvider(MESSAGE_QUEUE)
      .useValue(mockMessageQueue)
      .overrideProvider(FollowUpService)
      .useValue(mockFollowUpService)
      .overrideProvider(IPAYMENT_GATEWAY)
      .useValue(mockPaymentGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    const scenarioList = Object.values(scenarios);
    for (const [index, scenario] of scenarioList.entries()) {
      await createScenarioTenant(scenario, index + 1);
    }
  });

  beforeEach(() => {
    eventTraces.length = 0;
    aiTraces.length = 0;
    queueTraces.length = 0;
    followUpTraces.length = 0;
  });

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      const schedulingKeys = await redis.keys(`scheduling:tenant:${tenantId}:*`);
      if (schedulingKeys.length > 0) {
        await redis.del(...schedulingKeys).catch(() => { });
      }
      await prisma
        .$executeRaw(Prisma.sql(
          'DELETE FROM inventory_schema.inventory_items WHERE tenant_id = $1::uuid',
          tenantId,
        )
          .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql(
          'DELETE FROM catalog_schema.catalog_items WHERE tenant_id = $1::uuid',
          tenantId,
        )
          .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql(
          'DELETE FROM catalog_schema.catalog_categories WHERE tenant_id = $1::uuid',
          tenantId,
        )
          .catch(() => { });
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => { });
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.salesMetric as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.usageRecord as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.aIConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.whatsAppConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.user as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.tenant as any)
        .delete({ where: { id: tenantId } })
        .catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should handle a retail inventory-based WhatsApp flow for mercado', async () => {
    const scenario = scenarios.mercado;
    const result = await executeScenario(scenario);
    console.log('\n' + renderScenarioLog({ scenario, result }));
  });

  it('should handle a catalog-driven advisory WhatsApp flow for barbearia', async () => {
    const scenario = scenarios.barbearia;
    const result = await executeScenario(scenario);
    console.log('\n' + renderScenarioLog({ scenario, result }));
  });

  it('should handle a scheduling-driven WhatsApp flow for clinica', async () => {
    const scenario = scenarios.clinica;
    const result = await executeScenario(scenario);
    console.log('\n' + renderScenarioLog({ scenario, result }));
  });

  it('should handle an operating-hours WhatsApp flow for petshop', async () => {
    const scenario = scenarios.petshop;
    const result = await executeScenario(scenario);
    console.log('\n' + renderScenarioLog({ scenario, result }));
  });

  it('should handle a payment-link WhatsApp flow for curso', async () => {
    const scenario = scenarios.curso;
    const result = await executeScenario(scenario);
    console.log('\n' + renderScenarioLog({ scenario, result }));
  });
});
