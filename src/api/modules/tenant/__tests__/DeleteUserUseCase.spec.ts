import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeleteUserUseCase } from '../application/use-cases/users/DeleteUserUseCase';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;
  let userRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepo = {
      saveWithTenant: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndTenant: jest.fn(),
      findByEmail: jest.fn(),
      findAllByTenant: jest.fn(),
      findOwnerPrincipalByTenantId: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new DeleteUserUseCase(userRepo);
  });

  it('should delete a non-owner user that belongs to the tenant', async () => {
    const user = User.create({
      name: 'Agent User',
      email: Email.create('agent@tenant.com'),
      phone: Phone.create('11999998888'),
      passwordHash: 'hash',
      role: Role.create('AGENT'),
    });

    userRepo.findByIdAndTenant.mockResolvedValue(user);

    await useCase.execute({ userId: 'user-1', tenantId: 'tenant-1' });

    expect(userRepo.delete).toHaveBeenCalledWith('user-1');
  });

  it('should throw when user is not found within the tenant', async () => {
    userRepo.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'missing-user', tenantId: 'tenant-1' }),
    ).rejects.toThrow(NotFoundException);

    expect(userRepo.delete).not.toHaveBeenCalled();
  });

  it('should block deletion of tenant owner', async () => {
    const owner = User.create({
      name: 'Owner User',
      email: Email.create('owner@tenant.com'),
      phone: Phone.create('11999998888'),
      passwordHash: 'hash',
      role: Role.create('OWNER'),
    });

    userRepo.findByIdAndTenant.mockResolvedValue(owner);

    await expect(
      useCase.execute({ userId: 'owner-id', tenantId: 'tenant-1' }),
    ).rejects.toThrow(ConflictException);

    expect(userRepo.delete).not.toHaveBeenCalled();
  });
});
