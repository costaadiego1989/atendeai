import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
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

describe('ImportProspectSearchResultsController', () => {
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

  it('should import results into contacts for the authenticated tenant', async () => {
    importResultsUseCase.execute.mockResolvedValue({
      searchId: 'search-1',
      importedCount: 2,
      skippedMissingPhone: 1,
      skippedDuplicates: 1,
      importedContacts: [
        {
          id: 'contact-1',
          name: 'Clinica Sorriso',
          phone: '551933334444',
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches/search-1/import-contacts')
      .send({
        resultIds: ['result-1', 'result-2'],
      })
      .expect(201);

    expect(importResultsUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      searchId: 'search-1',
      resultIds: ['result-1', 'result-2'],
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        importedCount: 2,
        skippedMissingPhone: 1,
        skippedDuplicates: 1,
      }),
    );
  });

  it('should forbid AGENT users from importing results', async () => {
    currentUser = {
      tenantId: 'tenant-1',
      role: 'AGENT',
    };

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches/search-1/import-contacts')
      .send({
        resultIds: ['result-1'],
      })
      .expect(403);
  });
});
