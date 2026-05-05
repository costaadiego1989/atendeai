import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { ContactAsyncJobStatus } from '../../contact/application/services/ContactAsyncJobsService';

describe('ContactController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let baseContactId: string;

  const ownerEmail = 'contact-controller-owner@test.com';
  const otherOwnerEmail = 'contact-controller-other@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = `cc${Date.now()}`;
  const otherTenantCnpj = `cc${Date.now() + 1}`;

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  async function waitForJobCompletion(jobId: string): Promise<any> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/contacts/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = response.body.status as ContactAsyncJobStatus;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return response.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for job ${jobId}`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    prisma = app.get(PrismaService);

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [ownerEmail, otherOwnerEmail],
          },
        },
      })
      .catch(() => { });

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Contact Controller Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Contact Controller Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Contact Owner',
          email: ownerEmail,
          phone: '11970000030',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Contact Owner',
          email: otherOwnerEmail,
          phone: '11970000031',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    authCookie = await login(ownerEmail);

    const baseContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Base Contact',
        phone: '5511999991000',
        stage: 'LEAD',
        tags: ['vip'],
        notes: 'Lead inicial',
      },
    });
    baseContactId = baseContact.id;

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: baseContactId,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { type: 'TEXT', text: 'Mensagem inicial' },
        sentBy: 'CONTACT',
        externalId: `contact-controller-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
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
    await prisma.subscription
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => { });
    await prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM contact_schema.contact_async_jobs
        WHERE tenant_id IN (${Prisma.join(
        [tenantId, otherTenantId]
          .filter(Boolean)
          .map((id) => Prisma.sql`${id}::uuid`),
      )})
      `,
    ).catch(() => { });
    await prisma.user
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
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
  });

  it('should create and list contacts with filters', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Created Contact',
        phone: '5511999991001',
        document: '12345678901',
        email: 'created-contact@test.com',
        tags: ['vip', 'hot'],
        notes: 'Criado via controller',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts?page=1&limit=10&tag=vip`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
      }),
    );
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should get, update and delete a contact', async () => {
    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${baseContactId}`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(getResponse.body.id).toBe(baseContactId);

    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantId}/contacts/${baseContactId}`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Base Contact Updated',
        notes: 'Atualizado via e2e',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts/${baseContactId}/delete`)
      .set('Cookie', [authCookie])
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${baseContactId}`)
      .set('Cookie', [authCookie])
      .expect(404);
  });

  it('should return timeline and validate stage payloads', async () => {
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Timeline Contact',
        phone: '5511999991002',
        stage: 'LEAD',
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'PENDING_HUMAN',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { type: 'TEXT', text: 'Mensagem timeline' },
        sentBy: 'CONTACT',
        externalId: `contact-controller-timeline-${Date.now()}`,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${contact.id}/timeline`)
      .set('Cookie', [authCookie])
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantId}/contacts/${contact.id}/stage`)
      .set('Cookie', [authCookie])
      .send({ stage: 'INVALID_STAGE' })
      .expect(400);
  });

  it('should return 404 for missing contacts and reject cross-tenant access', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${randomUUID()}`)
      .set('Cookie', [authCookie])
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/contacts`)
      .set('Cookie', [authCookie])
      .expect(401);
  });

  it('should import contacts in bulk and update duplicates by phone', async () => {
    const existing = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Existing Import Contact',
        phone: '5511999992010',
        stage: 'LEAD',
        tags: ['legacy'],
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts/import`)
      .set('Cookie', [authCookie])
      .send({
        rawText: [
          'Nome; Telefone; Documento; Email; Tags; Observacoes',
          'Novo Contato; 5511999992011; 12345678901; novo@test.com; vip|quente; origem planilha',
          'Atualizado Import; 5511999992010; 98765432100; atualizado@test.com; recorrente|vip; ajuste',
        ].join('\n'),
        defaultStage: 'PROSPECT',
        defaultTags: ['campanha-abril'],
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        totalRows: 2,
        created: 1,
        updated: 1,
        failed: 0,
      }),
    );

    const created = await prisma.contact.findFirst({
      where: {
        tenantId,
        phone: '5511999992011',
      },
    });
    expect(created).toEqual(
      expect.objectContaining({
        name: 'Novo Contato',
        email: 'novo@test.com',
        stage: 'PROSPECT',
      }),
    );
    expect(created?.tags ?? []).toEqual(
      expect.arrayContaining(['campanha-abril', 'vip', 'quente']),
    );

    const updated = await prisma.contact.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id: existing.id,
        },
      },
    });
    expect(updated).toEqual(
      expect.objectContaining({
        name: 'Atualizado Import',
        email: 'atualizado@test.com',
        stage: 'PROSPECT',
      }),
    );
    expect(updated?.tags ?? []).toEqual(
      expect.arrayContaining(['legacy', 'campanha-abril', 'recorrente', 'vip']),
    );
  });

  it('should generate contact reports with timeline filters', async () => {
    const reportContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Report Contact',
        phone: '5511999992020',
        stage: 'OPPORTUNITY',
        tags: ['vip', 'relatorio'],
        lastInteraction: new Date(),
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: reportContact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          direction: 'INBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Oi, quero saber mais' },
          sentBy: 'CONTACT',
          externalId: `contact-report-inbound-${Date.now()}`,
        },
        {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Claro, posso te ajudar' },
          sentBy: 'HUMAN',
          externalId: `contact-report-outbound-${Date.now() + 1}`,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts/reports`)
      .set('Cookie', [authCookie])
      .send({
        stages: ['OPPORTUNITY'],
        tags: ['relatorio'],
        timelineTypes: ['MESSAGING'],
        channels: ['WHATSAPP'],
      })
      .expect(200);

    expect(response.body.summary).toEqual(
      expect.objectContaining({
        totalContacts: expect.any(Number),
        contactsWithTimelineMatch: expect.any(Number),
        totalTimelineEvents: expect.any(Number),
      }),
    );
    expect(response.body.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reportContact.id,
          name: 'Report Contact',
          stage: 'OPPORTUNITY',
          channels: expect.arrayContaining(['WHATSAPP']),
          timelineTypes: expect.arrayContaining(['MESSAGING']),
        }),
      ]),
    );
  });

  it('should enqueue async import and export jobs, then download the csv', async () => {
    const importStart = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts/import-jobs`)
      .set('Cookie', [authCookie])
      .send({
        rawText: [
          'Nome; Telefone; Documento; Email; Tags; Observacoes',
          'Fila Async; 5511999992099; 12345678901; fila@test.com; fila|vip; criado via job',
        ].join('\n'),
        defaultStage: 'LEAD',
        defaultTags: ['fila-job'],
      })
      .expect(202);

    expect(importStart.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'IMPORT_CONTACTS',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const importJob = await waitForJobCompletion(importStart.body.id);
    expect(importJob.status).toBe('COMPLETED');
    expect(importJob.resultSummary).toEqual(
      expect.objectContaining({
        created: 1,
      }),
    );

    const exportStart = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts/report-jobs`)
      .set('Cookie', [authCookie])
      .send({
        stages: ['LEAD'],
        tags: ['fila-job'],
        timelineTypes: [],
        channels: [],
      })
      .expect(202);

    expect(exportStart.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'EXPORT_CONTACTS_CSV',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const exportJob = await waitForJobCompletion(exportStart.body.id);
    expect(exportJob.status).toBe('COMPLETED');
    expect(exportJob.fileName).toContain('relatorio-contatos-');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/jobs/${exportJob.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.header['content-type']).toContain('text/csv');
    expect(downloadResponse.text).toContain('Fila Async');
  });
});
