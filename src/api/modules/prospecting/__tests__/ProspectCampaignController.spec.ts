import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../domain/repositories/IProspectCampaignRepository';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { CreateProspectCampaignUseCase } from '../application/use-cases/CreateProspectCampaignUseCase';
import { ICreateProspectCampaignUseCase } from '../application/use-cases/interfaces/ICreateProspectCampaignUseCase';
import { IListProspectCampaignsUseCase } from '../application/use-cases/interfaces/IListProspectCampaignsUseCase';
import { ListProspectCampaignsUseCase } from '../application/use-cases/ListProspectCampaignsUseCase';
import { IActivateProspectCampaignUseCase } from '../application/use-cases/interfaces/IActivateProspectCampaignUseCase';
import { ActivateProspectCampaignUseCase } from '../application/use-cases/ActivateProspectCampaignUseCase';
import { IPauseProspectCampaignUseCase } from '../application/use-cases/interfaces/IPauseProspectCampaignUseCase';
import { PauseProspectCampaignUseCase } from '../application/use-cases/PauseProspectCampaignUseCase';
import { IStartProspectCampaignUseCase } from '../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { StartProspectCampaignUseCase } from '../application/use-cases/StartProspectCampaignUseCase';
import { IDispatchNextProspectCampaignExecutionUseCase } from '../application/use-cases/interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { ISuggestProspectCampaignMessageUseCase } from '../application/use-cases/interfaces/ISuggestProspectCampaignMessageUseCase';
import { ProspectCampaignController } from '../presentation/controllers/ProspectCampaignController';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../domain/repositories/IProspectExecutionRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Prospecting Controller Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Controller Owner',
        email: Email.create('controller-owner@prospecting.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('ProspectCampaignController', () => {
  let app: INestApplication;
  let currentUser:
    | {
      tenantId: string;
      role: 'OWNER' | 'ADMIN' | 'AGENT';
    }
    | undefined;
  let savedCampaigns: ProspectCampaign[] = [];

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

  const campaignRepository: jest.Mocked<IProspectCampaignRepository> = {
    save: jest.fn(async (campaign: ProspectCampaign) => {
      savedCampaigns.push(campaign);
    }),
    findById: jest.fn(),
    findAllByTenant: jest.fn(),
  };

  const executionRepository: jest.Mocked<IProspectExecutionRepository> = {
    save: jest.fn(),
    saveMany: jest.fn(),
    findById: jest.fn(),
    findLatestContactedByContact: jest.fn(),
    findAllByCampaign: jest.fn(),
    findNextPendingByCampaign: jest.fn(),
  };

  const contactFacade: jest.Mocked<IContactFacade> = {
    identifyContact: jest.fn(),
    getContactById: jest.fn(),
    ensureContact: jest.fn(),
    upsertProspectContact: jest.fn(),
    findContactIdsForReengagementAudience: jest.fn(),
  };

  const dispatchNextCampaignExecutionUseCase = {
    execute: jest.fn(),
  };
  const suggestProspectCampaignMessageUseCase = {
    execute: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProspectCampaignController],
      providers: [
        RolesGuard,
        ProspectDispatchPolicy,
        {
          provide: ICreateProspectCampaignUseCase,
          useClass: CreateProspectCampaignUseCase,
        },
        {
          provide: IListProspectCampaignsUseCase,
          useClass: ListProspectCampaignsUseCase,
        },
        {
          provide: IActivateProspectCampaignUseCase,
          useClass: ActivateProspectCampaignUseCase,
        },
        {
          provide: IPauseProspectCampaignUseCase,
          useClass: PauseProspectCampaignUseCase,
        },
        {
          provide: IStartProspectCampaignUseCase,
          useClass: StartProspectCampaignUseCase,
        },
        {
          provide: IDispatchNextProspectCampaignExecutionUseCase,
          useValue: dispatchNextCampaignExecutionUseCase,
        },
        {
          provide: ISuggestProspectCampaignMessageUseCase,
          useValue: suggestProspectCampaignMessageUseCase,
        },
        {
          provide: TENANT_REPOSITORY,
          useValue: tenantRepository,
        },
        {
          provide: PROSPECT_CAMPAIGN_REPOSITORY,
          useValue: campaignRepository,
        },
        {
          provide: PROSPECT_EXECUTION_REPOSITORY,
          useValue: executionRepository,
        },
        {
          provide: CONTACT_FACADE,
          useValue: contactFacade,
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
    savedCampaigns = [];
    jest.clearAllMocks();
    tenantRepository.findById.mockImplementation(async (id: string) =>
      id === tenant.id.toString() ? tenant : null,
    );
    executionRepository.findAllByCampaign.mockResolvedValue([]);
    currentUser = {
      tenantId: tenant.id.toString(),
      role: 'OWNER',
    };
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create a draft prospect campaign for the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .send({
        name: 'Campanha VIP',
        objective: 'Retomar contatos premium',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: ['contact-1', 'contact-1', 'contact-2'],
        messageTemplate: 'Oi {{first_name}}, temos uma oferta especial para voce.',
        dailyLimit: 25,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId: tenant.id.toString(),
        name: 'Campanha VIP',
        status: 'DRAFT',
        audienceType: 'CONTACT_LIST',
        targetContactIds: ['contact-1', 'contact-2'],
        dailyLimit: 25,
      }),
    );
    expect(savedCampaigns).toHaveLength(1);
  });

  it('should accept instagram as a valid prospecting channel', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .send({
        name: 'Campanha Instagram',
        objective: 'Retomar pelo direct',
        audienceType: 'REENGAGEMENT',
        channel: 'INSTAGRAM',
        messageTemplate: 'Oi {{name}}, retomando nosso contato pelo Instagram.',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId: tenant.id.toString(),
        name: 'Campanha Instagram',
        channel: 'INSTAGRAM',
        status: 'DRAFT',
      }),
    );
  });

  it('should list campaigns from the authenticated tenant', async () => {
    const createdCampaign = ProspectCampaign.create({
      tenantId: tenant.tenantId,
      name: 'Campanha Listada',
      objective: 'Objetivo da campanha listada',
      audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
    });
    createdCampaign.clearEvents();
    savedCampaigns = [createdCampaign];
    campaignRepository.findAllByTenant.mockResolvedValue(savedCampaigns);

    const response = await request(app.getHttpServer())
      .get('/api/v1/prospecting/campaigns')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        name: 'Campanha Listada',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
      }),
    ]);
  });

  it('should reject invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .send({
        name: '',
        objective: 'Retomar',
        audienceType: 'INVALID',
        channel: 'WHATSAPP',
      })
      .expect(400);
  });

  it('should activate and pause campaigns for OWNER users', async () => {
    const createdCampaign = ProspectCampaign.create({
      tenantId: tenant.tenantId,
      name: 'Campanha de ciclo',
      objective: 'Controlar ciclo',
      audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
    });
    createdCampaign.clearEvents();
    savedCampaigns = [createdCampaign];
    campaignRepository.findById.mockImplementation(async (tenantId, campaignId) =>
      savedCampaigns.find(
        (campaign) =>
          campaign.tenantId.toString() === tenantId &&
          campaign.id.toString() === campaignId,
      ) ?? null,
    );

    const activateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/prospecting/campaigns/${createdCampaign.id.toString()}/activate`)
      .expect(200);

    expect(activateResponse.body).toEqual(
      expect.objectContaining({
        id: createdCampaign.id.toString(),
        status: 'ACTIVE',
      }),
    );

    const pauseResponse = await request(app.getHttpServer())
      .patch(`/api/v1/prospecting/campaigns/${createdCampaign.id.toString()}/pause`)
      .expect(200);

    expect(pauseResponse.body).toEqual(
      expect.objectContaining({
        id: createdCampaign.id.toString(),
        status: 'PAUSED',
      }),
    );
  });

  it('should start an active campaign and create pending executions', async () => {
    const createdCampaign = ProspectCampaign.create({
      tenantId: tenant.tenantId,
      name: 'Campanha de inicio',
      objective: 'Executar prospecção',
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds: ['contact-1', 'contact-2', 'contact-2'],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
      dailyLimit: 2,
    });
    createdCampaign.activate();
    savedCampaigns = [createdCampaign];
    campaignRepository.findById.mockImplementation(async (tenantId, campaignId) =>
      savedCampaigns.find(
        (campaign) =>
          campaign.tenantId.toString() === tenantId &&
          campaign.id.toString() === campaignId,
      ) ?? null,
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/prospecting/campaigns/${createdCampaign.id.toString()}/start`)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        campaignId: createdCampaign.id.toString(),
        createdExecutions: 2,
        skippedExecutions: 0,
      }),
    );
    expect(executionRepository.saveMany).toHaveBeenCalledTimes(1);
  });

  it('should forbid AGENT users from creating prospect campaigns', async () => {
    currentUser = {
      tenantId: tenant.id.toString(),
      role: 'AGENT',
    };

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .send({
        name: 'Campanha bloqueada',
        objective: 'não deve passar',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
      })
      .expect(403);
  });

  it('should reject unauthenticated requests', async () => {
    currentUser = undefined;

    await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .send({
        name: 'Campanha sem auth',
        objective: 'não deve passar',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
      })
      .expect(401);
  });
});
