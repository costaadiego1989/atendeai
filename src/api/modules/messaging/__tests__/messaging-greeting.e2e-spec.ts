import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import {
  FILE_STORAGE_SERVICE,
} from '@shared/domain/services/FileStorageService';
import { MessagingController } from '../presentation/controllers/MessagingController';
import {
  IListConversationsUseCase,
} from '../application/use-cases/interfaces/IListConversationsUseCase';
import {
  IGetMessageHistoryUseCase,
} from '../application/use-cases/interfaces/IGetMessageHistoryUseCase';
import {
  IMarkConversationReadUseCase,
} from '../application/use-cases/interfaces/IMarkConversationReadUseCase';
import {
  ISendHumanMessageUseCase,
} from '../application/use-cases/interfaces/ISendHumanMessageUseCase';
import {
  IEnsureConversationForContactUseCase,
} from '../application/use-cases/interfaces/IEnsureConversationForContactUseCase';
import {
  IUpdateConversationStatusUseCase,
} from '../application/use-cases/interfaces/IUpdateConversationStatusUseCase';
import {
  SUGGEST_AGENT_REPLY_USE_CASE,
} from '../application/use-cases/interfaces/ISuggestAgentReplyUseCase';
import {
  MARK_CONVERSATION_SALE_USE_CASE,
} from '../application/use-cases/interfaces/IMarkConversationSaleUseCase';
import {
  VOID_CONVERSATION_SALE_USE_CASE,
} from '../application/use-cases/interfaces/IVoidConversationSaleUseCase';
import {
  GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
} from '../application/use-cases/interfaces/IGetConversationSaleAttributionUseCase';
import {
  UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
} from '../application/use-cases/interfaces/IUpdateConversationSaleAttributionUseCase';

describe('Messaging Greeting Flow (e2e)', () => {
  let app: INestApplication;

  const ensureConversationUseCase = {
    execute: jest
      .fn()
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        created: true,
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        created: false,
      }),
  };

  const getHistoryUseCase = {
    execute: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'message-in-1',
          direction: 'INBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'olá' },
          sentBy: 'CONTACT',
          deliveryStatus: 'RECEIVED',
          timestamp: new Date('2026-05-06T12:00:00.000Z'),
        },
        {
          id: 'message-out-1',
          direction: 'OUTBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'welcome message' },
          sentBy: 'AI',
          deliveryStatus: 'SENT',
          timestamp: new Date('2026-05-06T12:00:01.000Z'),
        },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: IListConversationsUseCase, useValue: { execute: jest.fn() } },
        { provide: IGetMessageHistoryUseCase, useValue: getHistoryUseCase },
        { provide: IMarkConversationReadUseCase, useValue: { execute: jest.fn() } },
        { provide: ISendHumanMessageUseCase, useValue: { execute: jest.fn() } },
        { provide: IEnsureConversationForContactUseCase, useValue: ensureConversationUseCase },
        { provide: IUpdateConversationStatusUseCase, useValue: { execute: jest.fn() } },
        { provide: SUGGEST_AGENT_REPLY_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: MARK_CONVERSATION_SALE_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: VOID_CONVERSATION_SALE_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE, useValue: { execute: jest.fn() } },
        {
          provide: FILE_STORAGE_SERVICE,
          useValue: { upload: jest.fn(), delete: jest.fn(), getPresignedUrl: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = {
            sub: 'user-1',
            role: 'OWNER',
          };
          return true;
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('opens or reuses the conversation and exposes the greeting exchange in history', async () => {
    const createdResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/conversations/open-by-contact')
      .send({
        contactId: 'contact-1',
        channel: 'WHATSAPP',
      })
      .expect(201);

    expect(createdResponse.body).toEqual({
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      status: 'ACTIVE',
      created: true,
    });

    const reusedResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/conversations/open-by-contact')
      .send({
        contactId: 'contact-1',
        channel: 'WHATSAPP',
      })
      .expect(201);

    expect(reusedResponse.body.created).toBe(false);

    const historyResponse = await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-1/conversations/conversation-1/messages?page=1&limit=20')
      .expect(200);

    expect(historyResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'INBOUND',
          content: expect.objectContaining({ text: 'olá' }),
        }),
        expect.objectContaining({
          direction: 'OUTBOUND',
          content: expect.objectContaining({ text: 'welcome message' }),
        }),
      ]),
    );
  });
});
