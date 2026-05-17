import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectSearchController } from '../presentation/controllers/ProspectSearchController';
import { ICreateProspectSearchUseCase } from '../application/use-cases/interfaces/ICreateProspectSearchUseCase';
import { IListProspectSearchesUseCase } from '../application/use-cases/interfaces/IListProspectSearchesUseCase';
import { IListProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import { IImportProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import { IProspectSelectedSearchResultsUseCase } from '../application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';

describe('ProspectSelectedSearchResultsController', () => {
  let app: INestApplication;
  let currentUser:
    | {
        tenantId: string;
        role: 'OWNER' | 'ADMIN' | 'AGENT';
      }
    | undefined;

  const createUseCase: jest.Mocked<ICreateProspectSearchUseCase> = {
    execute: jest.fn(),
  };
  const listSearchesUseCase: jest.Mocked<IListProspectSearchesUseCase> = {
    execute: jest.fn(),
  };
  const listResultsUseCase: jest.Mocked<IListProspectSearchResultsUseCase> = {
    execute: jest.fn(),
  };
  const importResultsUseCase: jest.Mocked<IImportProspectSearchResultsUseCase> =
    {
      execute: jest.fn(),
    };
  const prospectSelectedResultsUseCase: jest.Mocked<IProspectSelectedSearchResultsUseCase> =
    {
      execute: jest.fn(),
    };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProspectSearchController],
      providers: [
        RolesGuard,
        {
          provide: ICreateProspectSearchUseCase,
          useValue: createUseCase,
        },
        {
          provide: IListProspectSearchesUseCase,
          useValue: listSearchesUseCase,
        },
        {
          provide: IListProspectSearchResultsUseCase,
          useValue: listResultsUseCase,
        },
        {
          provide: IImportProspectSearchResultsUseCase,
          useValue: importResultsUseCase,
        },
        {
          provide: IProspectSelectedSearchResultsUseCase,
          useValue: prospectSelectedResultsUseCase,
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
      tenantId: 'tenant-1',
      role: 'OWNER',
    };
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should prepare selected results without dispatching messages automatically', async () => {
    prospectSelectedResultsUseCase.execute.mockResolvedValue({
      searchId: 'search-1',
      campaignId: 'campaign-1',
      importedCount: 1,
      reusedExistingContacts: 1,
      skippedMissingPhone: 1,
      dispatchedExecutions: 0,
      targetContactIds: ['contact-1', 'contact-2'],
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches/search-1/prospect')
      .send({
        resultIds: ['result-1', 'result-2'],
        messageTemplate: 'Oi {{first_name}}, tudo bem?',
        campaignName: 'Campanha teste',
        channel: 'WHATSAPP',
      })
      .expect(201);

    expect(prospectSelectedResultsUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      searchId: 'search-1',
      resultIds: ['result-1', 'result-2'],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
      campaignName: 'Campanha teste',
      objective: undefined,
      channel: 'WHATSAPP',
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        campaignId: 'campaign-1',
        dispatchedExecutions: 0,
      }),
    );
  });

  it('should validate the request payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches/search-1/prospect')
      .send({
        resultIds: [],
        messageTemplate: '',
      })
      .expect(400);
  });
});
