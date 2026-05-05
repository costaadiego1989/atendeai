import { GetUsersByTenantUseCase } from '../application/use-cases/users/GetUsersByTenantUseCase';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('GetUsersByTenantUseCase', () => {
  let useCase: GetUsersByTenantUseCase;
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

    useCase = new GetUsersByTenantUseCase(userRepo);
  });

  it('should map users to the public output contract', async () => {
    userRepo.findAllByTenant.mockResolvedValue([
      User.create(
        {
          name: 'Owner User',
          email: Email.create('owner@tenant.com'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hash-1',
          role: Role.create('OWNER'),
        },
        new UniqueEntityID('user-1'),
      ),
      User.create(
        {
          name: 'Admin User',
          email: Email.create('admin@tenant.com'),
          phone: Phone.create('11911112222'),
          passwordHash: 'hash-2',
          role: Role.create('ADMIN'),
        },
        new UniqueEntityID('user-2'),
      ),
    ]);

    const result = await useCase.execute('tenant-1');

    expect(userRepo.findAllByTenant).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual([
      {
        id: 'user-1',
        name: 'Owner User',
        email: 'owner@tenant.com',
        phone: '+5511999998888',
        role: 'OWNER',
        mustChangePassword: false,
      },
      {
        id: 'user-2',
        name: 'Admin User',
        email: 'admin@tenant.com',
        phone: '+5511911112222',
        role: 'ADMIN',
        mustChangePassword: false,
      },
    ]);
  });
});
