import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../domain/repositories/IUserRepository';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';

describe('PrismaUserRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IUserRepository;
  let tenantId: string;
  const emails: string[] = [];
  const testCnpj = '00.000.001/0001-99';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IUserRepository>(USER_REPOSITORY);

    // Initial Cleanup
    await prisma.tenant
      .deleteMany({ where: { cnpj: testCnpj } })
      .catch(() => {});

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'User Repository Store',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      if (emails.length > 0) {
        await prisma.user
          .deleteMany({ where: { email: { in: emails } } })
          .catch(() => {});
      }
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

  function makeUser(seed: number) {
    const email = `user-${seed}@tenant.com`;
    emails.push(email);
    return User.create({
      name: `User ${seed}`,
      email: Email.create(email),
      phone: Phone.create(`1198888${String(seed).slice(-4)}`),
      passwordHash: 'hashed-password',
      role: Role.create(seed % 2 === 0 ? 'ADMIN' : 'AGENT'),
    });
  }

  it('should save users with tenant and allow lookup by id/email/tenant', async () => {
    const user = makeUser(2001);

    await repository.saveWithTenant(user, tenantId);

    const byId = await repository.findById(user.id.toValue());
    const byTenant = await repository.findByIdAndTenant(
      user.id.toValue(),
      tenantId,
    );
    const byEmail = await repository.findByEmail(user.email.value);

    expect(byId?.email.value).toBe(user.email.value);
    expect(byTenant?.id.toValue()).toBe(user.id.toValue());
    expect(byEmail?.role.value).toBe(user.role.value);
  });

  it('should list users by tenant, update existing users and delete them', async () => {
    const user = makeUser(2002);
    await repository.saveWithTenant(user, tenantId);

    user.updateName('Updated User');
    user.updatePhone('11977776666');
    user.changeRole(Role.create('ADMIN'));
    await repository.save(user);

    const allUsers = await repository.findAllByTenant(tenantId);
    const updated = await repository.findById(user.id.toValue());

    expect(
      allUsers.some((item) => item.id.toValue() === user.id.toValue()),
    ).toBe(true);
    expect(updated?.name).toBe('Updated User');
    expect(updated?.phone.value).toBe('+5511977776666');
    expect(updated?.role.value).toBe('ADMIN');

    await repository.delete(
      user.id.toValue(),
      '00000000-0000-0000-0000-000000000000',
    );
    await expect(
      repository.findById(user.id.toValue()),
    ).resolves.not.toBeNull();

    await repository.delete(user.id.toValue(), tenantId);

    await expect(repository.findById(user.id.toValue())).resolves.toBeNull();
  });
});
