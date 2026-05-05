import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/database/PrismaService';
import * as cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '../../../shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '../../../shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { Prisma } from '@prisma/client';

describe('Tenant WhatsApp Connection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testCnpj = '60.701.190/0001-04'; // Reliable valid CNPJ
  const testEmail = 'owner-wa-conn-e2e@test.com';
  let authCookie: string[];
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup(prisma, testCnpj, testEmail);

    // Setup Tenant and User
    const createRes = await request(app.getHttpServer()).post('/api/v1/tenants').send({
      companyName: 'WA Conn Test Corp',
      cnpj: testCnpj,
      ownerName: 'Test Owner',
      ownerEmail: testEmail,
      ownerPhone: '11999998888',
      ownerPassword: 'password123',
      plan: 'PROFISSIONAL',
    });

    if (createRes.status !== 201) {
      console.error('Tenant setup failed:', createRes.status, JSON.stringify(createRes.body));
      throw new Error(`Tenant creation failed`);
    }

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: testEmail, password: 'password123' });
    
    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    authCookie = loginRes.get('Set-Cookie') || [];
    const tenant = await prisma.tenant.findUnique({ where: { cnpj: testCnpj } });
    tenantId = tenant!.id;
  });

  async function cleanup(prisma: PrismaService, cnpj: string, email: string) {
    const tenant = await prisma.tenant.findUnique({ where: { cnpj } });
    if (tenant) {
      const tid = tenant.id;
      await prisma.$executeRaw(Prisma.sql`DELETE FROM tenant_schema.tenant_audit_logs WHERE tenant_id = ${tid}::uuid`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM tenant_schema.tenant_branches WHERE tenant_id = ${tid}::uuid`);
      await prisma.whatsAppConfig.deleteMany({ where: { tenantId: tid } });
      await prisma.aIConfig.deleteMany({ where: { tenantId: tid } });
      await prisma.tenantAgentRule.deleteMany({ where: { tenantId: tid } });
      await prisma.user.deleteMany({ where: { tenantId: tid } });
      await prisma.tenant.delete({ where: { id: tid } });
    }
    await prisma.user.deleteMany({ where: { email } });
  }

  afterAll(async () => {
    if (tenantId) {
      await cleanup(prisma, testCnpj, testEmail);
    }
    await app.close();
  });

  it('should return whatsapp connection and embedded signup info', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/whatsapp-connection`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    // Handle double-wrapping
    const data = response.body.data?.data || response.body.data;
    expect(data).toHaveProperty('isConnected');
    expect(data.isConnected).toBe(false);
    expect(data).toHaveProperty('embeddedSignupInfo');
  });
});
