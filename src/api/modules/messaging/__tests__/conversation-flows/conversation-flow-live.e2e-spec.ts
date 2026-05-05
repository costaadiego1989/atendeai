import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
const request = require('supertest');

import { AppModule } from '../../../../app.module';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { ConfigureShippingPolicyUseCase } from '@modules/commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import { DetectAbandonedShoppingSessionsUseCase } from '@modules/commerce/application/use-cases/DetectAbandonedShoppingSessionsUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { MESSAGE_QUEUE } from '@modules/messaging/domain/ports/IMessageQueue';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import { CreateCouponUseCase } from '@modules/sales/application/use-cases/CreateCouponUseCase';
import { AssignProfessionalCategoriesUseCase } from '@modules/scheduling/application/use-cases/AssignProfessionalCategoriesUseCase';
import { CreateSchedulingCategoryUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingCategoryUseCase';
import { CreateSchedulingProfessionalUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingProfessionalUseCase';
import { SetProfessionalAvailabilityUseCase } from '@modules/scheduling/application/use-cases/SetProfessionalAvailabilityUseCase';
import { IUpdateBusinessDataUseCase } from '@modules/tenant/application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

import {
  ConversationFlowNiche,
  ConversationFlowScenario,
  conversationFlowNiches,
} from './conversation-flow-scenarios';

const describeLive =
  process.env.RUN_REAL_CONVERSATION_FLOW_E2E === 'true'
    ? describe
    : describe.skip;

const LIVE_TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '3251266a-e4e1-4f12-80ae-81314f0b2b9a';

type TenantSnapshot = {
  businessType: string | null;
  description: string | null;
  services: string | null;
  catalogUrl: string | null;
  operatingHours: Prisma.JsonValue | null;
};

type WhatsAppSnapshot = {
  id: string;
  provider: string;
  credentials: Prisma.JsonValue;
  whatsappNumber: string;
  webhookSecret: string | null;
  status: string;
} | null;

describeLive('Messaging live conversation flows by niche (e2e)', () => {
  jest.setTimeout(360000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantSnapshot: TenantSnapshot;
  let whatsAppSnapshot: WhatsAppSnapshot;
  let couponCode: string;

  const eventTraces: Array<{
    queue: string;
    eventName?: string;
    payload: Record<string, any>;
    handlerCount: number;
  }> = [];
  const queueTraces: Array<{ messageId?: string; payload: any }> = [];
  const followUpTraces: Array<{ conversationId: string }> = [];

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
      const serialized = event.toJSON() as Record<string, any>;

      eventTraces.push({
        queue: event.queue,
        eventName: serialized.eventName,
        payload: serialized.payload || serialized,
        handlerCount: handlers.length,
      });

      for (const handler of handlers) {
        await handler.handle(serialized);
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
        handle: handler as unknown as (
          event: Record<string, unknown>,
        ) => Promise<void>,
      });
      subscribedHandlers.set(queue, handlers);
    },
  };

  const quotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 100000,
      status: 'ACTIVE',
    })),
  };

  const messageQueue = {
    addJob: jest.fn(async (job: any) => {
      queueTraces.push({ messageId: job.messageId, payload: job });
    }),
  };

  const followUpService = {
    cancelFollowUps: jest.fn(async () => {}),
    scheduleFollowUps: jest.fn(async (conversationId: string) => {
      followUpTraces.push({ conversationId });
    }),
  };

  const paymentGateway: IPaymentGateway = {
    createCustomer: jest.fn(async (data: any) => ({
      id: `cus-${Date.now()}`,
      name: data.name,
    })),
    getCustomer: jest.fn(async (id: string) => ({ id, name: 'Cliente E2E' })),
    createSubaccount: jest.fn(async () => ({
      id: 'sub-live-flow-test',
      walletId: 'wallet-live-flow-test',
    })),
    listSubaccounts: jest.fn(async () => []),
    createSubscription: jest.fn(async () => ({
      id: 'subscr-live-flow-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    updateSubscription: jest.fn(async () => ({
      id: 'subscr-live-flow-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    cancelSubscription: jest.fn(async () => ({
      id: 'subscr-live-flow-test',
      status: 'CANCELLED',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    getSubscription: jest.fn(async () => ({
      id: 'subscr-live-flow-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    createPayment: jest.fn(async (data: any) => ({
      id: `pay-${Date.now()}`,
      status: 'PENDING',
      value: data.value,
      billingType: data.billingType,
      dueDate: data.dueDate,
      invoiceUrl: 'https://pay.test/live-flow',
      externalReference: data.externalReference,
    })),
    deletePayment: jest.fn(async (id: string) => ({ id, status: 'DELETED' })),
    restorePayment: jest.fn(async (id: string) => ({ id, status: 'ACTIVE' })),
    createPaymentLink: jest.fn(async ({ name }: any) => ({
      id: `plink-${Date.now()}`,
      url: `https://pay.test/${slugify(name || 'pedido')}`,
    })),
    removePaymentLink: jest.fn(async (id: string) => ({ id, status: 'DELETED' })),
    restorePaymentLink: jest.fn(async (id: string) => ({
      id,
      status: 'ACTIVE',
    })),
    parseWebhook: jest.fn(() => null),
  };

  beforeAll(async () => {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        'RUN_REAL_CONVERSATION_FLOW_E2E=true requires DEEPSEEK_API_KEY. The AI engine is intentionally not mocked.',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(quotaUseCase)
      .overrideProvider(MESSAGE_QUEUE)
      .useValue(messageQueue)
      .overrideProvider(FollowUpService)
      .useValue(followUpService)
      .overrideProvider(IPAYMENT_GATEWAY)
      .useValue(paymentGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const tenant = await prisma.tenant.findUnique({
      where: { id: LIVE_TENANT_ID },
    });

    if (!tenant) {
      throw new Error(`Tenant ${LIVE_TENANT_ID} was not found.`);
    }

    tenantSnapshot = {
      businessType: tenant.businessType,
      description: tenant.description,
      services: tenant.services,
      catalogUrl: tenant.catalogUrl,
      operatingHours: tenant.operatingHours,
    };

    const existingWhatsApp = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: LIVE_TENANT_ID },
    });
    whatsAppSnapshot = existingWhatsApp
      ? {
          id: existingWhatsApp.id,
          provider: existingWhatsApp.provider,
          credentials: existingWhatsApp.credentials,
          whatsappNumber: existingWhatsApp.whatsappNumber,
          webhookSecret: existingWhatsApp.webhookSecret,
          status: existingWhatsApp.status,
        }
      : null;

    await ensureBillingReady();
    await ensureWhatsAppReady();
    couponCode = await seedCoupon();
    await seedCommerceFixtures();
    await seedSchedulingFixtures();
  });

  afterAll(async () => {
    if (prisma && tenantSnapshot) {
      await prisma.tenant
        .update({
          where: { id: LIVE_TENANT_ID },
          data: tenantSnapshot as any,
        })
        .catch(() => {});
    }

    if (prisma) {
      if (whatsAppSnapshot) {
        await prisma.whatsAppConfig
          .upsert({
            where: { tenantId: LIVE_TENANT_ID },
            create: {
              tenantId: LIVE_TENANT_ID,
              provider: whatsAppSnapshot.provider,
              credentials: whatsAppSnapshot.credentials as any,
              whatsappNumber: whatsAppSnapshot.whatsappNumber,
              webhookSecret: whatsAppSnapshot.webhookSecret,
              status: whatsAppSnapshot.status,
            },
            update: {
              provider: whatsAppSnapshot.provider,
              credentials: whatsAppSnapshot.credentials as any,
              whatsappNumber: whatsAppSnapshot.whatsappNumber,
              webhookSecret: whatsAppSnapshot.webhookSecret,
              status: whatsAppSnapshot.status,
            },
          })
          .catch(() => {});
      } else {
        await prisma.whatsAppConfig
          .delete({ where: { tenantId: LIVE_TENANT_ID } })
          .catch(() => {});
      }
    }

    if (app) {
      await app.close();
    }
  });

  for (const niche of selectNiches()) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      for (const scenario of niche.scenarios) {
        it(scenario.title, async () => {
          await updateBusinessForNiche(niche);

          const phone = makePhone(niche, scenario);
          const startQueueIndex = queueTraces.length;

          for (const [index, turn] of scenario.turns.entries()) {
            await sendInbound(phone, renderTurn(turn), `${phone}-${index}`);
            const persisted = await waitForConversation(phone);
            expect(persisted).not.toBeNull();

            await waitForMessages(
              persisted!.conversation.id,
              (messages) =>
                messages.filter(
                  (message) =>
                    message.direction === 'OUTBOUND' &&
                    message.sentBy === 'AI',
                ).length >=
                index + 1,
            );
          }

          const persisted = await waitForConversation(phone);
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

          const outboundText = messages!
            .filter(
              (message) =>
                message.direction === 'OUTBOUND' && message.sentBy === 'AI',
            )
            .map((message) => readMessageText(message.content))
            .join('\n');

          expectHealthyLiveAiResponse(outboundText, scenario);
          await assertScenarioPersistence(scenario, persisted!.conversation.id);

          expect(queueTraces.length).toBeGreaterThan(startQueueIndex);
        });
      }
    });
  }

  async function ensureBillingReady() {
    await prisma.subscription.upsert({
      where: { tenantId: LIVE_TENANT_ID },
      create: {
        tenantId: LIVE_TENANT_ID,
        plan: 'ESSENCIAL',
        status: 'ACTIVE',
        messagesQuota: 100000,
        aiTokensQuota: 5000000,
        contactsQuota: 100000,
        billingCycleStart: new Date('2026-04-01T00:00:00.000Z'),
        billingCycleEnd: new Date('2026-05-01T00:00:00.000Z'),
      },
      update: {
        status: 'ACTIVE',
        messagesQuota: 100000,
        aiTokensQuota: 5000000,
        contactsQuota: 100000,
        billingCycleEnd: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
  }

  async function ensureWhatsAppReady() {
    const existing = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: LIVE_TENANT_ID },
    });

    if (existing) {
      return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const senderId =
      process.env.TWILIO_WHATSAPP_SENDER ||
      process.env.TWILIO_WHATSAPP_FROM ||
      'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      throw new Error(
        'Tenant has no WhatsApp config. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to create a live webhook config for this test.',
      );
    }

    await prisma.whatsAppConfig.create({
      data: {
        tenantId: LIVE_TENANT_ID,
        provider: 'TWILIO',
        credentials: {
          accountSid,
          authToken,
          senderId,
        },
        whatsappNumber: senderId.replace(/\D/g, ''),
        webhookSecret: null,
        status: 'ACTIVE',
      },
    });
  }

  async function seedCoupon() {
    const code = `FLOW${String(Date.now()).slice(-6)}`;
    const createCoupon = app.get(CreateCouponUseCase);

    await createCoupon.execute({
      tenantId: LIVE_TENANT_ID,
      code,
      description: 'Cupom live E2E para fluxos conversacionais',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 0,
      startsAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    return code;
  }

  async function seedCommerceFixtures() {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const configureShipping = app.get(ConfigureShippingPolicyUseCase);

    const category = await createCategory.execute({
      tenantId: LIVE_TENANT_ID,
      name: `E2E Fluxos Produtos ${String(Date.now()).slice(-5)}`,
      description: 'Produtos usados pelos testes live de conversa',
    });

    await createItem.execute({
      tenantId: LIVE_TENANT_ID,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe 500g E2E',
      description: 'Cafe torrado 500g para compra por conversa',
      basePrice: '18.90',
      currency: 'BRL',
      tags: ['cafe', '500g', 'mercearia', 'delivery'],
      initialStock: 50,
      attributes: { teste: 'conversation-flow' },
    });

    await createItem.execute({
      tenantId: LIVE_TENANT_ID,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Bolo de cenoura E2E',
      description: 'Bolo de cenoura para pedido de delivery',
      basePrice: '32.00',
      currency: 'BRL',
      tags: ['bolo', 'cenoura', 'padaria', 'delivery'],
      initialStock: 30,
      optionGroups: [
        {
          name: 'Adicionais',
          required: false,
          options: [
            { name: 'Cobertura extra', price: 5 },
            { name: 'Granulado', price: 3 },
          ],
        },
      ],
    });

    await configureShipping.execute({
      tenantId: LIVE_TENANT_ID,
      mode: 'FIXED',
      fixedAmount: 8,
      minimumAmount: 0,
      servicedNeighborhoods: ['Copacabana', 'Centro'],
      deliverySchedule: [
        {
          weekday: 'MONDAY',
          enabled: true,
          startTime: '08:00',
          endTime: '20:00',
        },
      ],
      notes: 'Entrega E2E por taxa fixa',
      active: true,
    });
  }

  async function seedSchedulingFixtures() {
    const createCategory = app.get(CreateSchedulingCategoryUseCase);
    const createProfessional = app.get(CreateSchedulingProfessionalUseCase);
    const assignCategories = app.get(AssignProfessionalCategoriesUseCase);
    const setAvailability = app.get(SetProfessionalAvailabilityUseCase);

    const category = await createCategory.execute({
      tenantId: LIVE_TENANT_ID,
      name: `Avaliacao E2E ${String(Date.now()).slice(-5)}`,
      unit: 'PER_SESSION',
      durationMinutes: 60,
      basePrice: 120,
    });

    const professional = await createProfessional.execute({
      tenantId: LIVE_TENANT_ID,
      name: 'Dra Ana E2E',
      phone: '11999990000',
      role: 'especialista',
    });

    await assignCategories.execute({
      tenantId: LIVE_TENANT_ID,
      professionalId: professional.id,
      categoryIds: [category.id],
    });

    await setAvailability.execute({
      tenantId: LIVE_TENANT_ID,
      professionalId: professional.id,
      date: getTomorrowDate(),
      slots: [
        {
          startsAt: '14:00',
          endsAt: '15:00',
          label: 'Avaliacao E2E',
          isOnline: true,
        },
        {
          startsAt: '16:00',
          endsAt: '17:00',
          label: 'Avaliacao E2E',
          isOnline: false,
        },
      ],
    });
  }

  async function updateBusinessForNiche(niche: ConversationFlowNiche) {
    const updateBusiness = app.get<IUpdateBusinessDataUseCase>(
      IUpdateBusinessDataUseCase,
    );

    await updateBusiness.execute({
      tenantId: LIVE_TENANT_ID,
      businessType: niche.businessType,
      description: `${niche.description} Teste live por nicho: ${niche.label}.`,
      services: niche.services,
      catalogUrl: 'https://atendeai.test/catalogo-e2e',
      operatingHours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '20:00' },
      },
    });
  }

  async function sendInbound(phone: string, text: string, externalId: string) {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: LIVE_TENANT_ID },
    });
    expect(config).not.toBeNull();

    if (config!.provider === 'TWILIO') {
      const messageSid = `SM${crypto
        .createHash('sha1')
        .update(externalId)
        .digest('hex')}`;
      const requestUrl =
        'https://atendeai-e2e.test/api/v1/webhooks/whatsapp';
      const body = {
        MessageSid: messageSid,
        SmsMessageSid: messageSid,
        WaId: phone,
        From: `whatsapp:+${phone}`,
        To: `whatsapp:+${config!.whatsappNumber.replace(/\D/g, '')}`,
        Body: text,
        NumMedia: '0',
      };
      const signature = makeTwilioSignature(
        requestUrl,
        body,
        readAuthToken(config!.credentials),
      );

      return request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('x-forwarded-proto', 'https')
        .set('x-forwarded-host', 'atendeai-e2e.test')
        .set('x-twilio-signature', signature)
        .type('form')
        .send(body)
        .expect(200);
    }

    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({
        id: externalId,
        fromNumber: phone,
        toNumber: config!.whatsappNumber,
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

  function makeTwilioSignature(
    requestUrl: string,
    body: Record<string, string>,
    authToken: string,
  ) {
    const payload = Object.keys(body)
      .sort()
      .reduce((acc, key) => `${acc}${key}${body[key]}`, requestUrl);

    return crypto.createHmac('sha1', authToken).update(payload).digest('base64');
  }

  function readAuthToken(credentials: Prisma.JsonValue): string {
    const value = credentials as Record<string, string>;
    const token = value?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!token) {
      throw new Error('Twilio authToken is required to sign live webhook input.');
    }

    return token;
  }

  async function waitForConversation(phone: string) {
    for (let i = 0; i < 30; i++) {
      const contact = await prisma.contact.findFirst({
        where: { tenantId: LIVE_TENANT_ID, phone },
      });

      if (contact) {
        const conversation = await prisma.conversation.findFirst({
          where: { tenantId: LIVE_TENANT_ID, contactId: contact.id },
          orderBy: { updatedAt: 'desc' },
        });

        if (conversation) {
          return { contact, conversation };
        }
      }

      await sleep(500);
    }

    return null;
  }

  async function waitForMessages(
    conversationId: string,
    predicate: (messages: any[]) => boolean,
  ) {
    for (let i = 0; i < 60; i++) {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      if (predicate(messages)) {
        return messages;
      }

      await sleep(500);
    }

    return null;
  }

  async function assertScenarioPersistence(
    scenario: ConversationFlowScenario,
    conversationId: string,
  ) {
    if (
      ![
        'COMMERCE_SESSION',
        'COMMERCE_CHECKOUT',
        'ABANDONMENT_TOUCH',
      ].includes(scenario.expectation)
    ) {
      return;
    }

    const sessions = await prisma.$queryRaw<Array<{ id: string; status: string }>>(
      Prisma.sql`
        SELECT id::text, status
        FROM commerce_schema.shopping_sessions
        WHERE tenant_id = ${LIVE_TENANT_ID}::uuid
          AND conversation_id = ${conversationId}::uuid
        ORDER BY updated_at DESC
      `,
    );

    expect(sessions.length).toBeGreaterThan(0);

    if (scenario.expectation === 'COMMERCE_CHECKOUT') {
      const orders = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id::text
        FROM commerce_schema.orders
        WHERE tenant_id = ${LIVE_TENANT_ID}::uuid
          AND conversation_id = ${conversationId}::uuid
      `);

      expect(orders.length).toBeGreaterThan(0);
    }

    if (scenario.expectation === 'ABANDONMENT_TOUCH') {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE commerce_schema.shopping_sessions
        SET updated_at = now() - interval '2 hours'
        WHERE id = ${sessions[0].id}::uuid
      `);

      const detector = app.get(DetectAbandonedShoppingSessionsUseCase);
      const result = await detector.execute({
        now: new Date(),
        limitPerInterval: 20,
      });

      expect(
        result.triggered.some(
          (touch) =>
            touch.tenantId === LIVE_TENANT_ID &&
            touch.sessionId === sessions[0].id,
        ),
      ).toBe(true);
    }
  }

  function expectHealthyLiveAiResponse(
    assistantText: string,
    scenario: ConversationFlowScenario,
  ) {
    expect(assistantText.trim().length).toBeGreaterThan(10);

    const normalized = normalize(assistantText);
    const forbiddenSignals = [
      'deepseek',
      'api key',
      'provider',
      'erro interno',
      'nao consegui processar',
    ];

    expect(forbiddenSignals.some((signal) => normalized.includes(signal))).toBe(
      false,
    );

    const expectedMatches = scenario.expectedSignals.filter((signal) =>
      normalized.includes(normalize(renderTurn(signal))),
    );

    if (expectedMatches.length === 0) {
      expect(
        [
          'posso',
          'vamos',
          'ajudar',
          'pedido',
          'horario',
          'agenda',
          'pagamento',
          'servico',
          'produto',
          'cliente',
        ].some((signal) => normalized.includes(signal)),
      ).toBe(true);
    }
  }

  function selectNiches() {
    const filter = process.env.CONVERSATION_FLOW_NICHES;
    if (!filter) {
      return conversationFlowNiches;
    }

    const allowed = filter
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    return conversationFlowNiches.filter((niche) =>
      allowed.includes(niche.businessType.toUpperCase()),
    );
  }

  function renderTurn(value: string) {
    return value.replace('{{couponCode}}', couponCode);
  }

  function makePhone(
    niche: ConversationFlowNiche,
    scenario: ConversationFlowScenario,
  ) {
    const hash = crypto
      .createHash('sha1')
      .update(`${niche.businessType}-${scenario.key}-${Date.now()}`)
      .digest('hex')
      .replace(/\D/g, '')
      .padEnd(10, '0')
      .slice(0, 10);

    return `5511${hash.slice(0, 9)}`;
  }

  function normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function readMessageText(content: unknown) {
    if (!content || typeof content !== 'object') {
      return '';
    }

    const text = (content as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }

  function slugify(value: string) {
    return normalize(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getTomorrowDate() {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );

    return tomorrow.toISOString().slice(0, 10);
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
