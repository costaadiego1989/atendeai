import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectExecutionController } from '../presentation/controllers/ProspectExecutionController';
import {
  IDispatchProspectExecutionUseCase,
} from '../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';

describe('ProspectExecutionController', () => {
  let app: INestApplication;
  let currentUser:
    | {
        tenantId: string;
        role: 'OWNER' | 'ADMIN' | 'AGENT';
      }
    | undefined;

  const dispatchUseCase: jest.Mocked<IDispatchProspectExecutionUseCase> = {
    execute: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProspectExecutionController],
      providers: [
        RolesGuard,
        {
          provide: IDispatchProspectExecutionUseCase,
          useValue: dispatchUseCase,
        },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({
        canActivate: (context: any) => {
          if (!currentUser) {
            throw new UnauthorizedException(
              'Access token not provided',
              'MISSING_TOKEN',
            );
          }

          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
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
    currentUser = {
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      role: 'OWNER',
    };
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should dispatch a prospect execution for OWNER users', async () => {
    dispatchUseCase.execute.mockResolvedValue({
      executionId: 'execution-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      status: 'CONTACTED',
      renderedMessage: 'Oi Maria, tudo bem?',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/executions/execution-1/dispatch')
      .expect(201);

    expect(dispatchUseCase.execute).toHaveBeenCalledWith({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      executionId: 'execution-1',
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        executionId: 'execution-1',
        status: 'CONTACTED',
      }),
    );
  });

  it('should forbid AGENT users from dispatching prospect executions', async () => {
    currentUser = {
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      role: 'AGENT',
    };

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/executions/execution-1/dispatch')
      .expect(403);
  });

  it('should reject unauthenticated requests', async () => {
    currentUser = undefined;

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/executions/execution-1/dispatch')
      .expect(401);
  });
});
