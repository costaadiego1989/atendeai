import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../domain/repositories/IProspectSearchResultRepository';
import {
  IProspectSearchQueue,
  PROSPECT_SEARCH_QUEUE,
} from '../domain/ports/IProspectSearchQueue';
import {
  IProspectSearchSourceRegistry,
  PROSPECT_SEARCH_SOURCE_REGISTRY,
} from '../domain/ports/IProspectSearchSourceRegistry';
import { IProspectSearchSource } from '../domain/ports/IProspectSearchSource';
import {
  IProspectWebsiteEnricher,
  PROSPECT_WEBSITE_ENRICHER,
  ProspectWebsiteEnrichment,
} from '../domain/ports/IProspectWebsiteEnricher';
import { ProspectSearchController } from '../presentation/controllers/ProspectSearchController';
import { CreateProspectSearchUseCase } from '../application/use-cases/CreateProspectSearchUseCase';
import { ExecuteProspectSearchUseCase } from '../application/use-cases/ExecuteProspectSearchUseCase';
import { ListProspectSearchResultsUseCase } from '../application/use-cases/ListProspectSearchResultsUseCase';
import { ListProspectSearchesUseCase } from '../application/use-cases/ListProspectSearchesUseCase';
import { ICreateProspectSearchUseCase } from '../application/use-cases/interfaces/ICreateProspectSearchUseCase';
import { IExecuteProspectSearchUseCase } from '../application/use-cases/interfaces/IExecuteProspectSearchUseCase';
import { IListProspectSearchesUseCase } from '../application/use-cases/interfaces/IListProspectSearchesUseCase';
import { IListProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  IRecordUsageUseCase,
  UsageType,
} from '@modules/billing/application/use-cases/interfaces/IRecordUsageUseCase';
import { IImportProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import { IProspectSelectedSearchResultsUseCase } from '../application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';
import { ConflictException } from '@nestjs/common';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Prospecting Flow Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Prospecting Owner',
        email: Email.create('owner@prospecting-flow.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('Prospecting search flow (e2e)', () => {
  let app: INestApplication;
  let executeUseCase: IExecuteProspectSearchUseCase;
  let currentUser:
    | {
        tenantId: string;
        role: 'OWNER' | 'ADMIN' | 'AGENT';
      }
    | undefined;

  const tenant = makeTenant();
  const savedSearches: ProspectSearch[] = [];
  const savedResults: ProspectSearchResult[] = [];

  const tenantRepository: jest.Mocked<ITenantRepository> = {
    save: jest.fn(),
    findById: jest.fn(async (id: string) =>
      id === tenant.id.toString() ? tenant : null,
    ),
    findByCnpj: jest.fn(),
    findByWhatsAppNumber: jest.fn(),
    findByApiKey: jest.fn(),
    findAll: jest.fn(),
    exists: jest.fn(),
    listBranches: jest.fn(),
    createBranch: jest.fn(),
    updateBranch: jest.fn(),
    deleteBranch: jest.fn(),
  };

  const searchRepository: jest.Mocked<IProspectSearchRepository> = {
    save: jest.fn(async (search: ProspectSearch) => {
      const index = savedSearches.findIndex(
        (item) => item.id.toString() === search.id.toString(),
      );
      if (index >= 0) {
        savedSearches[index] = search;
      } else {
        savedSearches.unshift(search);
      }
    }),
    findById: jest.fn(async (tenantId: string, id: string) => {
      const search = savedSearches.find((item) => item.id.toString() === id);
      return search && search.tenantId.toString() === tenantId ? search : null;
    }),
    findBySearchId: jest.fn(
      async (id: string) =>
        savedSearches.find((item) => item.id.toString() === id) ?? null,
    ),
    findAllByTenant: jest.fn(async (tenantId: string) =>
      savedSearches.filter((search) => search.tenantId.toString() === tenantId),
    ),
  };

  const searchResultRepository: jest.Mocked<IProspectSearchResultRepository> = {
    saveMany: jest.fn(async (results: ProspectSearchResult[]) => {
      savedResults.push(...results);
    }),
    deleteBySearch: jest.fn(async (tenantId: string, searchId: string) => {
      for (let index = savedResults.length - 1; index >= 0; index -= 1) {
        const result = savedResults[index];
        if (
          result.tenantId.toString() === tenantId &&
          result.searchId.toString() === searchId
        ) {
          savedResults.splice(index, 1);
        }
      }
    }),
    findAllBySearch: jest.fn(async (tenantId: string, searchId: string) =>
      savedResults.filter(
        (result) =>
          result.tenantId.toString() === tenantId &&
          result.searchId.toString() === searchId,
      ),
    ),
  };

  const sourceRegistry: jest.Mocked<IProspectSearchSourceRegistry> = {
    resolve: jest.fn(
      (_source: 'GOOGLE_PLACES'): IProspectSearchSource =>
        ({
          source: 'GOOGLE_PLACES',
          search: jest.fn().mockResolvedValue([
            {
              externalId: 'place-odontocentro',
              businessName: 'Odonto Centro Copacabana',
              city: 'Rio de Janeiro',
              state: 'RJ',
              phone: '2133345566',
              website: 'https://odontocentro.example.com',
              email: 'contato@odontocentro.example.com',
            },
            {
              externalId: 'place-sorrisorio',
              businessName: 'Clinica Sorriso Rio',
              city: 'Rio de Janeiro',
              state: 'RJ',
              phone: '2122223344',
              website: 'https://sorrisorio.example.com',
            },
          ]),
        }) as IProspectSearchSource,
    ),
  };

  const websiteEnricher: jest.Mocked<IProspectWebsiteEnricher> = {
    enrich: jest.fn(
      async (_input: {
        website?: string;
      }): Promise<ProspectWebsiteEnrichment> => ({}),
    ),
  };

  const searchQueue: jest.Mocked<IProspectSearchQueue> = {
    addJob: jest.fn(async (job) => {
      await executeUseCase.execute({ searchId: job.searchId });
    }),
  };

  const checkQuotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    })),
  };

  const recordUsageUseCase = {
    execute: jest.fn(),
  };

  const prospectingQuotaService = {
    assertCanConsume: jest.fn(
      async (input: { tenantId: string; requested: number }) => {
        const used = savedSearches
          .filter(
            (search) =>
              search.tenantId.toString() === input.tenantId &&
              ['RUNNING', 'COMPLETED'].includes(search.status.value),
          )
          .reduce((total, search) => total + search.maxResults, 0);

        if (used + input.requested > 150) {
          throw new ConflictException(
            `Limite diario de prospeccao atingido. Usado hoje: ${used}. Limite: 150.`,
          );
        }

        return {
          used,
          quota: 150,
          remaining: 150 - used - input.requested,
        };
      },
    ),
  };

  const importResultsUseCase: jest.Mocked<IImportProspectSearchResultsUseCase> =
    {
      execute: jest.fn(),
    };

  const prospectSelectedUseCase: jest.Mocked<IProspectSelectedSearchResultsUseCase> =
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
          useClass: CreateProspectSearchUseCase,
        },
        {
          provide: IListProspectSearchesUseCase,
          useClass: ListProspectSearchesUseCase,
        },
        {
          provide: IListProspectSearchResultsUseCase,
          useClass: ListProspectSearchResultsUseCase,
        },
        {
          provide: IExecuteProspectSearchUseCase,
          useClass: ExecuteProspectSearchUseCase,
        },
        {
          provide: IImportProspectSearchResultsUseCase,
          useValue: importResultsUseCase,
        },
        {
          provide: IProspectSelectedSearchResultsUseCase,
          useValue: prospectSelectedUseCase,
        },
        {
          provide: TENANT_REPOSITORY,
          useValue: tenantRepository,
        },
        {
          provide: PROSPECT_SEARCH_REPOSITORY,
          useValue: searchRepository,
        },
        {
          provide: PROSPECT_SEARCH_RESULT_REPOSITORY,
          useValue: searchResultRepository,
        },
        {
          provide: PROSPECT_SEARCH_SOURCE_REGISTRY,
          useValue: sourceRegistry,
        },
        {
          provide: PROSPECT_WEBSITE_ENRICHER,
          useValue: websiteEnricher,
        },
        {
          provide: PROSPECT_SEARCH_QUEUE,
          useValue: searchQueue,
        },
        {
          provide: ICheckQuotaUseCase,
          useValue: checkQuotaUseCase,
        },
        {
          provide: IRecordUsageUseCase,
          useValue: recordUsageUseCase,
        },
        {
          provide: BillingProspectingQuotaService,
          useValue: prospectingQuotaService,
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

    executeUseCase = moduleFixture.get(IExecuteProspectSearchUseCase);
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
    savedSearches.splice(0, savedSearches.length);
    savedResults.splice(0, savedResults.length);
    jest.clearAllMocks();
    currentUser = {
      tenantId: tenant.id.toString(),
      role: 'OWNER',
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a search and return discovered companies in results', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'clinica odontologica',
        city: 'Rio de Janeiro',
        state: 'RJ',
        maxResults: 20,
      })
      .expect(201);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        businessTypeQuery: 'clinica odontologica',
        city: 'Rio de Janeiro',
        state: 'RJ',
      }),
    );
    expect(searchQueue.addJob).toHaveBeenCalledTimes(1);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/prospecting/searches')
      .expect(200);

    expect(listResponse.body[0]).toEqual(
      expect.objectContaining({
        id: createResponse.body.id,
        status: 'COMPLETED',
        discoveredCount: 2,
      }),
    );

    const resultsResponse = await request(app.getHttpServer())
      .get(`/api/v1/prospecting/searches/${createResponse.body.id}/results`)
      .expect(200);

    expect(resultsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessName: 'Odonto Centro Copacabana',
          city: 'Rio de Janeiro',
          state: 'RJ',
          phone: '2133345566',
        }),
        expect.objectContaining({
          businessName: 'Clinica Sorriso Rio',
          city: 'Rio de Janeiro',
          state: 'RJ',
        }),
      ]),
    );
    expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
      tenantId: tenant.id.toString(),
      type: UsageType.AI_TOKEN,
      amount: 2,
    });
  });

  it('should block prospect searches when the daily prospecting quota is exceeded', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'clinica odontologica',
        city: 'Rio de Janeiro',
        state: 'RJ',
        maxResults: 150,
      })
      .expect(201);

    const blockedResponse = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'clinica odontologica',
        city: 'Rio de Janeiro',
        state: 'RJ',
        maxResults: 1,
      })
      .expect(409);

    expect(blockedResponse.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining(
            'Limite diario de prospeccao atingido',
          ),
        }),
      }),
    );
    expect(savedSearches).toHaveLength(1);
  });
});
