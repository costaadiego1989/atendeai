import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { InstagramConfig } from '../domain/entities/InstagramConfig';
import { AIConfig } from '../domain/entities/AIConfig';
import { Address } from '../domain/value-objects/Address';
import { Promotion } from '../domain/value-objects/Promotion';
import { randomUUID } from 'crypto';

describe('PrismaTenantRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: ITenantRepository;
  const tenantIds: string[] = [];
  const tenantCnpjs: string[] = [];

  function generateValidCnpj(seed: number): string {
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

  function makeTenant(seed: number) {
    const cnpj = generateValidCnpj(seed);
    tenantCnpjs.push(cnpj.replace(/\D/g, ''));

    const tenant = Tenant.create({
      companyName: CompanyName.create(`Tenant ${seed}`),
      cnpj: CNPJ.create(cnpj),
      plan: Plan.create('PROFISSIONAL'),
      users: [
        User.create({
          name: 'Owner Name',
          email: Email.create(`owner-${seed}@tenant.com`),
          phone: Phone.create(`1199999${String(seed).slice(-4)}`),
          passwordHash: 'hashed-password',
          role: Role.create('OWNER'),
        }),
      ],
      promotions: [
        Promotion.create({
          title: 'Promo valida',
          description: 'Descrição longa da promo valida',
          value: '10%',
        }),
      ],
      apiKey: randomUUID(),
    });

    tenant.updateBusinessData({
      businessType: 'Loja',
      description: 'Venda de calcados',
      services: 'Atendimento online',
      address: Address.create({
        zipcode: '01001-000',
        street: 'Rua A',
        streetNumber: '100',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
      }),
      catalogUrl: 'https://catalog.test',
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
      },
    });
    tenant.clearEvents();

    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: `bw-id-${seed}`,
        token: `bw-token-${seed}`,
        apiUrl: `https://${seed}.bubblewhats.com`,
      },
      whatsappNumber: `5511999${String(seed).slice(-6)}`,
      webhookSecret: `secret-${seed}`,
    });
    whatsAppConfig.activate();
    tenant.configureWhatsApp(whatsAppConfig);
    const instagramConfig = InstagramConfig.create({
      metaAccessToken: `meta-token-${seed}`,
      instagramAccountId: `1784140000${seed}`,
      webhookSecret: `ig-secret-${seed}`,
    });
    instagramConfig.activate();
    tenant.configureInstagram(instagramConfig);
    tenant.configureAI(
      AIConfig.create({
        systemPrompt: `Prompt grande o suficiente ${seed}`,
        tone: 'FRIENDLY',
        language: 'pt-BR',
        maxTokensPerResponse: 500,
        confidenceThreshold: 0.7,
        escalationMessage: null,
        businessRules: ['não inventar informações'],
      }),
    );
    tenant.clearEvents();

    return tenant;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    await prisma.tenant
      .deleteMany({
        where: {
          users: {
            none: {},
          },
        },
      })
      .catch(() => {});
  });

  afterAll(async () => {
    if (tenantIds.length > 0) {
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.aIConfig
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM tenant_schema.instagram_configs WHERE tenant_id = ANY(${tenantIds}::uuid[])
      `,
        )
        .catch(() => {});
      await prisma.whatsAppConfig
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { tenantId: { in: tenantIds } } })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: { in: tenantIds } } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should save and load a tenant with relations and business data', async () => {
    const tenant = makeTenant(1001);
    tenantIds.push(tenant.id.toValue());

    await repository.save(tenant);

    const result = await repository.findById(tenant.id.toValue());

    expect(result).not.toBeNull();
    expect(result?.companyName.value).toBe('Tenant 1001');
    expect(result?.owner?.email.value).toBe('owner-1001@tenant.com');
    expect(result?.whatsAppConfig?.status).toBe('ACTIVE');
    expect(result?.whatsAppConfig?.provider).toBe('BUBBLEWHATS');
    expect(result?.instagramConfig?.status).toBe('ACTIVE');
    expect(result?.instagramConfig?.instagramAccountId).toBe('17841400001001');
    expect(result?.aiConfig?.systemPrompt).toContain('1001');
    expect(result?.businessType).toBe('Loja');
    expect(result?.address?.city).toBe('Sao Paulo');
    expect(result?.promotions[0]?.title).toBe('Promo valida');
  });

  it('should support lookup by cnpj, whatsapp number, apiKey, pagination and existence', async () => {
    const tenant = makeTenant(1002);
    tenantIds.push(tenant.id.toValue());
    await repository.save(tenant);

    const byCnpj = await repository.findByCnpj(tenant.cnpj.value);
    const byWhatsApp = await repository.findByWhatsAppNumber(
      tenant.whatsAppConfig!.whatsappNumber,
    );
    const byApiKey = await repository.findByApiKey(tenant.apiKey);
    const list = await repository.findAll(1, 10);
    const exists = await repository.exists(tenant.cnpj.value);

    expect(byCnpj?.id.toValue()).toBe(tenant.id.toValue());
    expect(byWhatsApp?.id.toValue()).toBe(tenant.id.toValue());
    expect(byApiKey?.id.toValue()).toBe(tenant.id.toValue());
    expect(list.total).toBeGreaterThanOrEqual(2);
    expect(
      list.data.some((item) => item.id.toValue() === tenant.id.toValue()),
    ).toBe(true);
    expect(exists).toBe(true);
  });

  it('should manage branches correctly', async () => {
    const tenant = makeTenant(1003);
    tenantIds.push(tenant.id.toValue());
    await repository.save(tenant);

    const initialBranches = await repository.listBranches(tenant.id.toValue());
    expect(initialBranches).toHaveLength(0);

    const branch1 = await repository.createBranch({
      tenantId: tenant.id.toValue(),
      name: 'Branch Headquarters',
      cnpj: '12345678000195',
      isHeadquarters: true,
      active: true,
    });

    expect(branch1.id).toBeDefined();
    expect(branch1.name).toBe('Branch Headquarters');
    expect(branch1.isHeadquarters).toBe(true);

    const branch2 = await repository.createBranch({
      tenantId: tenant.id.toValue(),
      name: 'Branch Secondary',
      cnpj: '12345678000196',
      isHeadquarters: false,
      active: true,
      operatingHours: { monday: { open: '09:00', close: '18:00' } },
    });

    expect(branch2.isHeadquarters).toBe(false);

    const branches = await repository.listBranches(tenant.id.toValue());
    expect(branches).toHaveLength(2);
    expect(branches[0].id.toValue()).toBe(branch1.id.toValue());
    expect(branches[1].id.toValue()).toBe(branch2.id.toValue());
    expect(branches[1].operatingHours).toEqual({
      monday: { open: '09:00', close: '18:00' },
    });

    await repository.updateBranch(branch2.id.toValue(), {
      tenantId: tenant.id.toValue(),
      name: 'Branch Secondary V2',
      cnpj: branch2.cnpj,
      isHeadquarters: true,
      active: branch2.active,
    });

    const updatedBranches = await repository.listBranches(tenant.id.toValue());
    expect(updatedBranches).toHaveLength(2);
    expect(updatedBranches[0].id.toValue()).toBe(branch2.id.toValue());
    expect(updatedBranches[0].name).toBe('Branch Secondary V2');
    expect(updatedBranches[0].isHeadquarters).toBe(true);
    expect(updatedBranches[1].id.toValue()).toBe(branch1.id.toValue());
    expect(updatedBranches[1].isHeadquarters).toBe(false);

    await repository.deleteBranch(tenant.id.toValue(), branch1.id.toValue());
    const finalBranches = await repository.listBranches(tenant.id.toValue());
    expect(finalBranches).toHaveLength(1);
    expect(finalBranches[0].id.toValue()).toBe(branch2.id.toValue());
  });
});
