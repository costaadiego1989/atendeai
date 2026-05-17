import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import {
  AI_ENGINE,
  IAIEngine,
  AIRequest,
  AIResponse,
} from '@modules/ai/application/ports/IAIEngine';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { ProspectCampaignController } from '../presentation/controllers/ProspectCampaignController';
import { ICreateProspectCampaignUseCase } from '../application/use-cases/interfaces/ICreateProspectCampaignUseCase';
import { IListProspectCampaignsUseCase } from '../application/use-cases/interfaces/IListProspectCampaignsUseCase';
import { IActivateProspectCampaignUseCase } from '../application/use-cases/interfaces/IActivateProspectCampaignUseCase';
import { IPauseProspectCampaignUseCase } from '../application/use-cases/interfaces/IPauseProspectCampaignUseCase';
import { IStartProspectCampaignUseCase } from '../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { ISuggestProspectCampaignMessageUseCase } from '../application/use-cases/interfaces/ISuggestProspectCampaignMessageUseCase';
import { SuggestProspectCampaignMessageUseCase } from '../application/use-cases/SuggestProspectCampaignMessageUseCase';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Lovabel Comercial'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner Prospecting',
        email: Email.create('owner@prospecting.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

function buildContextualMessage(searchTerm: string, objective: string) {
  const normalized = searchTerm.toLowerCase();

  if (normalized.includes('clinica') || normalized.includes('odont')) {
    return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Muitas clinicas hoje perdem oportunidades por demora no atendimento, faltas na agenda e pouco follow-up com pacientes.\n\nNosso foco e ${objective.toLowerCase()}. Ajudamos a organizar a jornada comercial e de atendimento para ganhar eficiencia e melhorar conversao. Se fizer sentido, posso te explicar em uma mensagem curta como isso pode funcionar no contexto da clinica.`;
  }

  if (normalized.includes('academia')) {
    return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Academias normalmente buscam responder mais rapido os interessados, aumentar matriculas e melhorar a reativação de alunos parados.\n\nNosso foco e ${objective.toLowerCase()}. Ajudamos a estruturar esse processo para reduzir perda de leads e melhorar a conversao comercial. Se fizer sentido, posso te mostrar como isso pode funcionar no dia a dia da operação.`;
  }

  if (normalized.includes('imob')) {
    return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Imobiliarias costumam lidar com muito lead sem follow-up, demora para responder e dificuldade para transformar interesse em visita e fechamento.\n\nNosso foco e ${objective.toLowerCase()}. Ajudamos a organizar esse fluxo para ganhar velocidade comercial e previsibilidade. Se fizer sentido, posso te explicar melhor em uma mensagem curta.`;
  }

  if (normalized.includes('contab')) {
    return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Escritorios contabeis normalmente querem melhorar o atendimento comercial, organizar follow-up e transformar melhor as oportunidades em novos contratos.\n\nNosso foco e ${objective.toLowerCase()}. Ajudamos a dar mais ritmo para esse processo e reduzir oportunidades perdidas. Se fizer sentido, posso compartilhar um resumo rapido.`;
  }

  if (normalized.includes('pet')) {
    return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Pet shops costumam buscar mais recorrência, melhor organização dos agendamentos e mais proximidade com os clientes para estimular recompra.\n\nNosso foco e ${objective.toLowerCase()}. Ajudamos a estruturar esse relacionamento para melhorar atendimento e retorno comercial. Se fizer sentido, posso te mostrar como isso pode funcionar.`;
  }

  return `Oi! Tudo bem?\n\nVi que voces atuam com ${searchTerm}. Muitas empresas buscam mais eficiencia comercial, menos perda de oportunidades e mais organização no atendimento.\n\nNosso foco e ${objective.toLowerCase()}. Se fizer sentido, posso te mostrar como isso pode funcionar no negocio.`;
}

describe('ProspectCampaign message suggestion e2e', () => {
  let app: INestApplication;
  let currentUser:
    | {
        tenantId: string;
        role: 'OWNER' | 'ADMIN' | 'AGENT';
      }
    | undefined;
  let aiRequests: AIRequest[] = [];

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
  };

  const aiEngine: jest.Mocked<IAIEngine> = {
    generateResponse: jest.fn(
      async (request: AIRequest): Promise<AIResponse> => {
        aiRequests.push(request);
        const payload = JSON.parse(request.userMessage) as {
          objective: string;
          searchTerm?: string | null;
        };

        return {
          text: buildContextualMessage(
            payload.searchTerm ?? 'negocio local',
            payload.objective,
          ),
          tokensUsed: 96,
          confidence: 0.93,
          finishReason: 'stop',
        };
      },
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProspectCampaignController],
      providers: [
        RolesGuard,
        {
          provide: ICreateProspectCampaignUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: IListProspectCampaignsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: IActivateProspectCampaignUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: IPauseProspectCampaignUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: IStartProspectCampaignUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ISuggestProspectCampaignMessageUseCase,
          useClass: SuggestProspectCampaignMessageUseCase,
        },
        {
          provide: TENANT_REPOSITORY,
          useValue: tenantRepository,
        },
        {
          provide: AI_ENGINE,
          useValue: aiEngine,
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
    aiRequests = [];
    jest.clearAllMocks();
    tenantRepository.findById.mockImplementation(async (id: string) =>
      id === tenant.id.toString() ? tenant : null,
    );
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

  it.each([
    {
      label: 'clinica odontologica',
      searchTerm: 'clinica odontologica em Copacabana / Rio de Janeiro / RJ',
      expectedTerms: ['clinicas', 'agenda', 'pacientes', 'conversao'],
    },
    {
      label: 'academia',
      searchTerm: 'academia em Ipanema / Rio de Janeiro / RJ',
      expectedTerms: ['academias', 'matriculas', 'reativação', 'leads'],
    },
    {
      label: 'imobiliaria',
      searchTerm: 'imobiliaria em Niteroi / RJ',
      expectedTerms: ['imobiliarias', 'lead', 'visita', 'fechamento'],
    },
    {
      label: 'escritorio contabil',
      searchTerm: 'escritorio contabil em Campinas / SP',
      expectedTerms: ['contabeis', 'follow-up', 'contratos', 'oportunidades'],
    },
    {
      label: 'pet shop',
      searchTerm: 'pet shop em Botafogo / Rio de Janeiro / RJ',
      expectedTerms: [
        'pet shops',
        'agendamentos',
        'recompra',
        'relacionamento',
      ],
    },
  ])(
    'should generate a contextual message for %s',
    async ({ searchTerm, expectedTerms }) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/prospecting/campaigns/message-suggestion')
        .send({
          objective: 'apresentar a solução comercial e gerar conversa',
          audienceType: 'CONTACT_LIST',
          channels: ['WHATSAPP'],
          searchTerm,
          selectedCount: 3,
          selectedContacts: [
            { name: 'Empresa 1', phone: '21999990001' },
            { name: 'Empresa 2', phone: '21999990002' },
            { name: 'Empresa 3', phone: '21999990003' },
          ],
        })
        .expect(201);

      const message = String(response.body.messageTemplate).toLowerCase();

      expect(aiEngine.generateResponse).toHaveBeenCalledTimes(1);
      expect(aiRequests[0].systemPrompt).toContain(
        'Use o segmento pesquisado e o objetivo para mostrar que voce entende o contexto do negocio abordado.',
      );
      expect(aiRequests[0].userMessage).toContain(searchTerm);

      for (const expectedTerm of expectedTerms) {
        expect(message).toContain(expectedTerm);
      }
    },
  );
});
