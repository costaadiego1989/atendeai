import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { TOKEN_SERVICE } from '@shared/application/ports/ITokenService';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SupportFeedbackController } from '../presentation/controllers/SupportFeedbackController';
import { CreateSupportFeedbackUseCase } from '../application/use-cases/CreateSupportFeedbackUseCase';
import { ListSupportFeedbacksUseCase } from '../application/use-cases/ListSupportFeedbacksUseCase';

describe('SupportFeedbackController (e2e)', () => {
  let app: INestApplication;
  const createFeedback = { execute: jest.fn() };
  const listFeedbacks = { execute: jest.fn() };
  const tokenService = {
    verifyAccessToken: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SupportFeedbackController],
      providers: [
        { provide: CreateSupportFeedbackUseCase, useValue: createFeedback },
        { provide: ListSupportFeedbacksUseCase, useValue: listFeedbacks },
        { provide: TOKEN_SERVICE, useValue: tokenService },
        JwtCookieGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@test.com',
      role: 'OWNER',
      type: 'access',
    });
    listFeedbacks.execute.mockResolvedValue([
      {
        id: 'feedback-1',
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        title: 'Melhorar checkout',
      },
    ]);
    createFeedback.execute.mockResolvedValue({
      id: 'feedback-created',
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'BUG',
      title: 'Erro no inbox',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('SUP-T-030: rejects requests without access cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/support/feedbacks')
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('MISSING_TOKEN');
      });

    expect(listFeedbacks.execute).not.toHaveBeenCalled();
  });

  it('SUP-T-020: lists feedbacks scoped by authenticated tenant and branch', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/support/feedbacks?branchId=branch-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);

    expect(listFeedbacks.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
    });
    expect(response.body).toEqual([
      expect.objectContaining({
        id: 'feedback-1',
        tenantId: 'tenant-1',
        branchId: 'branch-1',
      }),
    ]);
  });

  it('SUP-T-010: rejects invalid appModule before reaching use case', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/support/feedbacks')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        type: 'BUG',
        title: 'Falha',
        description: 'Detalhe da falha',
        appModule: 'Messaging',
      })
      .expect(400);

    expect(createFeedback.execute).not.toHaveBeenCalled();
  });

  it('SUP-T-021: creates feedback with user and tenant from token, not from body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/support/feedbacks')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        tenantId: 'tenant-forged',
        userId: 'user-forged',
        branchId: 'branch-1',
        type: 'BUG',
        title: 'Erro no inbox',
        description: 'Ao abrir a conversa, o painel pisca.',
        pagePath: '/app/messaging',
        appModule: 'messaging',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/support/feedbacks')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        branchId: 'branch-1',
        type: 'BUG',
        title: 'Erro no inbox',
        description: 'Ao abrir a conversa, o painel pisca.',
        pagePath: '/app/messaging',
        appModule: 'messaging',
      })
      .expect(201);

    expect(createFeedback.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        branchId: 'branch-1',
        appModule: 'messaging',
      }),
    );
  });
});
