import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Prospecting reports (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let authCookie: string;

  const ownerEmail = `prospecting-reports-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `pr${Date.now()}`;

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  }

  async function waitForJobCompletion(jobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/prospecting/reports/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = response.body.status as string;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return response.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for prospecting job ${jobId}`);
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

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Reports Store',
        cnpj: tenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Prospecting Reports Owner',
        email: ownerEmail,
        phone: '11970000070',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login();
  });

  beforeEach(async () => {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM prospecting_schema.prospecting_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
    `).catch(() => {});
    await prisma.prospectExecution.deleteMany({ where: { tenantId } });
    await prisma.prospectCampaign.deleteMany({ where: { tenantId } });
    await prisma.prospectSearchResult.deleteMany({ where: { tenantId } });
    await prisma.prospectSearch.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM prospecting_schema.prospecting_async_jobs
        WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => {});
      await prisma.prospectExecution.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.prospectCampaign.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.prospectSearchResult.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.prospectSearch.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should export prospect searches with async CSV filtering', async () => {
    const baseDate = new Date('2026-04-10T12:00:00.000Z');

    const completedSearch = await prisma.prospectSearch.create({
      data: {
        tenantId,
        businessTypeQuery: 'clinica odontologica',
        city: 'Rio de Janeiro',
        state: 'RJ',
        neighborhood: 'Copacabana',
        source: 'GOOGLE_PLACES',
        maxResults: 25,
        status: 'COMPLETED',
        discoveredCount: 2,
        createdAt: baseDate,
        updatedAt: baseDate,
      },
    });

    await prisma.prospectSearchResult.createMany({
      data: [
        {
          tenantId,
          searchId: completedSearch.id,
          source: 'GOOGLE_PLACES',
          businessName: 'Odonto Centro',
          city: 'Rio de Janeiro',
          state: 'RJ',
          phone: '2133445566',
          whatsappPhone: '5521999999999',
          email: 'contato@odonto.example.com',
          createdAt: baseDate,
          updatedAt: baseDate,
        },
        {
          tenantId,
          searchId: completedSearch.id,
          source: 'GOOGLE_PLACES',
          businessName: 'Clinica Sorriso',
          city: 'Rio de Janeiro',
          state: 'RJ',
          instagramUrl: 'https://instagram.com/clinicasorriso',
          createdAt: baseDate,
          updatedAt: baseDate,
        },
      ],
    });

    await prisma.prospectSearch.create({
      data: {
        tenantId,
        businessTypeQuery: 'imobiliaria',
        city: 'Niteroi',
        state: 'RJ',
        source: 'GOOGLE_PLACES',
        maxResults: 20,
        status: 'FAILED',
        discoveredCount: 0,
        failureReason: 'quota limit',
        createdAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
    });

    const startJobResponse = await request(app.getHttpServer())
      .post('/api/v1/prospecting/reports/search-jobs')
      .set('Cookie', [authCookie])
      .send({
        query: 'clinica',
        statuses: ['COMPLETED'],
        sources: ['GOOGLE_PLACES'],
        dateFrom: '2026-04-10',
        dateTo: '2026-04-10',
      })
      .expect(202);

    const completedJob = await waitForJobCompletion(startJobResponse.body.id);
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.resultSummary).toEqual(
      expect.objectContaining({
        totalSearches: 1,
        totalDiscovered: 2,
        whatsappReadyCount: 1,
        instagramReadyCount: 1,
        emailCount: 1,
      }),
    );

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/prospecting/reports/jobs/${startJobResponse.body.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.text).toContain('clinica odontologica');
    expect(downloadResponse.text).toContain('Copacabana / Rio de Janeiro / RJ');
    expect(downloadResponse.text).not.toContain('imobiliaria');
  });

  it('should export prospect campaigns with async CSV filtering', async () => {
    const baseDate = new Date('2026-04-12T15:00:00.000Z');

    const whatsappCampaign = await prisma.prospectCampaign.create({
      data: {
        tenantId,
        name: 'Campanha Clinicas',
        objective: 'Abrir conversas com clinicas',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: ['contact-1', 'contact-2'],
        dailyLimit: 40,
        status: 'ACTIVE',
        createdAt: baseDate,
        updatedAt: baseDate,
      },
    });

    await prisma.prospectExecution.createMany({
      data: [
        {
          tenantId,
          campaignId: whatsappCampaign.id,
          contactId: 'contact-1',
          channel: 'WHATSAPP',
          status: 'CONTACTED',
          attemptCount: 1,
          createdAt: baseDate,
          updatedAt: baseDate,
        },
        {
          tenantId,
          campaignId: whatsappCampaign.id,
          contactId: 'contact-2',
          channel: 'WHATSAPP',
          status: 'RESPONDED',
          attemptCount: 1,
          createdAt: baseDate,
          updatedAt: baseDate,
        },
      ],
    });

    await prisma.prospectCampaign.create({
      data: {
        tenantId,
        name: 'Campanha Insta',
        objective: 'Rodar reengajamento no Instagram',
        audienceType: 'REENGAGEMENT',
        channel: 'INSTAGRAM',
        targetContactIds: [],
        dailyLimit: 30,
        status: 'PAUSED',
        createdAt: new Date('2026-04-13T15:00:00.000Z'),
        updatedAt: new Date('2026-04-13T15:00:00.000Z'),
      },
    });

    const startJobResponse = await request(app.getHttpServer())
      .post('/api/v1/prospecting/reports/campaign-jobs')
      .set('Cookie', [authCookie])
      .send({
        statuses: ['ACTIVE'],
        channels: ['WHATSAPP'],
        audienceTypes: ['CONTACT_LIST'],
        dateFrom: '2026-04-12',
        dateTo: '2026-04-12',
      })
      .expect(202);

    const completedJob = await waitForJobCompletion(startJobResponse.body.id);
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.resultSummary).toEqual(
      expect.objectContaining({
        totalCampaigns: 1,
        totalAudience: 2,
        totalExecutions: 2,
        contactedExecutions: 1,
        respondedExecutions: 1,
      }),
    );

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/prospecting/reports/jobs/${startJobResponse.body.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.text).toContain('Campanha Clinicas');
    expect(downloadResponse.text).toContain('Abrir conversas com clinicas');
    expect(downloadResponse.text).not.toContain('Campanha Insta');
  });
});
