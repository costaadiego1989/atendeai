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

describe('Messaging PDF Reading Flow (e2e)', () => {
  let app: INestApplication;

  const sendHumanUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'message-1',
      status: 'QUEUED',
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: IListConversationsUseCase, useValue: { execute: jest.fn() } },
        { provide: IGetMessageHistoryUseCase, useValue: { execute: jest.fn() } },
        { provide: IMarkConversationReadUseCase, useValue: { execute: jest.fn() } },
        { provide: ISendHumanMessageUseCase, useValue: sendHumanUseCase },
        { provide: IEnsureConversationForContactUseCase, useValue: { execute: jest.fn() } },
        { provide: IUpdateConversationStatusUseCase, useValue: { execute: jest.fn() } },
        { provide: SUGGEST_AGENT_REPLY_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: MARK_CONVERSATION_SALE_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: VOID_CONVERSATION_SALE_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE, useValue: { execute: jest.fn() } },
        { provide: UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE, useValue: { execute: jest.fn() } },
        {
          provide: FILE_STORAGE_SERVICE,
          useValue: {
            upload: jest.fn().mockResolvedValue('https://files.test/tenant/manual.pdf'),
            delete: jest.fn(),
            getPresignedUrl: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = { sub: 'user-1' };
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

  it('uploads a pdf attachment and queues it as a document message', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/conversations/conversation-1/messages/upload')
      .field('text', 'Analise o pdf em anexo')
      .attach('file', Buffer.from('%PDF-1.4 test file'), {
        filename: 'manual.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 'message-1',
        status: 'QUEUED',
        fileUrl: 'https://files.test/tenant/manual.pdf',
        type: 'DOCUMENT',
      }),
    );

    expect(sendHumanUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          type: 'DOCUMENT',
          text: 'Analise o pdf em anexo',
          url: 'https://files.test/tenant/manual.pdf',
        }),
      }),
    );
  });
});
