import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/database/PrismaService';
import * as cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '../../../shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '../../../shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { Prisma } from '@prisma/client';

describe('Tenant Branches (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testCnpj = '60.701.190/0001-04'; // Reliable valid CNPJ
  const testEmail = 'owner-branches-e2e@test.com';
  let authCookie: string[];
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup(prisma, testCnpj, testEmail);

    // Setup Tenant and User
    const createTenantRes = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .send({
        companyName: 'Branches Test Corp',
        cnpj: testCnpj,
        ownerName: 'Test Owner',
        ownerEmail: testEmail,
        ownerPhone: '11999998888',
        ownerPassword: 'password123',
        plan: 'PROFISSIONAL',
      });

    if (createTenantRes.status !== 201) {
      console.error(
        'Tenant setup failed:',
        createTenantRes.status,
        JSON.stringify(createTenantRes.body),
      );
      throw new Error(`Tenant creation failed`);
    }

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'password123' });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    authCookie = loginRes.get('Set-Cookie') || [];
    const tenant = await prisma.tenant.findUnique({
      where: { cnpj: testCnpj },
    });
    tenantId = tenant!.id;
  });

  async function cleanup(prisma: PrismaService, cnpj: string, email: string) {
    const tenant = await prisma.tenant.findUnique({ where: { cnpj } });
    if (tenant) {
      const tid = tenant.id;
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM tenant_schema.tenant_audit_logs WHERE tenant_id = ${tid}::uuid`,
      );
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM tenant_schema.tenant_branches WHERE tenant_id = ${tid}::uuid`,
      );
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

  it('should create, update and delete a branch', async () => {
    // 1. Create
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/branches`)
      .set('Cookie', authCookie)
      .send({
        name: 'Sucursal Centro',
        cnpj: '00.000.000/0001-91',
        phone: '11999990000',
        active: true,
      });

    expect(createRes.status).toBe(201);

    // Handle double-wrapping
    const data = createRes.body.data?.data || createRes.body.data;
    const branchId = data?.id;
    expect(branchId).toBeDefined();

    // Verify via DB (Safe Raw SQL)
    const branches = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM tenant_schema.tenant_branches WHERE id = ${branchId}::uuid`,
    );
    expect(branches.length).toBe(1);
    expect(branches[0].name).toBe('Sucursal Centro');

    // 2. Update
    const updateRes = await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/branches/${branchId}`)
      .set('Cookie', authCookie)
      .send({
        name: 'Sucursal Centro v2',
        active: false,
      });

    expect(updateRes.status).toBe(200);
    const updatedBranches = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM tenant_schema.tenant_branches WHERE id = ${branchId}::uuid`,
    );
    expect(updatedBranches[0].name).toBe('Sucursal Centro v2');
    expect(updatedBranches[0].active).toBe(false);

    // 3. Delete
    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/tenants/${tenantId}/branches/${branchId}`)
      .set('Cookie', authCookie);

    expect(deleteRes.status).toBe(200);
    const deletedBranches = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM tenant_schema.tenant_branches WHERE id = ${branchId}::uuid`,
    );
    expect(deletedBranches.length).toBe(0);
  });

  it('should reject branch creation for unauthorized roles (MEMBER)', async () => {
    // Create a MEMBER user
    const memberEmail = 'member@test.com';
    await prisma.user.deleteMany({ where: { email: memberEmail } });

    const userCreateRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/users`)
      .set('Cookie', authCookie)
      .send({
        name: 'Member User',
        email: memberEmail,
        phone: '11999990000',
        role: 'AGENT',
      });

    expect(userCreateRes.status).toBe(201);
    const memberId =
      userCreateRes.body.data?.id || userCreateRes.body.data?.data?.id;

    // Manually set password to 'password123' to bypass temporary password
    const passwordHash =
      '$2b$10$EP779.6y/U5vSnt16mD/Uu7Wn8S0xK.5sS8YhG.00hX5fS/0S0S0S'; // password123 hash
    await prisma.$executeRaw(
      Prisma.sql`UPDATE tenant_schema.users SET password_hash = ${passwordHash} WHERE id = ${memberId}::uuid`,
    );

    const loginMemberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password: 'password123' });

    if (loginMemberRes.status !== 200) {
      console.error(
        'Member login failed:',
        loginMemberRes.status,
        JSON.stringify(loginMemberRes.body),
      );
    }
    expect(loginMemberRes.status).toBe(200);

    const memberCookie = loginMemberRes.get('Set-Cookie') || [];

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/branches`)
      .set('Cookie', memberCookie)
      .send({
        name: 'Unauthorized Branch',
        cnpj: '00.000.000/0001-91',
      });

    expect(response.status).toBe(403);
  });
});
