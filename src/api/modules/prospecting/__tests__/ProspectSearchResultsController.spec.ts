import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectSearchController } from '../presentation/controllers/ProspectSearchController';
import {
  ICreateProspectSearchUseCase,
} from '../application/use-cases/interfaces/ICreateProspectSearchUseCase';
import {
  IListProspectSearchesUseCase,
} from '../application/use-cases/interfaces/IListProspectSearchesUseCase';
import {
  IListProspectSearchResultsUseCase,
} from '../application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import {
  IImportProspectSearchResultsUseCase,
} from '../application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import {
  IProspectSelectedSearchResultsUseCase,
} from '../application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';

describe('ProspectSearchResultsController', () => {
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
  const importResultsUseCase: jest.Mocked<IImportProspectSearchResultsUseCase> = {
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

  it('should list results for the authenticated tenant search', async () => {
    listResultsUseCase.execute.mockResolvedValue([
      {
        id: 'result-1',
        searchId: 'search-1',
        externalId: 'place-1',
        businessName: 'Clinica Sorriso',
        city: 'Campinas',
        state: 'SP',
        phone: '1933334444',
        email: 'contato@clinicasorriso.com.br',
        website: 'https://clinicasorriso.com.br',
        source: 'GOOGLE_PLACES',
        createdAt: new Date(),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/prospecting/searches/search-1/results')
      .expect(200);

    expect(listResultsUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      searchId: 'search-1',
    });
    expect(response.body).toEqual([
      expect.objectContaining({
        businessName: 'Clinica Sorriso',
        city: 'Campinas',
        source: 'GOOGLE_PLACES',
      }),
    ]);
  });

  it('should forbid AGENT users from listing search results', async () => {
    currentUser = {
      tenantId: 'tenant-1',
      role: 'AGENT',
    };

    await request(app.getHttpServer())
      .get('/api/v1/prospecting/searches/search-1/results')
      .expect(403);
  });
});
