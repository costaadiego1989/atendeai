import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '../domain/repositories/IAuthUserRepository';

describe('PrismaAuthUserRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IAuthUserRepository;
  let tenantId: string;
  let userId: string;
  const email = 'auth-repo@test.com';
  const testCnpj = `au${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IAuthUserRepository>(AUTH_USER_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Auth Repository Store',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        name: 'Auth Repository User',
        phone: '11988887777',
        passwordHash: 'hashed-password',
        role: 'OWNER',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: tenantId } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should find users by email', async () => {
    const result = await repository.findByEmail(email);

    expect(result).not.toBeNull();
    expect(result?.id.toString()).toBe(userId);
    expect(result?.email.value).toBe(email);
  });

  it('should find users by id', async () => {
    const result = await repository.findById(userId);

    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe(tenantId);
    expect(result?.role.value).toBe('OWNER');
  });
});
