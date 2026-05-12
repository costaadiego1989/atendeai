import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { MESSAGE_QUEUE } from '@modules/messaging/domain/ports/IMessageQueue';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { EVENT_BUS, IEventBus } from '@shared/infrastructure/event-bus';
import { MessageReceivedIntegrationEvent } from '@modules/messaging/application/integration-events/publishers/MessageReceivedIntegrationEvent';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

describe('ProspectingModule', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantId: string;
  let otherTenantId: string;
  let contactId: string;
  let ownerCookie: string;
  let agentCookie: string;
  const messageQueue = {
    addJob: jest.fn(),
  };
  const subscribedHandlers = new Map<
    string,
    Array<(event: Record<string, unknown>) => Promise<void>>
  >();

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const handlers = subscribedHandlers.get(event.queue) || [];
      const serialized = event.toJSON();

      for (const handler of handlers) {
        await handler(serialized);
      }
    },
    subscribe<T extends IntegrationEvent>(
      queue: string,
      handler: (event: T) => Promise<void>,
    ): void {
      const handlers = subscribedHandlers.get(queue) || [];
      handlers.push(
        handler as unknown as (event: Record<string, unknown>) => Promise<void>,
      );
      subscribedHandlers.set(queue, handlers);
    },
  };

  const password = 'Password123!';
  const ownerEmail = `prospecting-owner-${Date.now()}@test.com`;
  const agentEmail = `prospecting-agent-${Date.now()}@test.com`;
  const otherOwnerEmail = `prospecting-other-owner-${Date.now()}@test.com`;

  function makeValidCnpj(seed: number): string {
    const base = String(seed).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const digit1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const digit2 = calcDigit(
      `${base}${digit1}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    const cnpj = `${base}${digit1}${digit2}`;
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return response.get('Set-Cookie')?.[0];
  }

  beforeAll(async () => {
    subscribedHandlers.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MESSAGE_QUEUE)
      .useValue(messageQueue)
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    eventBus = app.get(EVENT_BUS);

    await prisma.$executeRaw(Prisma.sql(
      'CREATE SCHEMA IF NOT EXISTS prospecting_schema',
    );
    await prisma.$executeRaw(Prisma.sql(`
      CREATE TABLE IF NOT EXISTS prospecting_schema.prospect_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        objective TEXT NOT NULL,
        audience_type VARCHAR(30) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        target_contact_ids JSONB DEFAULT '[]'::jsonb,
        message_template TEXT NULL,
        daily_limit INTEGER NOT NULL DEFAULT 50,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS prospect_campaigns_tenant_id_id_key
      ON prospecting_schema.prospect_campaigns (tenant_id, id)
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE TABLE IF NOT EXISTS prospecting_schema.prospect_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        campaign_id UUID NOT NULL,
        contact_id VARCHAR(255) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        stop_reason VARCHAR(30) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRaw(Prisma.sql(`
      ALTER TABLE prospecting_schema.prospect_executions
      ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(30) NULL
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS prospect_executions_tenant_campaign_contact_key
      ON prospecting_schema.prospect_executions (tenant_id, campaign_id, contact_id)
    `);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting E2E Store',
        cnpj: makeValidCnpj(Date.now()),
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Other E2E Store',
        cnpj: makeValidCnpj(Date.now() + 1),
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Maria Prospect',
        phone: '11991112222',
        email: `prospect-contact-${Date.now()}@test.com`,
        stage: 'LEAD',
        tags: [],
      },
    });
    contactId = contact.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Prospecting Owner',
          email: ownerEmail,
          phone: '11991110001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId,
          name: 'Prospecting Agent',
          email: agentEmail,
          phone: '11991110002',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: otherTenantId,
          name: 'Prospecting Other Owner',
          email: otherOwnerEmail,
          phone: '11991110003',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    ownerCookie = (await login(ownerEmail)) as string;
    agentCookie = (await login(agentEmail)) as string;

    await prisma.prospectCampaign.create({
      data: {
        tenantId: otherTenantId,
        name: 'Campanha Outro Tenant',
        objective: 'não deve aparecer',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
        targetContactIds: [],
        messageTemplate: 'Template outro tenant',
        dailyLimit: 20,
        status: 'DRAFT',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.message
        .deleteMany({
          where: {
            conversation: {
              tenantId: {
                in: [tenantId, otherTenantId].filter(Boolean),
              },
            },
          },
        })
        .catch(() => { });
      await prisma.conversation
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => { });
      await prisma.contact
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => { });
      await prisma.$executeRaw(Prisma.sql(
        'DELETE FROM prospecting_schema.prospect_executions WHERE tenant_id = $1 OR tenant_id = $2',
        tenantId,
        otherTenantId,
      ).catch(() => { });
      await prisma.prospectCampaign
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => { });
      await prisma.subscription
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => { });
      await prisma.user
        .deleteMany({
          where: {
            email: {
              in: [ownerEmail, agentEmail, otherOwnerEmail],
            },
          },
        })
        .catch(() => { });
      await prisma.tenant
        .deleteMany({
          where: {
            id: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create and list prospect campaigns for the authenticated tenant', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/prospecting/campaigns')
      .set('Cookie', [ownerCookie])
      .send({
        name: 'Campanha Reativação',
        objective: 'Retomar leads quentes',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
        messageTemplate: 'Oi, ainda faz sentido retomarmos essa conversa?',
        dailyLimit: 35,
      })
      .expect(201);

    expect(createResponse.body.data).toEqual(
      expect.objectContaining({
        tenantId,
        name: 'Campanha Reativação',
        status: 'DRAFT',
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/prospecting/campaigns')
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId,
          name: 'Campanha Reativação',
        }),
      ]),
    );
    expect(
      listResponse.body.data.some(
        (campaign: any) => campaign.name === 'Campanha Outro Tenant',
      ),
    ).toBe(false);
  });

  it('should activate and pause prospect campaigns for the authenticated tenant', async () => {
    const createdCampaign = await prisma.prospectCampaign.create({
      data: {
        tenantId,
        name: 'Campanha Ciclo',
        objective: 'Validar ativação e pausa',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
        targetContactIds: [],
        messageTemplate: 'Template ciclo',
        dailyLimit: 15,
        status: 'DRAFT',
      },
    });

    const activateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/prospecting/campaigns/${createdCampaign.id}/activate`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(activateResponse.body.data).toEqual(
      expect.objectContaining({
        id: createdCampaign.id,
        status: 'ACTIVE',
      }),
    );

    const pauseResponse = await request(app.getHttpServer())
      .patch(`/api/v1/prospecting/campaigns/${createdCampaign.id}/pause`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(pauseResponse.body.data).toEqual(
      expect.objectContaining({
        id: createdCampaign.id,
        status: 'PAUSED',
      }),
    );
  });

  it('should start an active contact-list campaign for the authenticated tenant', async () => {
    const createdCampaign = await prisma.prospectCampaign.create({
      data: {
        tenantId,
        name: 'Campanha Start',
        objective: 'Validar inicio de campanha',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: ['contact-a', 'contact-b', 'contact-b'],
        messageTemplate: 'Template start',
        dailyLimit: 2,
        status: 'ACTIVE',
      },
    });

    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/prospecting/campaigns/${createdCampaign.id}/start`)
      .set('Cookie', [ownerCookie])
      .expect(201);

    expect(startResponse.body.data).toEqual(
      expect.objectContaining({
        campaignId: createdCampaign.id,
        createdExecutions: 2,
        skippedExecutions: 0,
      }),
    );
    expect(startResponse.body.data.executions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contactId: 'contact-a', status: 'PENDING' }),
        expect.objectContaining({ contactId: 'contact-b', status: 'PENDING' }),
      ]),
    );
  });

  it('should dispatch a pending execution and persist the outbound conversation', async () => {
    const campaignId = new UniqueEntityID().toString();
    const executionId = new UniqueEntityID().toString();

    await prisma.prospectCampaign.create({
      data: {
        id: campaignId,
        tenantId,
        name: 'Campanha Dispatch',
        objective: 'Validar disparo outbound',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: [contactId],
        messageTemplate: 'Oi {{first_name}}, temos uma condição especial',
        dailyLimit: 1,
        status: 'ACTIVE',
      },
    });

    await prisma.$executeRaw(Prisma.sql(
      `
        INSERT INTO prospecting_schema.prospect_executions (
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          'WHATSAPP',
          'PENDING',
          0,
          NOW(),
          NOW()
        )
      `,
      executionId,
      tenantId,
      campaignId,
      contactId,
    );

    const dispatchResponse = await request(app.getHttpServer())
      .post(`/api/v1/prospecting/executions/${executionId}/dispatch`)
      .set('Cookie', [ownerCookie])
      .expect(201);

    expect(dispatchResponse.body.data).toEqual(
      expect.objectContaining({
        executionId,
        status: 'CONTACTED',
        renderedMessage: 'Oi Maria, temos uma condição especial',
      }),
    );
    expect(messageQueue.addJob).toHaveBeenCalledTimes(1);

    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId,
      },
      include: {
        messages: true,
      },
    });

    expect(conversation).toBeTruthy();
    expect(conversation?.messages).toHaveLength(1);
    expect((conversation?.messages[0]?.content as any)?.text).toBe(
      'Oi Maria, temos uma condição especial',
    );

    const persistedExecution = await prisma.$queryRaw<
      Array<{ status: string; attempt_count: number }>
    >(
      `
        SELECT status, attempt_count
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      tenantId,
      executionId,
    );

    expect(persistedExecution[0]).toEqual({
      status: 'CONTACTED',
      attempt_count: 1,
    });
  });

  it('should mark a contacted execution as responded after an inbound message event', async () => {
    const campaignId = new UniqueEntityID().toString();
    const executionId = new UniqueEntityID().toString();
    const responseContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Carlos Response',
        phone: `1199${Date.now().toString().slice(-7)}`,
        email: `prospect-response-${Date.now()}@test.com`,
        stage: 'LEAD',
        tags: [],
      },
    });

    await prisma.prospectCampaign.create({
      data: {
        id: campaignId,
        tenantId,
        name: 'Campanha Response',
        objective: 'Validar resposta inbound',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: [responseContact.id],
        messageTemplate: 'Oi {{first_name}}, tudo bem?',
        dailyLimit: 1,
        status: 'ACTIVE',
      },
    });

    await prisma.$executeRaw(Prisma.sql(
      `
        INSERT INTO prospecting_schema.prospect_executions (
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          'WHATSAPP',
          'CONTACTED',
          1,
          NOW(),
          NOW()
        )
      `,
      executionId,
      tenantId,
      campaignId,
      responseContact.id,
    );

    await eventBus.publish(
      new MessageReceivedIntegrationEvent(
        {
          conversationId: new UniqueEntityID().toString(),
          tenantId,
          contactId: responseContact.id,
          messageId: new UniqueEntityID().toString(),
          content: { type: 'TEXT', text: 'Tenho interesse' },
          channel: 'WHATSAPP',
        },
        `messaging:response:${executionId}`,
      ),
    );

    let persistedExecution: Array<{ status: string; stop_reason: string | null }> = [];
    for (let i = 0; i < 20; i++) {
      persistedExecution = await prisma.$queryRaw<
        Array<{ status: string; stop_reason: string | null }>
      >(
        `
          SELECT status, stop_reason
          FROM prospecting_schema.prospect_executions
          WHERE tenant_id = $1::uuid AND id = $2::uuid
        `,
        tenantId,
        executionId,
      );

      if (persistedExecution[0]?.status === 'RESPONDED') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(persistedExecution[0]?.status).toBe('RESPONDED');
  });

  it('should mark a contacted execution as stopped after an opt-out inbound event', async () => {
    const campaignId = new UniqueEntityID().toString();
    const executionId = new UniqueEntityID().toString();
    const stopContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Paula Stop',
        phone: `1198${Date.now().toString().slice(-7)}`,
        email: `prospect-stop-${Date.now()}@test.com`,
        stage: 'LEAD',
        tags: [],
      },
    });

    await prisma.prospectCampaign.create({
      data: {
        id: campaignId,
        tenantId,
        name: 'Campanha Stop',
        objective: 'Validar opt-out inbound',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: [stopContact.id],
        messageTemplate: 'Oi {{first_name}}, tudo bem?',
        dailyLimit: 1,
        status: 'ACTIVE',
      },
    });

    await prisma.$executeRaw(Prisma.sql(
      `
        INSERT INTO prospecting_schema.prospect_executions (
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          'WHATSAPP',
          'CONTACTED',
          1,
          NOW(),
          NOW()
        )
      `,
      executionId,
      tenantId,
      campaignId,
      stopContact.id,
    );

    await eventBus.publish(
      new MessageReceivedIntegrationEvent(
        {
          conversationId: new UniqueEntityID().toString(),
          tenantId,
          contactId: stopContact.id,
          messageId: new UniqueEntityID().toString(),
          content: { type: 'TEXT', text: 'pare de me mandar mensagem' },
          channel: 'WHATSAPP',
        },
        `messaging:stop:${executionId}`,
      ),
    );

    let persistedExecution: Array<{ status: string; stop_reason: string | null }> = [];
    for (let i = 0; i < 20; i++) {
      persistedExecution = await prisma.$queryRaw<
        Array<{ status: string; stop_reason: string | null }>
      >(
        `
          SELECT status, stop_reason
          FROM prospecting_schema.prospect_executions
          WHERE tenant_id = $1::uuid AND id = $2::uuid
        `,
        tenantId,
        executionId,
      );

      if (persistedExecution[0]?.status === 'STOPPED') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(persistedExecution[0]?.status).toBe('STOPPED');
    expect(persistedExecution[0]?.stop_reason).toBe('OPT_OUT');
  });

  it('should forbid AGENT access and require authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/prospecting/campaigns')
      .set('Cookie', [agentCookie])
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/prospecting/campaigns')
      .expect(401);
  });
});
