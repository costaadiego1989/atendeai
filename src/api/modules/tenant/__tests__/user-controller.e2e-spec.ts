import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { AppModule } from '../../../app.module';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

describe('UserController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;
  let ownerCookie: string;
  let agentCookie: string;

  const tenantACnpj = '40780195000106';
  const tenantBCnpj = '19131243000197';
  const ownerEmail = 'tenant-owner-e2e@test.com';
  const agentEmail = 'tenant-agent-e2e@test.com';
  const otherOwnerEmail = 'tenant-other-owner-e2e@test.com';
  const password = 'Password123!';

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
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

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [
              ownerEmail,
              agentEmail,
              otherOwnerEmail,
              'new-user-e2e@test.com',
              'updated-user-e2e@test.com',
              'duplicate-user-e2e@test.com',
            ],
          },
        },
      })
      .catch(() => {});

    await prisma.tenant
      .deleteMany({
        where: {
          cnpj: {
            in: [tenantACnpj, tenantBCnpj],
          },
        },
      })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenantA = await prisma.tenant.create({
      data: {
        companyName: 'Tenant A',
        cnpj: tenantACnpj,
        plan: 'PROFISSIONAL',
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        companyName: 'Tenant B',
        cnpj: tenantBCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantBId = tenantB.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId: tenantAId,
          name: 'Tenant Owner',
          email: ownerEmail,
          phone: '11999990001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: tenantAId,
          name: 'Tenant Agent',
          email: agentEmail,
          phone: '11999990002',
          passwordHash,
          role: 'AGENT',
        },
        {
          tenantId: tenantBId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11999990003',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    ownerCookie = await login(ownerEmail);
    agentCookie = await login(agentEmail);
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [
              ownerEmail,
              agentEmail,
              otherOwnerEmail,
              'new-user-e2e@test.com',
              'updated-user-e2e@test.com',
              'duplicate-user-e2e@test.com',
            ],
          },
        },
      })
      .catch(() => {});

    await prisma.user
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantAId, tenantBId].filter(Boolean),
          },
        },
      })
      .catch(() => {});

    await prisma.tenant
      .deleteMany({
        where: {
          id: {
            in: [tenantAId, tenantBId].filter(Boolean),
          },
        },
      })
      .catch(() => {});

    if (app) {
      await app.close();
    }
  });

  afterEach(async () => {
    if (!prisma) {
      return;
    }

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: ['new-user-e2e@test.com', 'updated-user-e2e@test.com'],
          },
        },
      })
      .catch(() => {});
  });

  it('should list tenant users for OWNER', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}/users`)
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: ownerEmail, role: 'OWNER' }),
        expect.objectContaining({ email: agentEmail, role: 'AGENT' }),
      ]),
    );
  });

  it('should create a tenant user for OWNER', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/users`)
      .set('Cookie', [ownerCookie])
      .send({
        name: 'New User',
        email: 'new-user-e2e@test.com',
        phone: '11999990004',
        role: 'ADMIN',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();

    const createdUser = await prisma.user.findUnique({
      where: { email: 'new-user-e2e@test.com' },
    });
    const passwordChangeResults = await prisma.$queryRaw<
      Array<{ must_change_password: boolean }>
    >(
      `
        SELECT must_change_password
        FROM tenant_schema.users
        WHERE email = $1
        LIMIT 1
      `,
      'new-user-e2e@test.com',
    );
    expect(createdUser).toBeDefined();
    expect(createdUser?.tenantId).toBe(tenantAId);
    expect(createdUser?.role).toBe('ADMIN');
    expect(passwordChangeResults[0]?.must_change_password).toBe(true);
  });

  it('should reject duplicate email on user creation', async () => {
    await prisma.user.create({
      data: {
        tenantId: tenantAId,
        name: 'Duplicate User',
        email: 'duplicate-user-e2e@test.com',
        phone: '11999990005',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/users`)
      .set('Cookie', [ownerCookie])
      .send({
        name: 'Duplicate User Two',
        email: 'duplicate-user-e2e@test.com',
        phone: '11999990006',
        role: 'AGENT',
      })
      .expect(409);

    expect(response.body.message || response.body.error?.message).toContain(
      'already exists',
    );
  });

  it('should update a tenant user for OWNER', async () => {
    const createdUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        name: 'Editable User',
        email: 'new-user-e2e@test.com',
        phone: '11999990007',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'AGENT',
      },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantAId}/users/${createdUser.id}`)
      .set('Cookie', [ownerCookie])
      .send({
        name: 'Updated User',
        email: 'updated-user-e2e@test.com',
        role: 'ADMIN',
      })
      .expect(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: createdUser.id },
    });
    expect(updatedUser?.name).toBe('Updated User');
    expect(updatedUser?.email).toBe('updated-user-e2e@test.com');
    expect(updatedUser?.role).toBe('ADMIN');
  });

  it('should delete a non-owner tenant user for OWNER', async () => {
    const createdUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        name: 'Disposable User',
        email: 'new-user-e2e@test.com',
        phone: '11999990008',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'AGENT',
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/tenants/${tenantAId}/users/${createdUser.id}`)
      .set('Cookie', [ownerCookie])
      .expect(204);

    const deletedUser = await prisma.user.findUnique({
      where: { id: createdUser.id },
    });
    expect(deletedUser).toBeNull();
  });

  it('should block deletion of tenant owner', async () => {
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/tenants/${tenantAId}/users/${owner!.id}`)
      .set('Cookie', [ownerCookie])
      .expect(409);

    expect(response.body.message || response.body.error?.message).toContain(
      'cannot be deleted',
    );
  });

  it('should reject requests without authentication cookie', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}/users`)
      .expect(401);
  });

  it('should reject AGENT access due to missing role permission', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}/users`)
      .set('Cookie', [agentCookie])
      .expect(403);
  });

  it('should reject cross-tenant access even for authenticated OWNER', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}/users`)
      .set('Cookie', [ownerCookie])
      .expect(401);
  });
});
