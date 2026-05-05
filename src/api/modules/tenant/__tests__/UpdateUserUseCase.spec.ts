import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateUserUseCase } from '../application/use-cases/users/UpdateUserUseCase';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let userRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepo = {
      saveWithTenant: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndTenant: jest.fn(),
      findByEmail: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new UpdateUserUseCase(userRepo);
  });

  it('should update fields and persist the user', async () => {
    const user = User.create(
      {
        name: 'Jane Agent',
        email: Email.create('jane@tenant.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('AGENT'),
      },
      new UniqueEntityID('user-1'),
    );

    userRepo.findByIdAndTenant.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(null);

    await useCase.execute({
      id: 'user-1',
      tenantId: 'tenant-1',
      name: 'Jane Admin',
      email: 'jane-admin@tenant.com',
      phone: '11911112222',
      role: 'ADMIN',
    });

    expect(user.name).toBe('Jane Admin');
    expect(user.email.value).toBe('jane-admin@tenant.com');
    expect(user.phone.value).toBe('+5511911112222');
    expect(user.role.value).toBe('ADMIN');
    expect(userRepo.save).toHaveBeenCalledWith(user);
  });

  it('should throw when user is not found within the tenant', async () => {
    userRepo.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        id: 'missing-user',
        tenantId: 'tenant-1',
        name: 'Jane Admin',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('should throw conflict when changing email to one already used by another user', async () => {
    const user = User.create(
      {
        name: 'Jane Agent',
        email: Email.create('jane@tenant.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('AGENT'),
      },
      new UniqueEntityID('user-1'),
    );

    const existingUser = User.create(
      {
        name: 'Other User',
        email: Email.create('taken@tenant.com'),
        phone: Phone.create('11977776666'),
        passwordHash: 'hash',
        role: Role.create('ADMIN'),
      },
      new UniqueEntityID('user-2'),
    );

    userRepo.findByIdAndTenant.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(
      useCase.execute({
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'taken@tenant.com',
      }),
    ).rejects.toThrow(ConflictException);

    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
