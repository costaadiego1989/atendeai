import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Trial Signup Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testPassword = 'Password123!';
  const testCpf = '529.982.247-25';
  const workingCnpj = '60.701.190/0001-04';

  async function cleanupAllTestData() {
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { cnpj: workingCnpj },
          { companyName: { startsWith: 'Trial Company' } },
        ],
      },
    });

    for (const tenant of tenants) {
      const tenantId = tenant.id;
      await prisma.usageRecord
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).user
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).whatsappConfig
        ?.deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).aiConfig
        ?.deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).tenantAgentRule
        ?.deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma as any).tenantFinancialAccount
        ?.deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanupAllTestData();
  });

  afterAll(async () => {
    await cleanupAllTestData();
    await app.close();
  });

  it('should complete trial signup and allow accessing billing usage', async () => {
    const email = `trial-1-${Date.now()}@test.com`;
    const signupResponse = await request(app.getHttpServer())
      .post('/api/v1/public/payments/trial/signup')
      .send({
        name: 'Trial User',
        email: email,
        password: testPassword,
        companyName: 'Trial Company 1',
        cnpj: workingCnpj,
        phone: '11999998888',
        plan: 'PROFISSIONAL',
        nicheCode: 'RETAIL',
        cpf: testCpf,
      });

    expect(signupResponse.status).toBe(201);
    const tenantId = signupResponse.body.tenantId;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email, password: testPassword })
      .expect(200);

    const authCookie = loginResponse.get('Set-Cookie') || [];
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/usage`)
      .set('Cookie', authCookie as any)
      .expect(200);
  });

  it('should block login when trial is expired', async () => {
    const email = `trial-2-${Date.now()}@test.com`;
    const signupResponse = await request(app.getHttpServer())
      .post('/api/v1/public/payments/trial/signup')
      .send({
        name: 'Expired User',
        email: email,
        password: testPassword,
        companyName: 'Trial Company 2',
        cnpj: workingCnpj,
        phone: '11999998887',
        plan: 'ESSENCIAL',
        nicheCode: 'RETAIL',
        cpf: testCpf,
      });

    expect(signupResponse.status).toBe(201);
    const tenantId = signupResponse.body.tenantId;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { planStatus: 'TRIAL_EXPIRED' },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: email,
        password: testPassword,
      });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error.code).toBe('TRIAL_EXPIRED');
    expect(loginResponse.body.error.message).toContain(
      'Seu período de teste (7 dias) expirou',
    );
  });

  it('should block route access using SubscriptionActiveGuard when trial is expired', async () => {
    const email = `trial-3-${Date.now()}@test.com`;
    const signupResponse = await request(app.getHttpServer())
      .post('/api/v1/public/payments/trial/signup')
      .send({
        name: 'Route Blocked User',
        email: email,
        password: testPassword,
        companyName: 'Trial Company 3',
        cnpj: workingCnpj,
        phone: '11999998886',
        plan: 'ESSENCIAL',
        nicheCode: 'RETAIL',
        cpf: testCpf,
      });

    expect(signupResponse.status).toBe(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email, password: testPassword })
      .expect(200);

    const cookies = loginResponse.get('Set-Cookie') || [];

    // Expire it now
    await prisma.tenant.update({
      where: { id: signupResponse.body.tenantId },
      data: { planStatus: 'TRIAL_EXPIRED' },
    });

    const meExpiredResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookies as any);

    expect(meExpiredResponse.status).toBe(403);
    expect(meExpiredResponse.body.error.code).toBe('TRIAL_EXPIRED');
  });

  it('should have subscription immediately available after signup', async () => {
    const email = `trial-4-${Date.now()}@test.com`;
    const signupResponse = await request(app.getHttpServer())
      .post('/api/v1/public/payments/trial/signup')
      .send({
        name: 'Immediate Sub User',
        email: email,
        password: testPassword,
        companyName: 'Trial Company 4',
        cnpj: workingCnpj,
        phone: '11999998885',
        plan: 'PROFISSIONAL',
        nicheCode: 'RETAIL',
        cpf: testCpf,
      });

    expect(signupResponse.status).toBe(201);
    const tenantId = signupResponse.body.tenantId;

    // Subscription should exist immediately (not depend on async handler)
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
    });
    expect(subscription).not.toBeNull();
    expect(subscription!.status).toBe('ACTIVE');
    expect(subscription!.aiTokensQuota).toBeGreaterThan(0);
  });
});
