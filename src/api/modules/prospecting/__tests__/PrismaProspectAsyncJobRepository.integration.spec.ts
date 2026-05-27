import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ConfigModule } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  IProspectAsyncJobRepository,
  PROSPECT_ASYNC_JOB_REPOSITORY,
} from '../domain/repositories/IProspectAsyncJobRepository';
import { PrismaProspectAsyncJobRepository } from '../infrastructure/persistence/repositories/PrismaProspectAsyncJobRepository';

describe('PrismaProspectAsyncJobRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IProspectAsyncJobRepository;
  let tenantId: string;
  let otherTenantId: string;

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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        DatabaseModule,
      ],
      providers: [
        {
          provide: PROSPECT_ASYNC_JOB_REPOSITORY,
          useClass: PrismaProspectAsyncJobRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IProspectAsyncJobRepository>(
      PROSPECT_ASYNC_JOB_REPOSITORY,
    );

    await prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS prospecting_schema`);
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS prospecting_schema.prospecting_async_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        type VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
        requested_by_user_id UUID NULL,
        requested_by_user_email VARCHAR(255) NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        progress INTEGER NOT NULL DEFAULT 0,
        total_items INTEGER NOT NULL DEFAULT 0,
        processed_items INTEGER NOT NULL DEFAULT 0,
        result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        file_name VARCHAR(255) NULL,
        file_mime_type VARCHAR(120) NULL,
        file_url TEXT NULL,
        file_content TEXT NULL,
        error_message TEXT NULL,
        queue_job_id VARCHAR(120) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NULL,
        failed_at TIMESTAMPTZ NULL
      )
    `);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Async Jobs Repository Store',
        cnpj: makeValidCnpj(Date.now()),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Async Jobs Repository Other Store',
        cnpj: makeValidCnpj(Date.now() + 1),
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma
      .$executeRaw(Prisma.sql`
        DELETE FROM prospecting_schema.prospecting_async_jobs
        WHERE tenant_id IN (${tenantId}::uuid, ${otherTenantId}::uuid)
      `)
      .catch(() => {});
    await prisma.subscription
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({
        where: { id: { in: [tenantId, otherTenantId].filter(Boolean) } },
      })
      .catch(() => {});

    if (app) {
      await app.close();
    }
  });

  it('creates and recovers a job inside the tenant scope', async () => {
    const created = await repository.create({
      tenantId,
      type: 'EXPORT_PROSPECT_SEARCHES_CSV',
      payload: { foo: 'bar' },
    });

    expect(created.tenantId).toBe(tenantId);
    expect(created.status).toBe('QUEUED');

    const found = await repository.findOne(tenantId, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('does not return a job from another tenant', async () => {
    const created = await repository.create({
      tenantId,
      type: 'EXPORT_PROSPECT_CAMPAIGNS_CSV',
      payload: {},
    });

    const crossTenant = await repository.findOne(otherTenantId, created.id);
    expect(crossTenant).toBeNull();

    const list = await repository.findByTenant(otherTenantId);
    expect(list.some((job) => job.id === created.id)).toBe(false);
  });

  it('exposes a completed job download payload only to its tenant', async () => {
    const created = await repository.create({
      tenantId,
      type: 'EXPORT_PROSPECT_SEARCHES_CSV',
      payload: {},
    });

    await repository.complete(tenantId, created.id, {
      processedItems: 1,
      totalItems: 1,
      fileName: 'report.csv',
      fileMimeType: 'text/csv;charset=utf-8',
      fileContent: 'a;b',
    });

    const payload = await repository.getDownloadPayload(tenantId, created.id);
    expect(payload?.fileName).toBe('report.csv');
    expect(payload?.fileContent).toBe('a;b');

    const crossTenantPayload = await repository.getDownloadPayload(
      otherTenantId,
      created.id,
    );
    expect(crossTenantPayload).toBeNull();
  });
});
