import { GetCurrentUserUseCase } from '../GetCurrentUserUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('GetCurrentUserUseCase', () => {
  let useCase: GetCurrentUserUseCase;
  let authUserRepo: any;

  beforeEach(() => {
    authUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    useCase = new GetCurrentUserUseCase(authUserRepo);
  });

  it('should return user data when user exists', async () => {
    const mockUser = AuthUser.create(
      {
        tenantId: 'tenant-123',
        tenantName: 'Tenant Test',
        tenantBusinessType: 'SCHEDULING',
        email: AuthUserEmail.create('test@test.com'),
        name: 'Test User',
        passwordHash: 'hashed',
        role: Role.create('ADMIN'),
      },
      new UniqueEntityID('user-123'),
    );

    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute('user-123');

    expect(result.user.id).toBe('user-123');
    expect(result.user.name).toBe('Test User');
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.tenantId).toBe('tenant-123');
    expect(result.user.role).toBe('ADMIN');
    expect(result.tenant).toEqual({
      id: 'tenant-123',
      name: 'Tenant Test',
      businessType: 'SCHEDULING',
    });
    expect(authUserRepo.findById).toHaveBeenCalledWith('user-123');
  });

  it('should throw EntityNotFoundException when user does not exist', async () => {
    authUserRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(
      EntityNotFoundException,
    );
  });
});
