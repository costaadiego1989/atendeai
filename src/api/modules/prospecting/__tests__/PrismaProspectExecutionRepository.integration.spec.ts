import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../domain/repositories/IProspectExecutionRepository';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { ProspectStopReasonVO } from '../domain/value-objects/ProspectStopReason';
import { PrismaProspectExecutionRepository } from '../infrastructure/persistence/repositories/PrismaProspectExecutionRepository';

describe('PrismaProspectExecutionRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IProspectExecutionRepository;
  let tenantId: string;
  let otherTenantId: string;
  let campaignId: string;
  let otherCampaignId: string;

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

  function makeExecution(
    tenant: string,
    campaign: string,
    contactId: string,
  ): ProspectExecution {
    return ProspectExecution.create({
      tenantId: TenantId.create(tenant),
      campaignId: new UniqueEntityID(campaign),
      contactId,
      channel: ProspectChannelVO.create('WHATSAPP'),
    });
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
          provide: PROSPECT_EXECUTION_REPOSITORY,
          useClass: PrismaProspectExecutionRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IProspectExecutionRepository>(
      PROSPECT_EXECUTION_REPOSITORY,
    );

    await prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS prospecting_schema`);
    await prisma.$executeRaw(Prisma.sql`
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
    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE prospecting_schema.prospect_executions
      ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(30) NULL
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS prospect_executions_tenant_campaign_contact_key
      ON prospecting_schema.prospect_executions (tenant_id, campaign_id, contact_id)
    `);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Execution Repository Store',
        cnpj: makeValidCnpj(Date.now()),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Execution Repository Other Store',
        cnpj: makeValidCnpj(Date.now() + 1),
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    campaignId = new UniqueEntityID().toString();
    otherCampaignId = new UniqueEntityID().toString();
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM prospecting_schema.prospect_executions WHERE tenant_id = ${tenantId}::uuid OR tenant_id = ${otherTenantId}::uuid`,
    ).catch(() => { });
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

    if (app) {
      await app.close();
    }
  });

  it('should save executions and list them by campaign inside the tenant scope', async () => {
    const firstExecution = makeExecution(tenantId, campaignId, 'contact-a');
    const secondExecution = makeExecution(tenantId, campaignId, 'contact-b');

    await repository.saveMany([firstExecution, secondExecution]);

    const result = await repository.findAllByCampaign(tenantId, campaignId);

    expect(result).toHaveLength(2);
    expect(result.map((execution) => execution.contactId)).toEqual([
      'contact-a',
      'contact-b',
    ]);
    expect(result[0]?.status.value).toBe('PENDING');
  });

  it('should persist the stop reason when an execution is stopped', async () => {
    const execution = makeExecution(tenantId, campaignId, 'contact-stop-reason');
    execution.markAsContacted();
    execution.markAsStopped(ProspectStopReasonVO.create('OPT_OUT'));

    await repository.save(execution);

    const persisted = await repository.findById(
      tenantId,
      execution.id.toString(),
    );

    expect(persisted?.status.value).toBe('STOPPED');
    expect(persisted?.stopReason?.value).toBe('OPT_OUT');
  });

  it('should ignore duplicate contact executions for the same tenant and campaign', async () => {
    const execution = makeExecution(tenantId, otherCampaignId, 'contact-a');

    await repository.saveMany([execution, execution]);

    const result = await repository.findAllByCampaign(tenantId, otherCampaignId);

    expect(result).toHaveLength(1);
  });

  it('should isolate executions by tenant and campaign', async () => {
    const tenantExecution = makeExecution(tenantId, campaignId, 'contact-scope-1');
    const otherTenantExecution = makeExecution(
      otherTenantId,
      campaignId,
      'contact-scope-2',
    );

    await repository.saveMany([tenantExecution, otherTenantExecution]);

    const result = await repository.findAllByCampaign(tenantId, campaignId);

    expect(
      result.some((execution) => execution.contactId === 'contact-scope-2'),
    ).toBe(false);
  });
});
