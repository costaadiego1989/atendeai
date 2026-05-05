import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ConfigModule } from '@nestjs/config';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { PrismaProspectCampaignRepository } from '../infrastructure/persistence/repositories/PrismaProspectCampaignRepository';

describe('PrismaProspectCampaignRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IProspectCampaignRepository;
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

  function makeCampaign(
    tenant: string,
    name: string,
    audienceType: 'REENGAGEMENT' | 'CONTACT_LIST',
    targetContactIds?: string[],
  ) {
    return ProspectCampaign.create({
      tenantId: TenantId.create(tenant),
      name,
      objective: `${name} objective`,
      audienceType: ProspectAudienceTypeVO.create(audienceType),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds,
      messageTemplate: `Template for ${name}`,
      dailyLimit: 25,
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
          provide: PROSPECT_CAMPAIGN_REPOSITORY,
          useClass: PrismaProspectCampaignRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IProspectCampaignRepository>(
      PROSPECT_CAMPAIGN_REPOSITORY,
    );

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

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Repository Store',
        cnpj: makeValidCnpj(Date.now()),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Prospecting Repository Other Store',
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

  it('should save and recover a campaign inside the tenant scope', async () => {
    const campaign = makeCampaign(
      tenantId,
      'Reativação de Leads',
      'REENGAGEMENT',
    );

    await repository.save(campaign);

    const result = await repository.findById(
      tenantId,
      campaign.id.toString(),
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Reativação de Leads');
    expect(result?.status.value).toBe('DRAFT');
    expect(result?.audienceType.value).toBe('REENGAGEMENT');
    expect(result?.messageTemplate).toContain('Template');
  });

  it('should list only campaigns from the requested tenant ordered by creation date', async () => {
    const olderCampaign = makeCampaign(
      tenantId,
      'Campanha Antiga',
      'CONTACT_LIST',
      ['contact-1', 'contact-2'],
    );
    await repository.save(olderCampaign);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const newerCampaign = makeCampaign(
      tenantId,
      'Campanha Nova',
      'REENGAGEMENT',
    );
    await repository.save(newerCampaign);

    const otherTenantCampaign = makeCampaign(
      otherTenantId,
      'Campanha Outro Tenant',
      'REENGAGEMENT',
    );
    await repository.save(otherTenantCampaign);

    const result = await repository.findAllByTenant(tenantId);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]?.name).toBe('Campanha Nova');
    expect(
      result.some((campaign) => campaign.name === 'Campanha Outro Tenant'),
    ).toBe(false);
  });
});
