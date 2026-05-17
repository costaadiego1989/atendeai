import { ChangeFirstAccessPasswordUseCase } from '../ChangeFirstAccessPasswordUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('ChangeFirstAccessPasswordUseCase', () => {
  let useCase: ChangeFirstAccessPasswordUseCase;
  let authUserRepository: any;
  let passwordHasher: any;
  let authAuditLogRepository: any;

  function createMockUser(
    overrides: Partial<{
      id: string;
      tenantId: string;
      email: string;
      mustChangePassword: boolean;
    }> = {},
  ) {
    return AuthUser.create(
      {
        tenantId: overrides.tenantId ?? 'tenant-1',
        email: AuthUserEmail.create(overrides.email ?? 'user@test.com'),
        name: 'Test User',
        passwordHash: 'old_hash',
        role: Role.create('AGENT'),
        mustChangePassword: overrides.mustChangePassword ?? true,
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID(overrides.id ?? 'user-1'),
    );
  }

  beforeEach(() => {
    authUserRepository = {
      findById: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('new_hashed_password'),
    };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new ChangeFirstAccessPasswordUseCase(
      authUserRepository,
      passwordHasher,
      authAuditLogRepository,
    );
  });

  it('should change password on first access successfully', async () => {
    const mockUser = createMockUser({ mustChangePassword: true });
    authUserRepository.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute({
      userId: 'user-1',
      password: 'NewSecurePass123!',
    });

    expect(result.message).toBeDefined();
    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new_hashed_password',
    );
  });

  it('should throw EntityNotFoundException when user does not exist', async () => {
    authUserRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'nonexistent', password: 'NewPass123!' }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should hash the new password before saving', async () => {
    const mockUser = createMockUser();
    authUserRepository.findById.mockResolvedValue(mockUser);

    await useCase.execute({ userId: 'user-1', password: 'MyNewPassword!' });

    expect(passwordHasher.hash).toHaveBeenCalledWith('MyNewPassword!');
    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new_hashed_password',
    );
  });

  it('should register audit FIRST_ACCESS_PASSWORD_CHANGED', async () => {
    const mockUser = createMockUser({
      email: 'user@test.com',
      tenantId: 'tenant-1',
    });
    authUserRepository.findById.mockResolvedValue(mockUser);

    await useCase.execute({
      userId: 'user-1',
      password: 'NewPass123!',
      context: {
        ipAddress: '192.168.1.1',
        userAgent: 'Firefox',
        deviceId: 'dev-2',
      },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'FIRST_ACCESS_PASSWORD_CHANGED',
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@test.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Firefox',
        deviceId: 'dev-2',
      }),
    );
  });

  it('should call updatePassword with the userId', async () => {
    const mockUser = createMockUser({ id: 'user-42' });
    authUserRepository.findById.mockResolvedValue(mockUser);

    await useCase.execute({ userId: 'user-42', password: 'Pass123!' });

    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-42',
      expect.any(String),
    );
  });

  it('should propagate context to audit log', async () => {
    const mockUser = createMockUser();
    authUserRepository.findById.mockResolvedValue(mockUser);

    await useCase.execute({
      userId: 'user-1',
      password: 'Pass123!',
      context: {
        ipAddress: '10.0.0.1',
        userAgent: 'Safari',
        deviceId: 'iphone-1',
      },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '10.0.0.1',
        userAgent: 'Safari',
        deviceId: 'iphone-1',
      }),
    );
  });
});
