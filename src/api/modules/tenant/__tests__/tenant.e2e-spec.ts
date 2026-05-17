import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/database/PrismaService';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../../shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '../../../shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { randomUUID } from 'crypto';

describe('TenantModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testCnpj = '60.701.190/0001-04'; // Known valid CNPJ
  const testEmail = 'owner-e2e@test.com';

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
    app.useGlobalInterceptors(new SuccessResponseInterceptor());

    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const existingTenant = await prisma.tenant.findUnique({
      where: { cnpj: testCnpj },
    });
    if (existingTenant) {
      await prisma.salesMetric
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.whatsAppConfig
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.aIConfig
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.tenant
        .delete({ where: { id: existingTenant.id } })
        .catch(() => {});
    }
    await prisma.user
      .deleteMany({ where: { email: testEmail } })
      .catch(() => {});
  });

  afterAll(async () => {
    const existingTenant = await prisma.tenant.findUnique({
      where: { cnpj: testCnpj },
    });
    if (existingTenant) {
      await prisma.salesMetric
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.usageRecord
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.whatsAppConfig
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.aIConfig
        .deleteMany({ where: { tenantId: existingTenant.id } })
        .catch(() => {});
      await prisma.tenant
        .delete({ where: { id: existingTenant.id } })
        .catch(() => {});
    }
    await app.close();
  });

  describe('Scenario 1: Onboarding Integration', () => {
    it('should create a tenant and provision billing subscription automatically', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .send({
          companyName: 'E2E Test Corp',
          cnpj: testCnpj,
          ownerName: 'Test Owner',
          ownerCpf: '52998224725',
          ownerEmail: testEmail,
          ownerPhone: '11999998888',
          ownerPassword: 'password123',
          plan: 'ESSENCIAL',
        });

      if (response.status !== 201) {
        throw new Error(`Creation failed: ${JSON.stringify(response.body)}`);
      }
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      const tenantId = response.body.data.id;

      let subscription: any = null;
      for (let i = 0; i < 10; i++) {
        subscription = await prisma.subscription.findUnique({
          where: { tenantId },
        });
        if (subscription) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(subscription).toBeDefined();
      expect(subscription?.plan).toBe('ESSENCIAL');
      expect(subscription?.status).toBe('ACTIVE');
    });
  });

  describe('Scenario 2 & 3: Auth-Protected Operations', () => {
    let authCookie: string[];
    let tenantId: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'password123',
        });

      if (loginRes.status !== 200) {
        console.error('Login failed in Scene 2/3:', loginRes.body);
      }
      expect(loginRes.status).toBe(200);
      authCookie = loginRes.get('Set-Cookie') || [];

      const tenant = (await prisma.tenant.findUnique({
        where: { cnpj: testCnpj },
      })) as any;
      tenantId = tenant!.id;
    });

    it('should update business data with operating hours (Scenario 3)', async () => {
      const operatingHours = {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/business-data`)
        .set('Cookie', authCookie)
        .send({
          description: 'Test business description',
          operatingHours,
        });

      expect(response.status).toBe(200);

      const updatedTenant = (await prisma.tenant.findUnique({
        where: { id: tenantId },
      })) as any;
      expect(updatedTenant?.description).toBe('Test business description');
      expect(updatedTenant?.operatingHours).toEqual(operatingHours);
    });

    it('should return tenant details with owner data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          companyName: 'E2E Test Corp',
          owner: expect.objectContaining({
            name: 'Test Owner',
            email: testEmail,
            phone: '+5511999998888',
            cpf: '529.982.247-25',
          }),
        }),
      );
    });

    it('should add promotions (Scenario 2)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/promotions`)
        .set('Cookie', authCookie)
        .send({
          title: 'BOGO Offer',
          description: 'Buy one get one free',
          value: '100% OFF',
        });

      expect(response.status).toBe(201);

      const updatedTenant = (await prisma.tenant.findUnique({
        where: { id: tenantId },
      })) as any;
      const promotions = updatedTenant?.promotions as any[];
      expect(promotions).toHaveLength(1);
      expect(promotions[0].title).toBe('BOGO Offer');
    });

    it('should fail to update business data without auth cookie', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/business-data`)
        .send({
          description: 'Hacked description',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Scenario 4: Validations and Error Handling', () => {
    it('should return 400 Bad Request when creating tenant with duplicate CNPJ', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .send({
          companyName: 'Duplicate Corp',
          cnpj: testCnpj,
          ownerName: 'Other Owner',
          ownerEmail: 'other' + randomUUID() + '@test.com',
          ownerPhone: '11999998888',
          ownerPassword: 'password123',
          plan: 'PROFISSIONAL',
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.message).toContain('already registered');
    });

    it('should return 400 Bad Request when creating tenant with invalid DTO', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .send({
          companyName: 'Invalid Corp',
          cnpj: 'invalid-cnpj',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Scenario 5: AI and WhatsApp Configurations', () => {
    let authCookie: string[];
    let tenantId: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'password123',
        });

      if (loginRes.status !== 200) {
        console.error('Login failed in Scene 5:', loginRes.body);
      }
      expect(loginRes.status).toBe(200);
      authCookie = loginRes.get('Set-Cookie') || [];

      const tenant = (await prisma.tenant.findUnique({
        where: { cnpj: testCnpj },
      })) as any;
      tenantId = tenant!.id;
    });

    it('should configure AI settings successfully', async () => {
      const aiSettings = {
        systemPrompt: 'You are a polite assistant.',
        tone: 'PROFESSIONAL',
        language: 'pt-BR',
        maxTokensPerResponse: 2000,
        confidenceThreshold: 0.8,
        escalationMessage: 'Transferindo para o suporte.',
        businessRules: ['Não dê descontos'],
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/ai-config`)
        .set('Cookie', authCookie)
        .send(aiSettings);

      expect(response.status).toBe(200);

      const updatedTenant = (await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { aiConfig: true },
      })) as any;

      expect(updatedTenant?.aiConfig).toBeDefined();
      expect(updatedTenant?.aiConfig?.systemPrompt).toBe(
        aiSettings.systemPrompt,
      );
    });

    it('should configure WhatsApp settings successfully', async () => {
      const waSettings = {
        whatsappNumber: '5511999998888',
        bubbleWhatsId: '7071',
        bubbleWhatsToken: 'tenant-token-e2e',
        bubbleWhatsApiUrl: 'https://7071.bubblewhats.com',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenantId}/whatsapp-config`)
        .set('Cookie', authCookie)
        .send(waSettings);

      expect(response.status).toBe(200);

      const updatedTenant = (await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { whatsappConfig: true },
      })) as any;

      expect(updatedTenant?.whatsappConfig).toBeDefined();
      expect(updatedTenant?.whatsappConfig?.provider).toBe('BUBBLEWHATS');
      expect(updatedTenant?.whatsappConfig?.status).toBe('ACTIVE');
    });
  });
});
