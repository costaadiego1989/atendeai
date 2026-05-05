import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '@modules/tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { AI_ENGINE, AIResponse, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { MESSAGE_QUEUE } from '../domain/ports/IMessageQueue';
import { FollowUpService } from '../application/services/FollowUpService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';

describe('BubbleWhats AI response flow (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authCookies: string[];

  const seed = Date.now();
  const ownerEmail = `bubblewhats-ai-${seed}@test.com`;
  const ownerPassword = 'SenhaForte123!';
  const bubbleWhatsId = `bw-ai-${seed}`;
  const whatsappNumber = `55219${String(seed).slice(-8)}`;
  const testCnpj = generateValidCnpj(seed);

  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => ({
      text: `Resposta IA para: ${request.userMessage}`,
      tokensUsed: 42,
      confidence: 0.96,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
    })),
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
    addJob: jest.fn(async () => { }),
  };

  const mockFollowUpService = {
    cancelFollowUps: jest.fn(async () => { }),
    scheduleFollowUps: jest.fn(async () => { }),
  };
  const mockStorageService: FileStorageService = {
    upload: jest.fn(async (_file, fileName) => `https://media.test/uploads/${fileName}`),
    delete: jest.fn(async () => { }),
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
      const serialized = event.toJSON();

      for (const handler of handlers) {
        if (handler.consumerName === 'tenant-twilio-provisioning') {
          continue;
        }

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
        handle: handler as unknown as (event: Record<string, unknown>) => Promise<void>,
      });
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
    const cnpj = `${base}${digit1}${digit2}`;

    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
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

  async function sendInbound(phone: string, text: string, externalId: string) {
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

  async function sendInboundMedia(
    phone: string,
    externalId: string,
    type: 'image' | 'audio' | 'document',
    url: string,
    text?: string,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({
        event: 'message.received',
        data: {
          messageId: externalId,
          from: phone,
          to: whatsappNumber,
          type,
          content: {
            ...(text ? { text } : {}),
            url,
          },
          timestamp: new Date().toISOString(),
        },
      })
      .expect(200);
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
      .overrideProvider(FILE_STORAGE_SERVICE)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'BubbleWhats AI Flow Store',
      cnpj: testCnpj,
      ownerName: 'BubbleWhats AI Owner',
      ownerEmail,
      ownerPhone: '11955554444',
      ownerPassword,
      plan: 'ESSENCIAL',
    });
    tenantId = tenant.id;

    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    await configureAI.execute({
      tenantId,
      systemPrompt: 'Voce e uma assistente comercial prestativa.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 300,
      confidenceThreshold: 0.7,
      businessRules: ['Responder sempre em portugues'],
    });

    const savedTenant = await tenantRepository.findById(tenantId);
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: bubbleWhatsId,
        token: 'tenant-token-ai',
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
      .send({
        email: ownerEmail,
        password: ownerPassword,
      })
      .expect(200);

    authCookies = loginResponse.get('Set-Cookie') || [];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => { });
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.aIConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await (prisma.subscription as any)
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

  it('should preserve the full message history even though the conversation list shows only lastMessage', async () => {
    const phone = '5521997001001';

    await sendInbound(phone, 'Oi', `hist-${Date.now()}-1`);
    const persisted = await waitForConversation(phone);

    expect(persisted).not.toBeNull();

    await waitForMessages(
      persisted!.conversation.id,
      (messages) =>
        messages.filter((message) => message.sentBy === 'AI').length >= 1,
    );

    await sendInbound(
      phone,
      'Gostaria de saber os horários',
      `hist-${Date.now()}-2`,
    );

    const messages = await waitForMessages(
      persisted!.conversation.id,
      (currentMessages) =>
        currentMessages.length >= 4 &&
        currentMessages.filter((message) => message.sentBy === 'AI').length >= 2,
    );

    expect(messages).not.toBeNull();

    const historyResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations/${persisted!.conversation.id}/messages?page=1&limit=20`,
      )
      .set('Cookie', authCookies)
      .expect(200);

    expect(historyResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'INBOUND',
          content: expect.objectContaining({ text: 'Oi' }),
          sentBy: 'CONTACT',
        }),
        expect.objectContaining({
          direction: 'OUTBOUND',
          content: expect.objectContaining({ text: 'Resposta IA para: Oi' }),
          sentBy: 'AI',
        }),
        expect.objectContaining({
          direction: 'INBOUND',
          content: expect.objectContaining({
            text: 'Gostaria de saber os horários',
          }),
          sentBy: 'CONTACT',
        }),
        expect.objectContaining({
          direction: 'OUTBOUND',
          content: expect.objectContaining({
            text: 'Resposta IA para: Gostaria de saber os horários',
          }),
          sentBy: 'AI',
        }),
      ]),
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/conversations?page=1&limit=20`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: persisted!.conversation.id,
          lastMessage: expect.objectContaining({
            content: 'Resposta IA para: Gostaria de saber os horários',
            direction: 'OUTBOUND',
          }),
        }),
      ]),
    );
  });

  it('should generate and persist an outbound AI reply after a BubbleWhats inbound message', async () => {
    const phone = '5521997001002';
    const inboundText = 'Gostaria de saber sobre os horários de agendamento';

    await sendInbound(phone, inboundText, `ai-${Date.now()}`);
    const persisted = await waitForConversation(phone);

    expect(persisted).not.toBeNull();

    const messages = await waitForMessages(
      persisted!.conversation.id,
      (currentMessages) =>
        currentMessages.some(
          (message) =>
            message.direction === 'OUTBOUND' &&
            message.sentBy === 'AI' &&
            message.content?.text === `Resposta IA para: ${inboundText}`,
        ),
    );

    expect(messages).not.toBeNull();
    expect(mockAiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: inboundText,
      }),
    );

    const historyResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations/${persisted!.conversation.id}/messages?page=1&limit=20`,
      )
      .set('Cookie', authCookies)
      .expect(200);

    expect(historyResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'INBOUND',
          sentBy: 'CONTACT',
          content: expect.objectContaining({ text: inboundText }),
        }),
        expect.objectContaining({
          direction: 'OUTBOUND',
          sentBy: 'AI',
          content: expect.objectContaining({
            text: `Resposta IA para: ${inboundText}`,
          }),
        }),
      ]),
    );
  });

  it('should preserve inbound media and send an AI-readable description for image, audio and document messages', async () => {
    const cases = [
      {
        phone: '5521997001101',
        type: 'image' as const,
        storedType: 'IMAGE',
        url: 'https://media.test/order-photo.jpg',
        text: 'Foto do produto que quero',
        expectedLabel: 'imagem',
      },
      {
        phone: '5521997001102',
        type: 'audio' as const,
        storedType: 'AUDIO',
        url: 'https://media.test/audio-message.ogg',
        expectedLabel: 'audio',
      },
      {
        phone: '5521997001103',
        type: 'document' as const,
        storedType: 'DOCUMENT',
        url: 'https://media.test/prescription.pdf',
        text: 'Receita em PDF',
        expectedLabel: 'documento',
      },
    ];

    for (const item of cases) {
      const externalId = `media-${item.type}-${Date.now()}`;

      await sendInboundMedia(item.phone, externalId, item.type, item.url, item.text);
      const persisted = await waitForConversation(item.phone);

      expect(persisted).not.toBeNull();

      const storedMessage = await (prisma.message as any).findFirst({
        where: {
          conversationId: persisted!.conversation.id,
          direction: 'INBOUND',
          externalId,
        },
      });

      expect(storedMessage).toEqual(
        expect.objectContaining({
          contentType: item.storedType,
        }),
      );
      expect(storedMessage.content).toEqual(
        expect.objectContaining({
          type: item.storedType,
          url: item.url,
        }),
      );

      const aiCall = (mockAiEngine.generateResponse as jest.Mock).mock.calls.find(
        ([request]) =>
          typeof request.userMessage === 'string' &&
          request.userMessage.includes(item.url),
      );

      expect(aiCall).toBeDefined();
      expect(aiCall![0].userMessage.toLowerCase()).toContain(item.expectedLabel);
      if (item.text) {
        expect(aiCall![0].userMessage).toContain(item.text);
      }
    }
  });

  it('should upload and queue a human image reply with the stored media URL', async () => {
    const phone = '5521997001201';
    const inboundText = 'Pode me mandar uma foto?';

    await sendInbound(phone, inboundText, `upload-seed-${Date.now()}`);
    const persisted = await waitForConversation(phone);

    expect(persisted).not.toBeNull();

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${persisted!.conversation.id}/messages/upload`,
      )
      .set('Cookie', authCookies)
      .field('text', 'Segue a foto')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'produto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'QUEUED',
        fileUrl: 'https://media.test/uploads/produto.jpg',
        type: 'IMAGE',
      }),
    );

    const storedMessage = await (prisma.message as any).findFirst({
      where: {
        conversationId: persisted!.conversation.id,
        direction: 'OUTBOUND',
        sentBy: 'HUMAN',
        contentType: 'IMAGE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(storedMessage?.content).toEqual(
      expect.objectContaining({
        type: 'IMAGE',
        text: 'Segue a foto',
        url: 'https://media.test/uploads/produto.jpg',
      }),
    );
  });
});
