import { ResetPasswordUseCase } from '../ResetPasswordUseCase';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let authUserRepository: any;
  let passwordHasher: any;
  let passwordResetTokenStore: any;
  let refreshSessionStore: any;
  let authAuditLogRepository: any;

  const validTokenRecord = {
    id: 'token-record-1',
    userId: 'user-1',
    email: 'user@test.com',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
  };

  beforeEach(() => {
    authUserRepository = {
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('new_hashed_password'),
    };
    passwordResetTokenStore = {
      findValidByHash: jest.fn(),
      markUsed: jest.fn().mockResolvedValue(undefined),
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };
    refreshSessionStore = {
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new ResetPasswordUseCase(
      authUserRepository,
      passwordHasher,
      passwordResetTokenStore,
      refreshSessionStore,
      authAuditLogRepository,
    );
  });

  it('should reset password with valid token', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    const result = await useCase.execute({
      token: 'raw-token-value',
      password: 'NewPassword123!',
    });

    expect(result.message).toBeDefined();
    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new_hashed_password',
    );
  });

  it('should throw ValidationErrorException when token is expired/invalid', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'expired-token', password: 'NewPass123!' }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should throw ValidationErrorException when token is already used', async () => {
    // findValidByHash returns null for used tokens (store filters them out)
    passwordResetTokenStore.findValidByHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'used-token', password: 'NewPass123!' }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should throw ValidationErrorException when token does not exist', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'nonexistent-token', password: 'NewPass123!' }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should hash new password before saving', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    await useCase.execute({ token: 'raw-token', password: 'MyNewPassword!' });

    expect(passwordHasher.hash).toHaveBeenCalledWith('MyNewPassword!');
    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new_hashed_password',
    );
  });

  it('should invalidate all user sessions after password reset', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    await useCase.execute({ token: 'raw-token', password: 'NewPass123!' });

    expect(refreshSessionStore.revoke).toHaveBeenCalledWith('user-1');
  });

  it('should mark token as used after successful reset', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    await useCase.execute({ token: 'raw-token', password: 'NewPass123!' });

    expect(passwordResetTokenStore.markUsed).toHaveBeenCalledWith(
      'token-record-1',
    );
  });

  it('should register audit PASSWORD_RESET_COMPLETED on success', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    await useCase.execute({
      token: 'raw-token',
      password: 'NewPass123!',
      context: {
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome',
        deviceId: 'dev-1',
      },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PASSWORD_RESET_COMPLETED',
        userId: 'user-1',
        email: 'user@test.com',
        ipAddress: '10.0.0.1',
        metadata: expect.objectContaining({ success: true }),
      }),
    );
  });

  it('should compute token hash from raw token for lookup', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);

    await useCase.execute({ token: 'abc123', password: 'NewPass123!' });

    // The use case hashes the raw token with SHA-256 before looking it up
    const calledHash = passwordResetTokenStore.findValidByHash.mock.calls[0][0];
    expect(calledHash).toHaveLength(64); // SHA-256 hex digest
    expect(calledHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
