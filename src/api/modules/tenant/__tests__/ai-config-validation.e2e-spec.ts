import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { Prisma } from '@prisma/client';

describe('AI Config Validation (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let ownerCookie: string;
  let agentCookie: string;
  let otherOwnerCookie: string;

  const ownerEmail = 'ai-config-val-owner@test.com';
  const agentEmail = 'ai-config-val-agent@test.com';
  const otherOwnerEmail = 'ai-config-val-other@test.com';
  const password = 'SenhaForte123!';

  function generateValidCnpj(seed: number): string {
    const base = String(seed).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce(
          (acc: number, digit: string, index: number) =>
            acc + Number(digit) * weights[index],
          0,
        );
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

  const tenantCnpj = generateValidCnpj(7770001);
  const otherTenantCnpj = generateValidCnpj(7770002);

  const validPayload = {
    systemPrompt: 'You are a helpful assistant for our store customers.',
    tone: 'PROFESSIONAL',
    language: 'pt-BR',
    maxTokensPerResponse: 500,
    confidenceThreshold: 0.7,
    escalationMessage: 'Transferring to a human agent...',
    businessRules: [
      'Always greet the customer',
      'Never share internal pricing',
    ],
  };

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  async function cleanup() {
    const tenantIds = [tenantId, otherTenantId].filter(Boolean);
    if (tenantIds.length === 0) return;

    for (const tid of tenantIds) {
      await prisma
        .$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_audit_logs WHERE tenant_id = ${tid}::uuid`,
        )
        .catch(() => {});
    }
    await prisma.aIConfig
      .deleteMany({ where: { tenantId: { in: tenantIds } } })
      .catch(() => {});
    await prisma.tenantAgentRule
      .deleteMany({ where: { tenantId: { in: tenantIds } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: { email: { in: [ownerEmail, agentEmail, otherOwnerEmail] } },
      })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({ where: { id: { in: tenantIds } } })
      .catch(() => {});
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
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

    // Clean up any leftover data
    await prisma.user
      .deleteMany({
        where: { email: { in: [ownerEmail, agentEmail, otherOwnerEmail] } },
      })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({ where: { cnpj: { in: [tenantCnpj, otherTenantCnpj] } } })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'AI Config Validation Store',
        cnpj: tenantCnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other AI Config Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'AI Config Owner',
          email: ownerEmail,
          phone: '11970000020',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId,
          name: 'AI Config Agent',
          email: agentEmail,
          phone: '11970000021',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Tenant Owner',
          email: otherOwnerEmail,
          phone: '11970000022',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    ownerCookie = await login(ownerEmail);
    agentCookie = await login(agentEmail);
    otherOwnerCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('Input Validation (DTO)', () => {
    it('should reject empty systemPrompt', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, systemPrompt: '' })
        .expect(400);
    });

    it('should reject invalid tone', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, tone: 'AGGRESSIVE' })
        .expect(400);
    });

    it('should reject confidenceThreshold > 1', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, confidenceThreshold: 1.5 })
        .expect(400);
    });

    it('should reject confidenceThreshold < 0', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, confidenceThreshold: -0.1 })
        .expect(400);
    });

    it('should reject maxTokensPerResponse > 4000', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, maxTokensPerResponse: 4001 })
        .expect(400);
    });

    it('should reject maxTokensPerResponse < 50', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, maxTokensPerResponse: 49 })
        .expect(400);
    });
  });

  describe('Domain Validation', () => {
    it('should reject systemPrompt with less than 10 characters', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send({ ...validPayload, systemPrompt: 'Short' });

      // Domain throws ValidationErrorException → GlobalExceptionFilter maps to 400
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain(
        'System prompt must have at least 10 characters',
      );
    });
  });

  describe('Persistence & Round-trip', () => {
    it('should configure AI with all fields and return 200', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send(validPayload);

      expect(response.status).toBe(200);
    });

    it('should return all AI config fields in GET /settings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/settings`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      // Handle potential double-wrapping from SuccessResponseInterceptor
      const data =
        response.body.data?.data || response.body.data || response.body;
      expect(data.aiConfig).toBeDefined();
      expect(data.aiConfig.systemPrompt).toBe(validPayload.systemPrompt);
      expect(data.aiConfig.tone).toBe(validPayload.tone);
      expect(data.aiConfig.language).toBe(validPayload.language);
      expect(data.aiConfig.maxTokensPerResponse).toBe(
        validPayload.maxTokensPerResponse,
      );
      expect(data.aiConfig.confidenceThreshold).toBe(
        validPayload.confidenceThreshold,
      );
      expect(data.aiConfig.escalationMessage).toBe(
        validPayload.escalationMessage,
      );
      expect(data.aiConfig.businessRules).toEqual(validPayload.businessRules);
    });

    it('should persist updated config when called again (idempotent)', async () => {
      const updatedPayload = {
        ...validPayload,
        tone: 'CASUAL',
        maxTokensPerResponse: 1000,
        language: 'en-US',
        escalationMessage: 'Please wait for a human.',
        businessRules: ['New rule'],
      };

      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send(updatedPayload)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/settings`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      const data =
        response.body.data?.data || response.body.data || response.body;
      expect(data.aiConfig.tone).toBe('CASUAL');
      expect(data.aiConfig.maxTokensPerResponse).toBe(1000);
      expect(data.aiConfig.language).toBe('en-US');
      expect(data.aiConfig.escalationMessage).toBe('Please wait for a human.');
      expect(data.aiConfig.businessRules).toEqual(['New rule']);
    });
  });

  describe('Audit Trail', () => {
    it('should record AI_CONFIG_UPDATED in audit logs after config change', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send(validPayload)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/settings`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      const data =
        response.body.data?.data || response.body.data || response.body;
      expect(data.recentAuditLogs).toBeDefined();
      expect(Array.isArray(data.recentAuditLogs)).toBe(true);

      const aiConfigLog = data.recentAuditLogs.find(
        (log: any) => log.eventType === 'AI_CONFIG_UPDATED',
      );
      expect(aiConfigLog).toBeDefined();
      expect(aiConfigLog.metadata).toBeDefined();
      expect(aiConfigLog.metadata.tone).toBe(validPayload.tone);
    });
  });

  describe('Security & Tenant Isolation', () => {
    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .send(validPayload)
        .expect(401);
    });

    it('should return 403 for AGENT role', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', [agentCookie])
        .send(validPayload)
        .expect(403);
    });

    it('should return 401 for cross-tenant access', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${otherTenantId}/ai-config`)
        .set('Cookie', [ownerCookie])
        .send(validPayload)
        .expect(401);
    });
  });
});
