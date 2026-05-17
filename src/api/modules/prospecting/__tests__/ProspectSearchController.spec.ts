import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
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
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { ICreateProspectSearchUseCase } from '../application/use-cases/interfaces/ICreateProspectSearchUseCase';
import { IListProspectSearchesUseCase } from '../application/use-cases/interfaces/IListProspectSearchesUseCase';
import { IListProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import { IImportProspectSearchResultsUseCase } from '../application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import { IProspectSelectedSearchResultsUseCase } from '../application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';
import { CreateProspectSearchUseCase } from '../application/use-cases/CreateProspectSearchUseCase';
import { ListProspectSearchesUseCase } from '../application/use-cases/ListProspectSearchesUseCase';
import { ProspectSearchController } from '../presentation/controllers/ProspectSearchController';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchQueue,
  PROSPECT_SEARCH_QUEUE,
} from '../domain/ports/IProspectSearchQueue';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { TenantId } from '@shared/domain/TenantId';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Prospect Search Controller Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Controller Owner',
        email: Email.create('controller-owner@prospect-search.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('ProspectSearchController', () => {
  let app: INestApplication;
  let currentUser:
    | {
        tenantId: string;
        role: 'OWNER' | 'ADMIN' | 'AGENT';
      }
    | undefined;
  let savedSearches: ProspectSearch[] = [];

  const tenant = makeTenant();

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
        return;
      }

      savedSearches.unshift(search);
    }),
    findById: jest.fn(),
    findBySearchId: jest.fn(),
    findAllByTenant: jest.fn(async (tenantId: string) =>
      savedSearches.filter((search) => search.tenantId.toString() === tenantId),
    ),
  };

  const searchQueue: jest.Mocked<IProspectSearchQueue> = {
    addJob: jest.fn(),
  };
  const prospectingQuotaService: jest.Mocked<
    Pick<BillingProspectingQuotaService, 'assertCanConsume'>
  > = {
    assertCanConsume: jest.fn(),
  };
  const listSearchResultsUseCase: jest.Mocked<IListProspectSearchResultsUseCase> =
    {
      execute: jest.fn(),
    };
  const importSearchResultsUseCase: jest.Mocked<IImportProspectSearchResultsUseCase> =
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
          useClass: CreateProspectSearchUseCase,
        },
        {
          provide: IListProspectSearchesUseCase,
          useClass: ListProspectSearchesUseCase,
        },
        {
          provide: IListProspectSearchResultsUseCase,
          useValue: listSearchResultsUseCase,
        },
        {
          provide: IImportProspectSearchResultsUseCase,
          useValue: importSearchResultsUseCase,
        },
        {
          provide: IProspectSelectedSearchResultsUseCase,
          useValue: prospectSelectedResultsUseCase,
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
          provide: PROSPECT_SEARCH_QUEUE,
          useValue: searchQueue,
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
    savedSearches = [];
    jest.clearAllMocks();
    tenantRepository.findById.mockImplementation(async (id: string) =>
      id === tenant.id.toString() ? tenant : null,
    );
    currentUser = {
      tenantId: tenant.id.toString(),
      role: 'OWNER',
    };
    prospectingQuotaService.assertCanConsume.mockResolvedValue({
      used: 0,
      quota: 150,
      remaining: 70,
    });
    listSearchResultsUseCase.execute.mockResolvedValue([]);
    importSearchResultsUseCase.execute.mockResolvedValue({
      searchId: 'search-1',
      importedCount: 0,
      skippedMissingPhone: 0,
      skippedDuplicates: 0,
      importedContacts: [],
    });
    prospectSelectedResultsUseCase.execute.mockResolvedValue({
      searchId: 'search-1',
      campaignId: 'campaign-1',
      importedCount: 0,
      reusedExistingContacts: 0,
      skippedMissingPhone: 0,
      dispatchedExecutions: 0,
      targetContactIds: [],
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create a pending prospect search for the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        state: 'SP',
        maxResults: 80,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId: tenant.id.toString(),
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        state: 'SP',
        source: 'GOOGLE_PLACES',
        maxResults: 80,
        status: 'PENDING',
        discoveredCount: 0,
      }),
    );
    expect(savedSearches).toHaveLength(1);
    expect(searchQueue.addJob).toHaveBeenCalledTimes(1);
  });

  it('should return a frontend-friendly conflict when prospecting daily quota is exceeded', async () => {
    prospectingQuotaService.assertCanConsume.mockRejectedValue(
      new ConflictException(
        'Limite diario de prospeccao atingido. Usado hoje: 150. Limite: 150.',
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        state: 'SP',
        maxResults: 80,
      })
      .expect(409);

    expect(response.body.error.message).toContain(
      'Limite diario de prospeccao',
    );
    expect(savedSearches).toHaveLength(0);
    expect(searchQueue.addJob).not.toHaveBeenCalled();
  });

  it('should list prospect searches from the authenticated tenant', async () => {
    const createdSearch = ProspectSearch.create({
      tenantId: TenantId.create(tenant.id.toString()),
      businessTypeQuery: 'Academia',
      city: 'Sao Paulo',
      source: ProspectSearchSourceVO.create('GOOGLE_PLACES'),
      maxResults: 30,
    });
    savedSearches = [createdSearch];

    const response = await request(app.getHttpServer())
      .get('/api/v1/prospecting/searches')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        businessTypeQuery: 'Academia',
        city: 'Sao Paulo',
        source: 'GOOGLE_PLACES',
      }),
    ]);
  });

  it('should reject invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: '',
        city: '',
        source: 'INVALID',
      })
      .expect(400);
  });

  it('should forbid AGENT users from creating prospect searches', async () => {
    currentUser = {
      tenantId: tenant.id.toString(),
      role: 'AGENT',
    };

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
      })
      .expect(403);
  });

  it('should reject unauthenticated requests', async () => {
    currentUser = undefined;

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/searches')
      .send({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
      })
      .expect(401);
  });
});
