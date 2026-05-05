import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';

describe('Tenant agent rules (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookies: string[];

  const seed = Date.now();
  const ownerEmail = `agent-rules-${seed}@test.com`;
  const otherOwnerEmail = `agent-rules-other-${seed}@test.com`;
  const password = 'SenhaForte123!';
  const branchId = randomUUID();

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!;
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

    const passwordHash = await bcrypt.hash(password, 10);
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Agent Rules Store',
        cnpj: `ar${String(seed).slice(-12)}`,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Agent Rules Other Store',
        cnpj: `ao${String(seed).slice(-12)}`,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Agent Rules Owner',
          email: ownerEmail,
          phone: '11971000001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11971000002',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    authCookies = await login(ownerEmail);
  });

  afterAll(async () => {
    if (prisma) {
      for (const id of [tenantId, otherTenantId].filter(Boolean)) {
        await prisma
          .$executeRaw(Prisma.sql`
            DELETE FROM tenant_schema.tenant_agent_rule_history
            WHERE tenant_id = ${id}::uuid
          `)
          .catch(() => { });
        await prisma
          .$executeRaw(Prisma.sql`
            DELETE FROM tenant_schema.tenant_agent_rules
            WHERE tenant_id = ${id}::uuid
          `)
          .catch(() => { });
      }
      await prisma.user
        .deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } })
        .catch(() => { });
      await prisma.tenant
        .deleteMany({ where: { id: { in: [tenantId, otherTenantId].filter(Boolean) } } })
        .catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should persist tenant and branch scoped module rules with revision history', async () => {
    const globalRuleResponse = await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/agent-rules/messaging`)
      .set('Cookie', authCookies)
      .send({
        customPrompt:
          'Responder com mensagens curtas, confirmar entendimento e sugerir o proximo passo.',
        isActive: true,
        fallbackToGlobal: true,
        notes: 'Regra global criada pelo e2e',
      })
      .expect(200);

    expect(globalRuleResponse.body).toEqual(
      expect.objectContaining({
        tenantId,
        moduleId: 'messaging',
        branchId: null,
        revision: 1,
        customPrompt: expect.stringContaining('Responder com mensagens curtas'),
      }),
    );

    const inheritedResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/agent-rules/messaging?branchId=${branchId}`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(inheritedResponse.body).toEqual(
      expect.objectContaining({
        tenantId,
        moduleId: 'messaging',
        branchId: null,
        inheritedFromTenant: true,
      }),
    );

    const branchRuleResponse = await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/agent-rules/messaging?branchId=${branchId}`)
      .set('Cookie', authCookies)
      .send({
        customPrompt:
          'Nesta filial, priorizar handoff humano quando houver reclamação ou cancelamento.',
        isActive: true,
        fallbackToGlobal: false,
        notes: 'Regra de filial criada pelo e2e',
      })
      .expect(200);

    expect(branchRuleResponse.body).toEqual(
      expect.objectContaining({
        tenantId,
        moduleId: 'messaging',
        branchId,
        revision: 1,
        fallbackToGlobal: false,
        customPrompt: expect.stringContaining('priorizar handoff humano'),
      }),
    );

    const exactBranchResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/agent-rules/messaging?branchId=${branchId}`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(exactBranchResponse.body).toEqual(
      expect.objectContaining({
        tenantId,
        moduleId: 'messaging',
        branchId,
        inheritedFromTenant: false,
      }),
    );

    const historyRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM tenant_schema.tenant_agent_rule_history
      WHERE tenant_id = ${tenantId}::uuid
        AND module_id = 'messaging'
    `);

    expect(Number(historyRows[0]?.total ?? 0)).toBe(2);
  });

  it('should reject cross-tenant access to agent rules', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/agent-rules/messaging`)
      .set('Cookie', authCookies)
      .expect(403);

    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${otherTenantId}/agent-rules/messaging`)
      .set('Cookie', authCookies)
      .send({
        customPrompt: 'Tentativa cross tenant com prompt suficientemente longo.',
      })
      .expect(403);
  });

  it('should accept recovery module rules for tenant customization flows', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/agent-rules/recovery`)
      .set('Cookie', authCookies)
      .send({
        customPrompt:
          'Use tom cordial, informe o título pendente e ofereça caminhos claros para regularização.',
        isActive: true,
        fallbackToGlobal: true,
        notes: 'Regra de recovery criada pelo e2e',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        tenantId,
        moduleId: 'recovery',
        branchId: null,
        revision: 1,
      }),
    );
  });
});
