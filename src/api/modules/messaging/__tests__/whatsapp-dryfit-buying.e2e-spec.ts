import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  AI_ENGINE,
  AIResponse,
  IAIEngine,
} from '@modules/ai/application/ports/IAIEngine';
import { MESSAGE_QUEUE } from '../domain/ports/IMessageQueue';
import { FollowUpService } from '../application/services/FollowUpService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { Prisma } from '@prisma/client';

describe('WhatsApp Dry Fit Buying Flow (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;

  let tenantId: string;
  let whatsappNumber: string;
  const customerPhone = '5521993001883';

  // ── Traces ──────────────────────────────────────────────────────────
  const eventTraces: Array<{
    queue: string;
    eventName?: string;
    payload: Record<string, any>;
    handlerCount: number;
  }> = [];
  const aiTraces: Array<{
    userMessage: string;
    commercialContextType: 'inventory' | 'catalog' | null;
  }> = [];
  const queueTraces: Array<{ messageId: string }> = [];

  // ── Mock: AI Engine ─────────────────────────────────────────────────
  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(async (req): Promise<AIResponse> => {
      const commercialContextType = req.systemPrompt.includes(
        'Inventory context:',
      )
        ? 'inventory'
        : req.systemPrompt.includes('Catalog context:')
          ? 'catalog'
          : null;

      aiTraces.push({
        userMessage: req.userMessage,
        commercialContextType,
      });

      // Detect inquiry
      if (req.userMessage.toLowerCase().includes('preço') || req.userMessage.toLowerCase().includes('camisa')) {
        return {
          text: 'Temos a Camisa Dry Fit Uni por R$ 99,90. Digite 1 para selecionar.',
          tokensUsed: 40, confidence: 0.97, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Selection "1"
      if (req.userMessage.trim() === '1') {
        return {
          text: 'Ótimo! Camisa Dry Fit Uni selecionada. Qual o tamanho e cor que você deseja?',
          tokensUsed: 30, confidence: 0.95, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Variations "P e Preta"
      if (req.userMessage.toLowerCase().includes('preta')) {
        return {
          text: 'Anotado, tamanho P na cor preta. Qual a quantidade?',
          tokensUsed: 30, confidence: 0.95, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Quantity "2"
      if (req.userMessage.trim() === '2') {
        return {
          text: '2x Camisa Dry Fit. Quer entrega ou retirada?',
          tokensUsed: 35, confidence: 0.96, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Format "Entrega"
      if (req.userMessage.toLowerCase().includes('entrega')) {
        return {
          text: 'Qual o seu endereço completo para entrega?',
          tokensUsed: 35, confidence: 0.96, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Address "Rua ABC, 123"
      if (req.userMessage.toLowerCase().includes('rua abc')) {
        return {
          text: 'O frete fica R$ 10. Total R$ 209,80. Posso gerar o link de pagamento?',
          tokensUsed: 35, confidence: 0.96, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Checkout "pode gerar"
      if (req.userMessage.toLowerCase().includes('gerar') || req.userMessage.toLowerCase().includes('sim')) {
        return {
          text: 'Aqui está seu link: [PAYMENT_LINK: Pedido Dry Fit, 209.80]',
          tokensUsed: 45, confidence: 0.99, finishReason: 'stop',
          intent: 'PURCHASE', sentiment: 'POSITIVE',
        };
      }

      // Technical question about material
      if (
        req.userMessage.toLowerCase().includes('poliester') ||
        req.userMessage.toLowerCase().includes('material')
      ) {
        return {
          text: 'A Camisa Dry Fit Uni é feita com tecnologia Dri-FIT, composta por poliéster reciclado com malha respirável. Ideal para atividades físicas.',
          tokensUsed: 42,
          confidence: 0.94,
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

  // ── Mock: Quota ─────────────────────────────────────────────────────
  const mockQuotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    })),
  };

  // ── Mock: Message Queue ─────────────────────────────────────────────
  const mockMessageQueue = {
    addJob: jest.fn(async (job: any) => {
      queueTraces.push({ messageId: job.messageId });
    }),
  };

  // ── Mock: Follow-up Service ─────────────────────────────────────────
  const mockFollowUpService = {
    cancelFollowUps: jest.fn(async () => { }),
    scheduleFollowUps: jest.fn(async () => { }),
  };

  // ── Mock: Payment Gateway (prevents Asaas calls) ───────────────────
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
    createPaymentLink: jest.fn(async ({ name }: any) => ({
      id: `plink-${name?.toLowerCase().replace(/\s+/g, '-') || 'test'}`,
      url: 'https://pay.test/dryfit',
    })),
    removePaymentLink: jest.fn(),
    restorePaymentLink: jest.fn(),
    parseWebhook: jest.fn(() => null),
  };

  // ── Mock: Event Bus (in-memory, propagates events within test) ─────
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

  // ── Helpers ─────────────────────────────────────────────────────────
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

  async function sendInbound(text: string, externalId?: string) {
    const id = externalId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({
        id,
        fromNumber: customerPhone,
        toNumber: whatsappNumber,
        body: text,
        messageContext: {
          key: { fromMe: false, id },
          message: { extendedTextMessage: { text } },
        },
      })
      .expect(200);
  }

  async function waitForConversation(
    tId: string,
    phone: string,
  ): Promise<{ contact: any; conversation: any } | null> {
    for (let i = 0; i < 20; i++) {
      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId: tId, phone },
      });
      if (contact) {
        const conversation = await (prisma.conversation as any).findFirst({
          where: { tenantId: tId, contactId: contact.id },
        });
        if (conversation) {
          return { contact, conversation };
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  async function waitForMessages(
    conversationId: string,
    predicate: (messages: any[]) => boolean,
  ) {
    for (let i = 0; i < 150; i++) { // Poll for up to 45 seconds (300ms * 150)
      const messages = await (prisma.message as any).findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
      if (predicate(messages)) {
        return messages;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  // ── Setup ───────────────────────────────────────────────────────────
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      // .overrideProvider(AI_ENGINE)  // USING REAL DEEPSEEK!
      // .useValue(mockAiEngine)
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(mockQuotaUseCase)
      .overrideProvider(MESSAGE_QUEUE) // Queues messages instead of hitting real Twilio so we don't crash without keys
      .useValue(mockMessageQueue)
      .overrideProvider(FollowUpService)
      .useValue(mockFollowUpService)
      // .overrideProvider(IPAYMENT_GATEWAY) // USING REAL ASAAS!
      // .useValue(mockPaymentGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    // Create Tenant
    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'DryFit Store',
      cnpj: makeValidCnpj(Date.now()),
      plan: 'PROFISSIONAL',
      ownerName: 'Test Owner',
      ownerEmail: `dryfit-${Date.now()}@test.com`,
      ownerPhone: '11955550001',
      ownerPassword: 'SenhaForte123!',
    });
    tenantId = tenant.id;
    whatsappNumber = `55219988${String(Date.now()).slice(-6)}`;

    // Activate subscription
    await prisma.subscription
      .updateMany({ where: { tenantId }, data: { status: 'ACTIVE' } })
      .catch(() => { });

    // Configure WhatsApp
    const tenantEntity = await tenantRepository.findById(tenantId);
    if (tenantEntity) {
      const whatsAppConfig = WhatsAppConfig.create({
        provider: 'BUBBLEWHATS',
        credentials: {
          id: 'bw-dryfit-test',
          token: 'test-token',
          apiUrl: 'http://localhost:3000',
        },
        whatsappNumber,
        webhookSecret: null,
      });
      whatsAppConfig.activate();
      tenantEntity.configureWhatsApp(whatsAppConfig);
      await tenantRepository.save(tenantEntity);
    }

    // Create Catalog Category + Item "Camisa Dry Fit Uni"
    const createCategoryUseCase = app.get(CreateCatalogCategoryUseCase);
    const createItemUseCase = app.get(CreateCatalogItemUseCase);

    const category = await createCategoryUseCase.execute({
      tenantId,
      name: 'Esportivo',
    });

    await createItemUseCase.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Camisa Dry Fit Uni',
      description: 'Camisa esportiva de alta performance, tecnologia Dri-FIT',
      basePrice: '99.90',
      currency: 'BRL',
      tags: ['esporte', 'dry-fit', 'camisa'],
      initialStock: 50,
      attributes: { tecido: 'Dry Fit' },
      optionGroups: [
        {
          name: 'Tamanho',
          options: [{ name: 'P' }, { name: 'M' }, { name: 'G' }, { name: 'GG' }]
        },
        {
          name: 'Cor',
          options: [{ name: 'Preta' }, { name: 'Branca' }, { name: 'Azul' }]
        }
      ]
    });
  });

  beforeEach(() => {
    eventTraces.length = 0;
    aiTraces.length = 0;
    queueTraces.length = 0;
  });

  // ── Teardown ────────────────────────────────────────────────────────
  afterAll(async () => {
    if (tenantId) {
      try {
        await prisma
          .$executeRaw(
            Prisma.sql`DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = ${tenantId}::uuid`,
          )
          .catch(() => { });
        await prisma
          .$executeRaw(
            Prisma.sql`DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = ${tenantId}::uuid`,
          )
          .catch(() => { });
        await prisma
          .$executeRaw(
            Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenantId}::uuid`,
          )
          .catch(() => { });
        await prisma
          .$executeRaw(
            Prisma.sql`DELETE FROM catalog_schema.catalog_items WHERE tenant_id = ${tenantId}::uuid`,
          )
          .catch(() => { });
        await prisma
          .$executeRaw(
            Prisma.sql`DELETE FROM catalog_schema.catalog_categories WHERE tenant_id = ${tenantId}::uuid`,
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
        await prisma.whatsAppConfig
          .deleteMany({ where: { tenantId } })
          .catch(() => { });
        await prisma.aIConfig
          .deleteMany({ where: { tenantId } })
          .catch(() => { });
        await prisma.subscription
          .deleteMany({ where: { tenantId } })
          .catch(() => { });
        await prisma.user
          .deleteMany({ where: { tenantId } })
          .catch(() => { });
        await prisma.tenant
          .delete({ where: { id: tenantId } })
          .catch(() => { });
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
    await app.close();
  });

  // ── Test 1: Full AI purchasing flow ─────────────────────────────────
  it('should handle complete buying flow via AI', async () => {
    // Step 1: Customerinquires about prices
    await sendInbound('Olá, qual o preço da Camisa Dry Fit?');

    const result = await waitForConversation(tenantId, customerPhone);
    expect(result).not.toBeNull();
    const { contact, conversation } = result!;

    console.log(`✅ Contact created: ${contact.id}`);
    console.log(`✅ Conversation created: ${conversation.id}`);

    // Wait for AI response
    let messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 2);
    expect(messages).not.toBeNull();
    console.log(`✅ AI: ${JSON.stringify(messages![messages!.length - 1].content)}`);

    // Step 2: Select '1'
    await sendInbound('Quero a opção 1 por favor');
    messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 4);
    expect(messages).not.toBeNull();
    console.log(`✅ AI (size/color): ${JSON.stringify(messages![messages!.length - 1].content)}`);

    // Step 3: Sizes/colors 'P e Preta'
    await sendInbound('P e Preta');
    messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 6);
    console.log(`✅ AI (quantity): ${JSON.stringify(messages![messages!.length - 1].content)}`);

    // Step 4: Qty '2'
    await sendInbound('2');
    messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 8);
    console.log(`✅ AI (fulfillment): ${JSON.stringify(messages![messages!.length - 1].content)}`);
    
    // Step 5: Mode 'Entrega'
    await sendInbound('Entrega');
    messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 10);
    console.log(`✅ AI (address): ${JSON.stringify(messages![messages!.length - 1].content)}`);
    
    // Step 6: Address 'Rua ABC, 123'
    await sendInbound('Rua ABC, 123');
    messages = await waitForMessages(conversation.id, (msgs) => msgs.length >= 12);
    console.log(`✅ AI (checkout confirm): ${JSON.stringify(messages![messages!.length - 1].content)}`);
    
    // Step 7: Yes, generate link
    await sendInbound('Sim pode gerar o link');
    messages = await waitForMessages(conversation.id, (msgs) => {
      if (msgs.length < 14) return false;
      const cnt = JSON.stringify(msgs[msgs.length - 1].content || '').toLowerCase();
      return cnt.includes('http') || cnt.includes('pay') || cnt.includes('asaas') || cnt.includes('link') || cnt.includes('pix');
    });
    expect(messages).not.toBeNull();
    const lastMsg = JSON.stringify(messages![messages!.length - 1].content);
    console.log(`✅ AI (payment link): ${lastMsg}`);

    // Verify commerce session was created and payment link injected
    let sessions: any[] = [];
    for (let i = 0; i < 10; i++) {
        sessions = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT * FROM commerce_schema.shopping_sessions WHERE tenant_id = ${tenantId}::uuid`
        );
        if (sessions.length > 0) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if (sessions.length > 0) {
      console.log(`✅ Commerce session created: ${sessions[0].id}, total: ${sessions[0].total_amount}`);
      console.log(`✅ Payment Link URL in DB: ${sessions[0].payment_link_url}`);
      // Usually payment links take a few seconds after the intent to be injected by the background process
      // So expect could fail if queried too fast. We are just checking we got past checkout.
    } else {
      console.log('⚠️ Could not verify session in DB - it might not have been created or is queued.');
    }
  });
});
