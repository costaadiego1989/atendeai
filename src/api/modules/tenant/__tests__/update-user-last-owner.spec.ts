import { BadRequestException } from '@nestjs/common';
import { UpdateUserUseCase } from '../application/use-cases/users/UpdateUserUseCase';
import { IUserRepository, USER_REPOSITORY } from '../domain/repositories/IUserRepository';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-owner-1';

/** Creates a minimal User entity with OWNER role and a known id. */
function makeOwnerUser(id = USER_ID) {
  return User.create(
    {
      name: 'Owner User',
      email: Email.create('owner@tenant.com'),
      phone: Phone.create('11999990000'),
      passwordHash: 'hash',
      role: Role.create('OWNER'),
    },
    new UniqueEntityID(id),
  );
}

/** Creates a minimal User entity with a non-OWNER role (ADMIN, which is valid). */
function makeAdminUser(id = 'user-admin-1') {
  return User.create(
    {
      name: 'Admin User',
      email: Email.create('admin@tenant.com'),
      phone: Phone.create('11999991111'),
      passwordHash: 'hash',
      role: Role.create('ADMIN'),
    },
    new UniqueEntityID(id),
  );
}

describe('UpdateUserUseCase — last-owner guard', () => {
  let useCase: UpdateUserUseCase;
  let userRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepo = {
      saveWithTenant: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndTenant: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailAndTenant: jest.fn(),
      findAllByTenant: jest.fn(),
      findOwnerPrincipalByTenantId: jest.fn(),
      countOwners: jest.fn(),
      delete: jest.fn(),
    } as any;

    useCase = new UpdateUserUseCase(userRepo);
  });

  // ─── only owner trying to demote self ────────────────────────────────────────
  it('throws BadRequestException containing "último OWNER" when the sole OWNER tries to demote themselves', async () => {
    const ownerUser = makeOwnerUser();
    userRepo.findByIdAndTenant.mockResolvedValue(ownerUser);
    userRepo.countOwners.mockResolvedValue(1);

    await expect(
      useCase.execute({
        id: USER_ID,
        tenantId: TENANT_ID,
        role: 'AGENT',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        id: USER_ID,
        tenantId: TENANT_ID,
        role: 'AGENT',
      }),
    ).rejects.toThrow(/último OWNER/i);

    expect(userRepo.save).not.toHaveBeenCalled();
  });

  // ─── owner demotes self when 2+ owners exist → succeeds ──────────────────────
  it('succeeds (no exception) when OWNER demotes self but there is still another OWNER', async () => {
    const ownerUser = makeOwnerUser();
    userRepo.findByIdAndTenant.mockResolvedValue(ownerUser);
    userRepo.countOwners.mockResolvedValue(2);
    userRepo.save.mockResolvedValue(undefined);

    await expect(
      useCase.execute({
        id: USER_ID,
        tenantId: TENANT_ID,
        role: 'AGENT',
      }),
    ).resolves.toBeUndefined();

    expect(userRepo.countOwners).toHaveBeenCalledWith(TENANT_ID);
    expect(userRepo.save).toHaveBeenCalled();
  });

  // ─── non-OWNER role change → countOwners never called ────────────────────────
  it('does NOT call countOwners when changing role of a non-OWNER user', async () => {
    const adminUser = makeAdminUser();
    userRepo.findByIdAndTenant.mockResolvedValue(adminUser);
    userRepo.save.mockResolvedValue(undefined);

    await useCase.execute({
      id: 'user-admin-1',
      tenantId: TENANT_ID,
      role: 'AGENT',
    });

    expect(userRepo.countOwners).not.toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalled();
  });

  // ─── OWNER → OWNER (no actual demotion) → no guard triggered ─────────────────
  it('does NOT call countOwners when OWNER role stays OWNER (no actual demotion)', async () => {
    const ownerUser = makeOwnerUser();
    userRepo.findByIdAndTenant.mockResolvedValue(ownerUser);
    userRepo.save.mockResolvedValue(undefined);

    await useCase.execute({
      id: USER_ID,
      tenantId: TENANT_ID,
      role: 'OWNER',
    });

    expect(userRepo.countOwners).not.toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalled();
  });
});
