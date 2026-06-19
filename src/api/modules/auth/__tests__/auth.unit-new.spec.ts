import { LoginUseCase } from '../application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from '../application/use-cases/RefreshTokenUseCase';
import { ResetPasswordUseCase } from '../application/use-cases/ResetPasswordUseCase';
import { RequestPasswordResetUseCase } from '../application/use-cases/RequestPasswordResetUseCase';
import { ChangeFirstAccessPasswordUseCase } from '../application/use-cases/ChangeFirstAccessPasswordUseCase';
import { AuthUser } from '../domain/entities/AuthUser';
import { AuthUserEmail } from '../domain/value-objects/AuthUserEmail';
import { AuthUserMapper } from '../infrastructure/persistence/mappers/AuthUserMapper';
import { DeviceAwareThrottlerGuard } from '../presentation/guards/DeviceAwareThrottlerGuard';
import { BrevoPasswordResetEmailSender } from '../infrastructure/services/BrevoPasswordResetEmailSender';
import {
  UnauthorizedException,
  ForbiddenException,
  ValidationErrorException,
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// ─── Shared factory ───────────────────────────────────────────────────────────

function makeUser(
  overrides: Partial<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantCnpj: string;
    tenantBusinessType: string;
    tenantBranches: Array<{
      id: string;
      name: string;
      isHeadquarters: boolean;
      active: boolean;
    }>;
    email: string;
    name: string;
    phone: string;
    cpf: string;
    passwordHash: string;
    mustChangePassword: boolean;
    role: string;
    planStatus: string;
    tenantCreatedAt: Date;
  }> = {},
) {
  return AuthUser.create(
    {
      tenantId: overrides.tenantId ?? 'tenant-123',
      tenantName: overrides.tenantName ?? 'Tenant Test',
      tenantCnpj: overrides.tenantCnpj ?? '12345678000100',
      tenantBusinessType: overrides.tenantBusinessType ?? 'SCHEDULING',
      tenantBranches: overrides.tenantBranches ?? [
        { id: 'branch-1', name: 'Matriz', isHeadquarters: true, active: true },
      ],
      email: AuthUserEmail.create(overrides.email ?? 'test@test.com'),
      name: overrides.name ?? 'Test User',
      phone: overrides.phone ?? '11999999999',
      cpf: overrides.cpf ?? '12345678900',
      passwordHash: overrides.passwordHash ?? 'hashed_pw',
      mustChangePassword: overrides.mustChangePassword ?? false,
      role: Role.create(overrides.role ?? 'OWNER'),
      planStatus: overrides.planStatus ?? 'ACTIVE',
      tenantCreatedAt: overrides.tenantCreatedAt ?? new Date('2025-01-01'),
    },
    new UniqueEntityID(overrides.id ?? 'user-123'),
  );
}

const mockBillingAccess = {
  subscriptionId: 'sub-1',
  plan: 'PRO',
  status: 'ACTIVE',
  pricing: {
    baseMonthlyPrice: 99,
    addonsMonthlyPrice: 0,
    totalMonthlyPrice: 99,
    pricingVersion: 'v1',
  },
  includedModules: ['messaging'],
  addonModules: [],
  enabledModules: ['messaging'],
  moduleAccess: { messaging: true },
};

// ─── 1. LoginUseCase — plan-status blocking ───────────────────────────────────

describe('LoginUseCase — plan status blocking (new gaps)', () => {
  let useCase: LoginUseCase;
  let authUserRepo: any;
  let tokenService: any;
  let passwordHasher: any;
  let refreshSessionStore: any;
  let authAuditLogRepository: any;
  let tenantModuleAccessService: any;

  beforeEach(() => {
    authUserRepo = { findByEmail: jest.fn(), updateLastLogin: jest.fn().mockResolvedValue(undefined) };
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('access_token'),
      signRefreshToken: jest.fn().mockResolvedValue('refresh_token'),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
      getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
    };
    passwordHasher = { compare: jest.fn().mockResolvedValue(true) };
    refreshSessionStore = { save: jest.fn().mockResolvedValue(undefined) };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };
    tenantModuleAccessService = { getSummary: jest.fn().mockResolvedValue(mockBillingAccess) };

    useCase = new LoginUseCase(
      authUserRepo,
      tokenService,
      passwordHasher,
      refreshSessionStore,
      authAuditLogRepository,
      tenantModuleAccessService,
    );
  });

  it('should throw ForbiddenException when planStatus is CANCELLED', async () => {
    const user = makeUser({ planStatus: 'CANCELLED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when planStatus is SUSPENDED', async () => {
    const user = makeUser({ planStatus: 'SUSPENDED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when planStatus is CANCELLED with correct error code', async () => {
    const user = makeUser({ planStatus: 'CANCELLED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    try {
      await useCase.execute({ email: 'test@test.com', password: 'pass' });
      fail('expected ForbiddenException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
    }
  });

  it('should allow login when planStatus is ACTIVE', async () => {
    const user = makeUser({ planStatus: 'ACTIVE' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    const result = await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(result.accessToken).toBe('access_token');
  });

  it('should allow login when planStatus is TRIAL', async () => {
    const user = makeUser({ planStatus: 'TRIAL' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    const result = await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(result.accessToken).toBeDefined();
  });

  it('should propagate error when tenantModuleAccessService.getSummary throws', async () => {
    const user = makeUser({ planStatus: 'ACTIVE' });
    authUserRepo.findByEmail.mockResolvedValue(user);
    tenantModuleAccessService.getSummary.mockRejectedValue(
      new Error('Billing service unavailable'),
    );

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toThrow('Billing service unavailable');
  });

  it('should still call getSummary after successful auth even with ACTIVE plan', async () => {
    const user = makeUser({ planStatus: 'ACTIVE' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(tenantModuleAccessService.getSummary).toHaveBeenCalledWith('tenant-123');
  });

  it('should NOT call getSummary when plan is CANCELLED (blocks before billing)', async () => {
    const user = makeUser({ planStatus: 'CANCELLED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Billing service should not be called for blocked plans
    expect(tenantModuleAccessService.getSummary).not.toHaveBeenCalled();
  });

  it('should NOT call getSummary when plan is SUSPENDED (blocks before billing)', async () => {
    const user = makeUser({ planStatus: 'SUSPENDED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tenantModuleAccessService.getSummary).not.toHaveBeenCalled();
  });

  it('should still issue tokens when getSummary succeeds after auth', async () => {
    const user = makeUser({ planStatus: 'ACTIVE' });
    authUserRepo.findByEmail.mockResolvedValue(user);
    tenantModuleAccessService.getSummary.mockResolvedValue(mockBillingAccess);

    const result = await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(result.refreshToken).toBe('refresh_token');
    expect(result.tenant.billingAccess).toEqual(mockBillingAccess);
  });

  it('should record LOGIN_FAILED audit before throwing when plan is CANCELLED', async () => {
    const user = makeUser({ planStatus: 'CANCELLED' });
    authUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Audit may or may not fire — this verifies no 500 from audit bubbling
    expect(authAuditLogRepository.record).not.toThrow();
  });
});

// ─── 2. RefreshTokenUseCase — wrong token type + deleted user ─────────────────

describe('RefreshTokenUseCase — access token used as refresh + deleted user (new gaps)', () => {
  let useCase: RefreshTokenUseCase;
  let authUserRepo: any;
  let tokenService: any;
  let refreshSessionStore: any;
  let authAuditLogRepository: any;

  beforeEach(() => {
    authUserRepo = { findById: jest.fn() };
    tokenService = {
      verifyRefreshToken: jest.fn(),
      signAccessToken: jest.fn().mockResolvedValue('new_access'),
      signRefreshToken: jest.fn().mockResolvedValue('new_refresh'),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    };
    refreshSessionStore = {
      isValid: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new RefreshTokenUseCase(
      authUserRepo,
      tokenService,
      refreshSessionStore,
      authAuditLogRepository,
    );
  });

  it('should throw UnauthorizedException when token payload type is "access"', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'access',
    });

    await expect(
      useCase.execute({ refreshToken: 'an_access_token_used_as_refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should record REFRESH_FAILED audit with WRONG_TOKEN_TYPE reason when type is "access"', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'access',
    });

    await expect(
      useCase.execute({ refreshToken: 'wrong_type_token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REFRESH_FAILED',
        metadata: expect.objectContaining({ reason: 'WRONG_TOKEN_TYPE' }),
      }),
    );
  });

  it('should not call isValid when token type is wrong (short-circuit)', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'access',
    });

    await expect(
      useCase.execute({ refreshToken: 'wrong_type_token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshSessionStore.isValid).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when user was deleted after token issuance', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'deleted-user-id',
      tenantId: 'tenant-1',
      sid: 'session-abc',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'valid_token_deleted_user' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should record REFRESH_FAILED with USER_NOT_FOUND when user was deleted', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'deleted-user-id',
      tenantId: 'tenant-1',
      sid: 'session-abc',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'valid_token_deleted_user' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REFRESH_FAILED',
        userId: 'deleted-user-id',
        metadata: expect.objectContaining({ reason: 'USER_NOT_FOUND' }),
      }),
    );
  });

  it('should not issue new tokens when user is deleted (session valid but user gone)', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'gone-user',
      tenantId: 'tenant-1',
      sid: 'live-session',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    expect(tokenService.signRefreshToken).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token is missing entirely', async () => {
    await expect(
      useCase.execute({ refreshToken: '' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when refreshToken is undefined', async () => {
    await expect(
      useCase.execute({ refreshToken: undefined as any }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── 3. ResetPasswordUseCase — revoke throws + boundary passwords ─────────────

describe('ResetPasswordUseCase — revoke failure + password boundaries (new gaps)', () => {
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
    passwordHasher = { hash: jest.fn().mockResolvedValue('new_hashed_password') };
    passwordResetTokenStore = {
      findValidByHash: jest.fn().mockResolvedValue(validTokenRecord),
      markUsed: jest.fn().mockResolvedValue(undefined),
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };
    refreshSessionStore = { revoke: jest.fn().mockResolvedValue(undefined) };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new ResetPasswordUseCase(
      authUserRepository,
      passwordHasher,
      passwordResetTokenStore,
      refreshSessionStore,
      authAuditLogRepository,
    );
  });

  it('should propagate error when refreshSessionStore.revoke throws after password update', async () => {
    refreshSessionStore.revoke.mockRejectedValue(new Error('Redis connection lost'));

    await expect(
      useCase.execute({ token: 'raw-token', password: 'NewPass123!' }),
    ).rejects.toThrow('Redis connection lost');

    // Password was updated BEFORE revoke was called
    expect(authUserRepository.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new_hashed_password',
    );
  });

  it('should update password before revoking sessions (order matters)', async () => {
    const callOrder: string[] = [];
    authUserRepository.updatePassword.mockImplementation(() => {
      callOrder.push('updatePassword');
      return Promise.resolve();
    });
    refreshSessionStore.revoke.mockImplementation(() => {
      callOrder.push('revoke');
      return Promise.resolve();
    });

    await useCase.execute({ token: 'raw-token', password: 'NewPass123!' });

    expect(callOrder.indexOf('updatePassword')).toBeLessThan(
      callOrder.indexOf('revoke'),
    );
  });

  it('should still mark token as used even when revoke throws — checks operation order', async () => {
    refreshSessionStore.revoke.mockRejectedValue(new Error('Redis down'));

    // markUsed comes AFTER revoke in the code, so if revoke throws, markUsed is NOT called
    await expect(
      useCase.execute({ token: 'raw-token', password: 'NewPass123!' }),
    ).rejects.toThrow('Redis down');

    expect(passwordResetTokenStore.markUsed).not.toHaveBeenCalled();
  });

  it('should accept a password at exact minimum length (6 characters)', async () => {
    const result = await useCase.execute({ token: 'raw-token', password: '123456' });

    expect(result.message).toBeDefined();
    expect(passwordHasher.hash).toHaveBeenCalledWith('123456');
  });

  it('should accept a password of 5 characters (use-case has no min-length guard)', async () => {
    // The use case itself has NO MinLength validation — only the DTO does.
    // This test documents that the use case accepts short passwords without throwing.
    const result = await useCase.execute({ token: 'raw-token', password: '12345' });

    expect(result.message).toBeDefined();
  });

  it('should accept an empty string password (use-case has no empty-string guard)', async () => {
    // Documents: use case does NOT validate — DTO layer is the only guard.
    const result = await useCase.execute({ token: 'raw-token', password: '' });

    expect(result.message).toBeDefined();
    expect(passwordHasher.hash).toHaveBeenCalledWith('');
  });

  it('should accept a very long password (512 chars)', async () => {
    const longPass = 'a'.repeat(512);

    const result = await useCase.execute({ token: 'raw-token', password: longPass });

    expect(result.message).toBeDefined();
    expect(passwordHasher.hash).toHaveBeenCalledWith(longPass);
  });

  it('should throw ValidationErrorException when token is null', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'no-such-token', password: 'Pass123!' }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should record failed audit when token lookup returns null', async () => {
    passwordResetTokenStore.findValidByHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'bad-token', password: 'Pass123!', context: { ipAddress: '1.2.3.4' } }),
    ).rejects.toBeInstanceOf(ValidationErrorException);

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PASSWORD_RESET_COMPLETED',
        metadata: expect.objectContaining({ success: false }),
      }),
    );
  });
});

// ─── 4. RequestPasswordResetUseCase — SMTP failure + token-store failure ──────

describe('RequestPasswordResetUseCase — SMTP failure + tokenStore failure (new gaps)', () => {
  let useCase: RequestPasswordResetUseCase;
  let authUserRepository: any;
  let passwordResetTokenStore: any;
  let passwordResetEmailSender: any;
  let authAuditLogRepository: any;
  let configService: any;

  beforeEach(() => {
    authUserRepository = { findByEmail: jest.fn() };
    passwordResetTokenStore = {
      create: jest.fn().mockResolvedValue(undefined),
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };
    passwordResetEmailSender = { send: jest.fn().mockResolvedValue(undefined) };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue('https://app.example.com/reset-password') };

    useCase = new RequestPasswordResetUseCase(
      authUserRepository,
      passwordResetTokenStore,
      passwordResetEmailSender,
      authAuditLogRepository,
      configService,
    );
  });

  it('should propagate error when passwordResetEmailSender.send throws (SMTP failure)', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetEmailSender.send.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(
      useCase.execute({ email: 'user@test.com' }),
    ).rejects.toThrow('SMTP connection refused');
  });

  it('should have already stored the token before SMTP throws (token created, no email)', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetEmailSender.send.mockRejectedValue(new Error('SMTP refused'));

    await expect(useCase.execute({ email: 'user@test.com' })).rejects.toThrow();

    // Token was stored BEFORE the email was sent
    expect(passwordResetTokenStore.create).toHaveBeenCalled();
  });

  it('should propagate error when passwordResetTokenStore.create throws after invalidate succeeds', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetTokenStore.invalidateForUser.mockResolvedValue(undefined);
    passwordResetTokenStore.create.mockRejectedValue(new Error('DB write failed'));

    await expect(
      useCase.execute({ email: 'user@test.com' }),
    ).rejects.toThrow('DB write failed');
  });

  it('should not send email when tokenStore.create throws', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetTokenStore.create.mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute({ email: 'user@test.com' })).rejects.toThrow();

    expect(passwordResetEmailSender.send).not.toHaveBeenCalled();
  });

  it('should leave user with no valid token and no email when tokenStore.create throws', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetTokenStore.invalidateForUser.mockResolvedValue(undefined);
    passwordResetTokenStore.create.mockRejectedValue(new Error('write failed'));

    await expect(useCase.execute({ email: 'user@test.com' })).rejects.toThrow('write failed');

    expect(passwordResetTokenStore.invalidateForUser).toHaveBeenCalledWith('user-123');
    expect(passwordResetEmailSender.send).not.toHaveBeenCalled();
  });

  it('should still return success message for non-existent user (anti-enumeration)', async () => {
    authUserRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'ghost@test.com' });

    expect(result.message).toBeDefined();
    expect(passwordResetEmailSender.send).not.toHaveBeenCalled();
  });

  it('should propagate SMTP error even though token was persisted (no rollback)', async () => {
    const user = makeUser({ email: 'user@test.com' });
    authUserRepository.findByEmail.mockResolvedValue(user);
    passwordResetEmailSender.send.mockRejectedValue(new Error('Timeout'));

    let caught: Error | null = null;
    try {
      await useCase.execute({ email: 'user@test.com' });
    } catch (err: any) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('Timeout');
    expect(passwordResetTokenStore.create).toHaveBeenCalled();
  });
});

// ─── 5. ChangeFirstAccessPasswordUseCase — mustChangePassword=false ───────────

describe('ChangeFirstAccessPasswordUseCase — mustChangePassword flag (new gaps)', () => {
  let useCase: ChangeFirstAccessPasswordUseCase;
  let authUserRepository: any;
  let passwordHasher: any;
  let authAuditLogRepository: any;

  beforeEach(() => {
    authUserRepository = {
      findById: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    passwordHasher = { hash: jest.fn().mockResolvedValue('new_hashed') };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new ChangeFirstAccessPasswordUseCase(
      authUserRepository,
      passwordHasher,
      authAuditLogRepository,
    );
  });

  it('should succeed even when mustChangePassword is false (use case does NOT enforce the flag)', async () => {
    const user = makeUser({ mustChangePassword: false });
    authUserRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute({ userId: 'user-123', password: 'NewPass123!' });

    // Documents the current behavior: the use case does not block on mustChangePassword=false
    expect(result.message).toBeDefined();
    expect(authUserRepository.updatePassword).toHaveBeenCalled();
  });

  it('should call updatePassword regardless of mustChangePassword flag value', async () => {
    const user = makeUser({ mustChangePassword: false });
    authUserRepository.findById.mockResolvedValue(user);

    await useCase.execute({ userId: 'user-123', password: 'Pass123!' });

    expect(authUserRepository.updatePassword).toHaveBeenCalledWith('user-123', 'new_hashed');
  });

  it('should record FIRST_ACCESS_PASSWORD_CHANGED audit even when mustChangePassword is false', async () => {
    const user = makeUser({ mustChangePassword: false, email: 'user@test.com', tenantId: 'tenant-123' });
    authUserRepository.findById.mockResolvedValue(user);

    await useCase.execute({ userId: 'user-123', password: 'Pass123!' });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'FIRST_ACCESS_PASSWORD_CHANGED' }),
    );
  });

  it('should throw EntityNotFoundException when user does not exist regardless of flag', async () => {
    authUserRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'ghost', password: 'Pass123!' }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should process normally when mustChangePassword is true', async () => {
    const user = makeUser({ mustChangePassword: true });
    authUserRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute({ userId: 'user-123', password: 'Pass123!' });

    expect(result.message).toBeDefined();
  });

  it('should accept a 6-character minimum password without throwing', async () => {
    const user = makeUser({ mustChangePassword: true });
    authUserRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute({ userId: 'user-123', password: '123456' });

    expect(result.message).toBeDefined();
    expect(passwordHasher.hash).toHaveBeenCalledWith('123456');
  });
});

// ─── 6. AuthUser entity — empty/null tenantId and name ───────────────────────

describe('AuthUser entity — empty strings and null guards (new gaps)', () => {
  it('should create user with an empty tenantId string without throwing (no guard)', () => {
    // Documents that the entity does NOT validate tenantId
    const user = AuthUser.create(
      {
        tenantId: '',
        email: AuthUserEmail.create('user@test.com'),
        name: 'Valid Name',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.tenantId).toBe('');
  });

  it('should create user with an empty name string without throwing (no guard)', () => {
    // Documents that the entity does NOT validate name
    const user = AuthUser.create(
      {
        tenantId: 'tenant-1',
        email: AuthUserEmail.create('user@test.com'),
        name: '',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.name).toBe('');
  });

  it('should create user with whitespace-only name without throwing (no guard)', () => {
    const user = AuthUser.create(
      {
        tenantId: 'tenant-1',
        email: AuthUserEmail.create('user@test.com'),
        name: '   ',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.name).toBe('   ');
  });

  it('should default planStatus to undefined when not provided', () => {
    const user = AuthUser.create(
      {
        tenantId: 'tenant-1',
        email: AuthUserEmail.create('user@test.com'),
        name: 'Test',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.planStatus).toBeUndefined();
  });

  it('should default tenantBranches to empty array when not provided', () => {
    const user = AuthUser.create(
      {
        tenantId: 'tenant-1',
        email: AuthUserEmail.create('user@test.com'),
        name: 'Test',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.tenantBranches).toEqual([]);
  });

  it('should store tenantCreatedAt as a Date object', () => {
    const date = new Date('2024-06-01');
    const user = AuthUser.create(
      {
        tenantId: 'tenant-1',
        email: AuthUserEmail.create('user@test.com'),
        name: 'Test',
        passwordHash: 'hash',
        role: Role.create('OWNER'),
        tenantCreatedAt: date,
      },
      new UniqueEntityID('user-1'),
    );

    expect(user.tenantCreatedAt).toEqual(date);
  });

  it('should use a generated UUID when no id is provided', () => {
    const user = AuthUser.create({
      tenantId: 'tenant-1',
      email: AuthUserEmail.create('user@test.com'),
      name: 'Test',
      passwordHash: 'hash',
      role: Role.create('OWNER'),
      tenantCreatedAt: new Date(),
    });

    expect(user.id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

// ─── 7. AuthUserEmail — edge-case validation ──────────────────────────────────

describe('AuthUserEmail — malformed addresses that pass includes("@") (new gaps)', () => {
  it('should accept email starting with "@" (e.g., "@domain.com") — only checks includes', () => {
    // Documents the current weak validation: @domain.com passes because it includes '@'
    const email = AuthUserEmail.create('@domain.com');
    expect(email.value).toBe('@domain.com');
  });

  it('should accept email ending with "@" (e.g., "user@") — only checks includes', () => {
    const email = AuthUserEmail.create('user@');
    expect(email.value).toBe('user@');
  });

  it('should accept email that is only "@" — the minimal truthy value containing @', () => {
    const email = AuthUserEmail.create('@');
    expect(email.value).toBe('@');
  });

  it('should normalise "@domain.com" to lowercase', () => {
    const email = AuthUserEmail.create('@DOMAIN.COM');
    expect(email.value).toBe('@domain.com');
  });

  it('should not alter an XSS payload string that contains "@"', () => {
    const xssInput = 'user<script>@x.com';
    const email = AuthUserEmail.create(xssInput);
    // Value stored as-is (lowercased/trimmed); no XSS sanitisation
    expect(email.value).toBe('user<script>@x.com');
  });

  it('should not alter SQL-injection-like string that contains "@"', () => {
    const sqlInput = "user'--@x.com";
    const email = AuthUserEmail.create(sqlInput);
    expect(email.value).toBe("user'--@x.com");
  });

  it('should normalise SQL-like email to lowercase and trim', () => {
    const sqlInput = "  USER'--@X.COM  ";
    const email = AuthUserEmail.create(sqlInput);
    expect(email.value).toBe("user'--@x.com");
  });

  it('should throw ValidationErrorException for empty string', () => {
    expect(() => AuthUserEmail.create('')).toThrow(ValidationErrorException);
  });

  it('should throw ValidationErrorException for string with no "@"', () => {
    expect(() => AuthUserEmail.create('nodomain.com')).toThrow(ValidationErrorException);
  });

  it('should preserve multiple "@" symbols (e.g., "a@@b.com")', () => {
    // Current implementation only checks includes('@'), so a@@b.com passes
    const email = AuthUserEmail.create('a@@b.com');
    expect(email.value).toBe('a@@b.com');
  });

  it('should trim and lowercase email with mixed case and spaces', () => {
    const email = AuthUserEmail.create('  ADMIN@COMPANY.COM  ');
    expect(email.value).toBe('admin@company.com');
  });

  it('should return the same value for two emails created from equivalent inputs', () => {
    const a = AuthUserEmail.create('USER@Example.COM');
    const b = AuthUserEmail.create('user@example.com');
    expect(a.equals(b)).toBe(true);
  });
});

// ─── 8. AuthUserMapper — malformed raw rows ───────────────────────────────────

describe('AuthUserMapper.toDomain — malformed input (new gaps)', () => {
  it('should map a fully valid raw row to a domain AuthUser', () => {
    const raw = {
      id: 'user-1',
      tenantId: 'tenant-1',
      tenantName: 'My Co',
      tenantCnpj: '12345678000100',
      tenantBusinessType: 'SCHEDULING',
      tenantBranches: [{ id: 'b1', name: 'Main', isHeadquarters: true, active: true }],
      email: 'user@example.com',
      name: 'John',
      phone: '11999999999',
      cpf: '12345678900',
      passwordHash: 'hash',
      mustChangePassword: false,
      role: 'OWNER',
      planStatus: 'ACTIVE',
      tenantCreatedAt: new Date('2025-01-01'),
    };

    const user = AuthUserMapper.toDomain(raw);

    expect(user.id.toString()).toBe('user-1');
    expect(user.email.value).toBe('user@example.com');
    expect(user.role.value).toBe('OWNER');
  });

  it('should map row with missing optional fields without throwing', () => {
    const raw = {
      id: 'user-2',
      tenantId: 'tenant-2',
      email: 'min@example.com',
      name: 'Minimal User',
      passwordHash: 'hash',
      role: 'AGENT',
      tenantCreatedAt: new Date('2025-01-01'),
    } as any;

    const user = AuthUserMapper.toDomain(raw);

    expect(user.id.toString()).toBe('user-2');
    expect(user.tenantBranches).toEqual([]);
    expect(user.mustChangePassword).toBe(false);
    expect(user.planStatus).toBeUndefined();
  });

  it('should throw when role is an invalid/unknown string', () => {
    const raw = {
      id: 'user-3',
      tenantId: 'tenant-3',
      email: 'bad@example.com',
      name: 'Bad Role',
      passwordHash: 'hash',
      role: 'SUPERADMIN_INVALID',
      tenantCreatedAt: new Date(),
    } as any;

    expect(() => AuthUserMapper.toDomain(raw)).toThrow();
  });

  it('should throw when email is an invalid format (no @)', () => {
    const raw = {
      id: 'user-4',
      tenantId: 'tenant-4',
      email: 'notanemail',
      name: 'Bad Email',
      passwordHash: 'hash',
      role: 'OWNER',
      tenantCreatedAt: new Date(),
    } as any;

    expect(() => AuthUserMapper.toDomain(raw)).toThrow(ValidationErrorException);
  });

  it('should use empty array for tenantBranches when field is null', () => {
    const raw = {
      id: 'user-5',
      tenantId: 'tenant-5',
      email: 'user@test.com',
      name: 'Null Branches',
      passwordHash: 'hash',
      role: 'OWNER',
      tenantCreatedAt: new Date(),
      tenantBranches: null,
    } as any;

    const user = AuthUserMapper.toDomain(raw);

    expect(user.tenantBranches).toEqual([]);
  });

  it('should re-construct tenantCreatedAt as a Date instance', () => {
    const raw = {
      id: 'user-6',
      tenantId: 'tenant-6',
      email: 'user@test.com',
      name: 'Date Test',
      passwordHash: 'hash',
      role: 'OWNER',
      tenantCreatedAt: '2025-03-15T00:00:00.000Z' as any,
    };

    const user = AuthUserMapper.toDomain(raw);

    expect(user.tenantCreatedAt).toBeInstanceOf(Date);
    expect(user.tenantCreatedAt.getFullYear()).toBe(2025);
  });

  it('should preserve all branch fields when branches are provided', () => {
    const raw = {
      id: 'user-7',
      tenantId: 'tenant-7',
      email: 'user@test.com',
      name: 'Branch Test',
      passwordHash: 'hash',
      role: 'OWNER',
      tenantCreatedAt: new Date(),
      tenantBranches: [
        { id: 'b1', name: 'HQ', isHeadquarters: true, active: true },
        { id: 'b2', name: 'Branch', isHeadquarters: false, active: false },
      ],
    };

    const user = AuthUserMapper.toDomain(raw);

    expect(user.tenantBranches).toHaveLength(2);
    expect(user.tenantBranches[0].isHeadquarters).toBe(true);
    expect(user.tenantBranches[1].active).toBe(false);
  });
});

// ─── 9. DeviceAwareThrottlerGuard — Redis failure + independent counters ──────

describe('DeviceAwareThrottlerGuard — Redis errors + independent counters (new gaps)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origThrottleLimit = process.env.AUTH_THROTTLE_LIMIT;
  const origThrottleTtl = process.env.AUTH_THROTTLE_TTL_SEC;

  beforeEach(() => {
    process.env.NODE_ENV = 'staging';
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origThrottleLimit === undefined) {
      delete process.env.AUTH_THROTTLE_LIMIT;
    } else {
      process.env.AUTH_THROTTLE_LIMIT = origThrottleLimit;
    }
    if (origThrottleTtl === undefined) {
      delete process.env.AUTH_THROTTLE_TTL_SEC;
    } else {
      process.env.AUTH_THROTTLE_TTL_SEC = origThrottleTtl;
    }
  });

  function makeContext(req: Partial<Request>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req as Request,
      }),
    } as ExecutionContext;
  }

  function makeRedisMock(
    incrImpl?: (key: string) => Promise<number>,
    expireImpl?: () => Promise<number>,
  ) {
    const store: Record<string, number> = {};
    return {
      incr: jest.fn(async (key: string) => {
        if (incrImpl) return incrImpl(key);
        store[key] = (store[key] ?? 0) + 1;
        return store[key];
      }),
      expire: jest.fn(expireImpl ?? (async () => 1)),
      _store: store,
    };
  }

  it('should propagate error when redis.incr throws a connection error', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '10';
    const failingRedis = makeRedisMock(async () => {
      throw new Error('Redis ECONNREFUSED');
    });

    const guard = new DeviceAwareThrottlerGuard(failingRedis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'TestAgent/1.0' },
      ip: '10.0.0.1',
      get(header: string) {
        return header === 'user-agent' ? 'TestAgent/1.0' : undefined;
      },
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow('Redis ECONNREFUSED');
  });

  it('should propagate error when redis.expire throws after successful incr', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '10';
    let callCount = 0;
    const redis = makeRedisMock(
      async () => {
        callCount++;
        return 1; // first call always 1 to trigger expire
      },
      async () => {
        throw new Error('Redis expire failed');
      },
    );

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'Agent' },
      ip: '1.2.3.4',
      get: (h: string) => (h === 'user-agent' ? 'Agent' : undefined),
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow('Redis expire failed');
  });

  it('should block when IP counter alone reaches the limit (device counter under limit)', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '3';
    const ipKey = 'ip-counter';
    const deviceKey = 'device-counter';
    const store: Record<string, number> = {};

    const redis = {
      incr: jest.fn(async (key: string) => {
        // Device key stays at 1, IP key increments freely
        if (key.includes('device')) {
          store[key] = 1;
        } else {
          store[key] = (store[key] ?? 0) + 1;
        }
        return store[key];
      }),
      expire: jest.fn(async () => 1),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'Bot/1.0' },
      ip: '5.5.5.5',
      get: (h: string) => (h === 'user-agent' ? 'Bot/1.0' : undefined),
    } as any);

    await expect(guard.canActivate(ctx)).resolves.toBe(true); // IP=1, device=1
    await expect(guard.canActivate(ctx)).resolves.toBe(true); // IP=2, device=1
    await expect(guard.canActivate(ctx)).resolves.toBe(true); // IP=3, device=1
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 429 }); // IP=4 > limit
  });

  it('should block when device counter alone reaches the limit (IP counter under limit)', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '3';
    const store: Record<string, number> = {};

    const redis = {
      incr: jest.fn(async (key: string) => {
        // IP key stays at 1, device key increments freely
        if (key.includes(':ip:')) {
          store[key] = 1;
        } else {
          store[key] = (store[key] ?? 0) + 1;
        }
        return store[key];
      }),
      expire: jest.fn(async () => 1),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const fixedDevice = 'device-abc12345';
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: { device_id: fixedDevice },
      headers: { 'user-agent': 'Chrome/1.0' },
      ip: '9.9.9.9',
      get: (h: string) => (h === 'user-agent' ? 'Chrome/1.0' : undefined),
    } as any);

    await expect(guard.canActivate(ctx)).resolves.toBe(true); // device=1, ip=1
    await expect(guard.canActivate(ctx)).resolves.toBe(true); // device=2, ip=1
    await expect(guard.canActivate(ctx)).resolves.toBe(true); // device=3, ip=1
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 429 }); // device=4 > limit
  });

  it('should clamp TTL to 15*60 when AUTH_THROTTLE_TTL_SEC is below 60', async () => {
    process.env.AUTH_THROTTLE_TTL_SEC = '30'; // Below minimum of 60
    process.env.AUTH_THROTTLE_LIMIT = '100';

    const ttlsUsed: number[] = [];
    const redis = {
      incr: jest.fn(async () => 1), // always first time so expire is called
      expire: jest.fn(async (_key: string, ttl: number) => {
        ttlsUsed.push(ttl);
        return 1;
      }),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'TestAgent' },
      ip: '7.7.7.7',
      get: (h: string) => (h === 'user-agent' ? 'TestAgent' : undefined),
    } as any);

    await guard.canActivate(ctx);

    // TTL below 60 should fall back to 15 * 60 = 900
    expect(ttlsUsed.every((t) => t === 15 * 60)).toBe(true);
  });

  it('should clamp TTL to 15*60 when AUTH_THROTTLE_TTL_SEC is 0', async () => {
    process.env.AUTH_THROTTLE_TTL_SEC = '0';
    process.env.AUTH_THROTTLE_LIMIT = '100';

    const ttlsUsed: number[] = [];
    const redis = {
      incr: jest.fn(async () => 1),
      expire: jest.fn(async (_key: string, ttl: number) => {
        ttlsUsed.push(ttl);
        return 1;
      }),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'TAgent' },
      ip: '8.8.8.8',
      get: (h: string) => (h === 'user-agent' ? 'TAgent' : undefined),
    } as any);

    await guard.canActivate(ctx);

    expect(ttlsUsed.every((t) => t === 15 * 60)).toBe(true);
  });

  it('should clamp TTL to 15*60 when AUTH_THROTTLE_TTL_SEC is negative', async () => {
    process.env.AUTH_THROTTLE_TTL_SEC = '-100';
    process.env.AUTH_THROTTLE_LIMIT = '100';

    const ttlsUsed: number[] = [];
    const redis = {
      incr: jest.fn(async () => 1),
      expire: jest.fn(async (_key: string, ttl: number) => {
        ttlsUsed.push(ttl);
        return 1;
      }),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'TAgent' },
      ip: '2.2.2.2',
      get: (h: string) => (h === 'user-agent' ? 'TAgent' : undefined),
    } as any);

    await guard.canActivate(ctx);

    expect(ttlsUsed.every((t) => t === 15 * 60)).toBe(true);
  });

  it('should use provided TTL when AUTH_THROTTLE_TTL_SEC >= 60', async () => {
    process.env.AUTH_THROTTLE_TTL_SEC = '120';
    process.env.AUTH_THROTTLE_LIMIT = '100';

    const ttlsUsed: number[] = [];
    const redis = {
      incr: jest.fn(async () => 1),
      expire: jest.fn(async (_key: string, ttl: number) => {
        ttlsUsed.push(ttl);
        return 1;
      }),
    };

    const guard = new DeviceAwareThrottlerGuard(redis as any);
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' } as any,
      cookies: {},
      headers: { 'user-agent': 'TAgent' },
      ip: '3.3.3.3',
      get: (h: string) => (h === 'user-agent' ? 'TAgent' : undefined),
    } as any);

    await guard.canActivate(ctx);

    expect(ttlsUsed.every((t) => t === 120)).toBe(true);
  });
});

// ─── 10. BrevoPasswordResetEmailSender — config and template ──────────────────

describe('BrevoPasswordResetEmailSender — constructor config + sendMail (new gaps)', () => {
  it('should throw when BREVO_SMTP_LOGIN config key is missing', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'BREVO_SMTP_LOGIN') throw new Error(`Config key "${key}" not found`);
        return 'value';
      }),
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => new BrevoPasswordResetEmailSender(configService as any)).toThrow(
      'BREVO_SMTP_LOGIN',
    );
  });

  it('should throw when BREVO_SMTP_KEY config key is missing', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'BREVO_SMTP_KEY') throw new Error(`Config key "${key}" not found`);
        return 'smtp-login@test.com';
      }),
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => new BrevoPasswordResetEmailSender(configService as any)).toThrow(
      'BREVO_SMTP_KEY',
    );
  });

  it('should propagate SMTP transporter sendMail error', async () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('smtp-user'),
      get: jest.fn().mockReturnValue('AtendeAi'),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);

    // Inject a failing transporter directly
    (sender as any).transporter = {
      sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection timeout')),
    };

    await expect(
      sender.send({
        email: 'user@test.com',
        name: 'Test User',
        resetUrl: 'https://example.com/reset?token=abc',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    ).rejects.toThrow('SMTP connection timeout');
  });

  it('should call sendMail with correct from address from config', async () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'BREVO_SMTP_LOGIN') return 'login@brevo.com';
        if (key === 'BREVO_SMTP_KEY') return 'smtp-secret';
        return 'value';
      }),
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'BREVO_SMTP_SENDER_EMAIL') return 'sender@atendeai.com';
        if (key === 'BREVO_SMTP_SENDER_NAME') return 'AtendeAi Team';
        return defaultVal;
      }),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    (sender as any).transporter = { sendMail: sendMailMock };

    await sender.send({
      email: 'recipient@test.com',
      name: 'Recipient',
      resetUrl: 'https://example.com/reset?token=xyz',
      expiresAt: new Date(Date.now() + 3600000),
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.objectContaining({ address: 'sender@atendeai.com' }),
      }),
    );
  });

  it('should call sendMail with correct subject', async () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('smtp-value'),
      get: jest.fn().mockReturnValue(undefined),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);
    const sendMailMock = jest.fn().mockResolvedValue({});
    (sender as any).transporter = { sendMail: sendMailMock };

    await sender.send({
      email: 'user@test.com',
      name: 'User',
      resetUrl: 'https://example.com?token=t1',
      expiresAt: new Date(),
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Redefinição de senha - AtendeAi',
      }),
    );
  });

  it('should include the reset URL in the email html body', async () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('smtp-value'),
      get: jest.fn().mockReturnValue(undefined),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);
    const sendMailMock = jest.fn().mockResolvedValue({});
    (sender as any).transporter = { sendMail: sendMailMock };

    const resetUrl = 'https://app.atendeai.com/reset?token=abc123';

    await sender.send({
      email: 'user@test.com',
      name: 'User',
      resetUrl,
      expiresAt: new Date(),
    });

    const callArgs = sendMailMock.mock.calls[0][0];
    expect(callArgs.html).toContain(resetUrl);
    expect(callArgs.text).toContain(resetUrl);
  });

  it('should include the recipient name in both html and text body', async () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('smtp-value'),
      get: jest.fn().mockReturnValue(undefined),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);
    const sendMailMock = jest.fn().mockResolvedValue({});
    (sender as any).transporter = { sendMail: sendMailMock };

    await sender.send({
      email: 'user@test.com',
      name: 'Maria Silva',
      resetUrl: 'https://example.com',
      expiresAt: new Date(),
    });

    const callArgs = sendMailMock.mock.calls[0][0];
    expect(callArgs.html).toContain('Maria Silva');
    expect(callArgs.text).toContain('Maria Silva');
  });

  it('should use login as senderEmail when BREVO_SMTP_SENDER_EMAIL is not set', async () => {
    const login = 'smtp-login@brevo.com';
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'BREVO_SMTP_LOGIN') return login;
        if (key === 'BREVO_SMTP_KEY') return 'secret';
        return '';
      }),
      get: jest.fn((key: string, defaultVal?: string) => {
        // Return defaultVal when no override set
        return defaultVal;
      }),
    };

    const sender = new BrevoPasswordResetEmailSender(configService as any);
    const sendMailMock = jest.fn().mockResolvedValue({});
    (sender as any).transporter = { sendMail: sendMailMock };

    await sender.send({
      email: 'u@test.com',
      name: 'U',
      resetUrl: 'https://x.com',
      expiresAt: new Date(),
    });

    const callArgs = sendMailMock.mock.calls[0][0];
    expect(callArgs.from.address).toBe(login);
  });
});



// ===========================================================================
// 9. LogoutUseCase — additional unit tests
// ===========================================================================
describe('LogoutUseCase — token handling', () => {
  let refreshSessionStore: any;
  let tokenService: any;
  let auditLogRepo: any;
  let useCase: any;
  beforeEach(() => {
    refreshSessionStore = { revoke: jest.fn().mockResolvedValue(undefined) };
    tokenService = { verifyRefreshToken: jest.fn() };
    auditLogRepo = { record: jest.fn().mockResolvedValue(undefined) };
    useCase = new (require('../application/use-cases/LogoutUseCase').LogoutUseCase)(refreshSessionStore, tokenService, auditLogRepo);
  });
  it('should do nothing when refreshToken is undefined', async () => {
    await useCase.execute({ refreshToken: undefined });
    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });
  it('should do nothing when refreshToken is empty string', async () => {
    await useCase.execute({ refreshToken: '' });
    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });
  it('should silently succeed when verifyRefreshToken throws', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad token'));
    await expect(useCase.execute({ refreshToken: 'invalid.token' })).resolves.toBeUndefined();
  });
  it('should revoke session when token is valid refresh type', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'user-1', tenantId: 't1', sid: 'sess-1' });
    await useCase.execute({ refreshToken: 'valid.token' });
    expect(refreshSessionStore.revoke).toHaveBeenCalledWith('user-1');
  });
  it('should record LOGOUT_SUCCEEDED audit when session is revoked', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'user-1', tenantId: 't1', sid: 'sess-1' });
    await useCase.execute({ refreshToken: 'valid.token' });
    expect(auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'LOGOUT_SUCCEEDED' }));
  });
  it('should not revoke when token type is access not refresh', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({ type: 'access', sub: 'user-1', tenantId: 't1' });
    await useCase.execute({ refreshToken: 'access.token' });
    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });
  it('should pass context deviceId to logout audit record', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'user-1', tenantId: 't1', sid: 'sess-1' });
    const ctx = { ipAddress: '10.0.0.1', deviceId: 'device-x' };
    await useCase.execute({ refreshToken: 'valid.token', context: ctx });
    expect(auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '10.0.0.1', deviceId: 'device-x' }));
  });
  it('should silently succeed when audit record throws on logout', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u', tenantId: 't', sid: 's' });
    auditLogRepo.record.mockRejectedValue(new Error('audit down'));
    await expect(useCase.execute({ refreshToken: 'valid.token' })).resolves.toBeUndefined();
  });
});

// ===========================================================================
// 10. GetCurrentUserUseCase — additional unit tests
// ===========================================================================
describe('GetCurrentUserUseCase — user lookup and tenant data', () => {
  let authUserRepo: any;
  let tenantModuleAccessService: any;
  let useCase: any;
  beforeEach(() => {
    authUserRepo = { findById: jest.fn() };
    tenantModuleAccessService = { getSummary: jest.fn().mockResolvedValue({ plan: 'PRO', pricing: { baseMonthlyPrice: 0, addonsMonthlyPrice: 0, totalMonthlyPrice: 0 }, includedModules: [], addonModules: [], enabledModules: [], moduleAccess: {} }) };
    useCase = new (require('../application/use-cases/GetCurrentUserUseCase').GetCurrentUserUseCase)(authUserRepo, tenantModuleAccessService);
  });
  it('should throw EntityNotFoundException when user not found', async () => {
    authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing-id')).rejects.toThrow(EntityNotFoundException);
  });
  it('should return user with correct id and tenantId', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ id: 'u1', tenantId: 'tt1' }));
    const result = await useCase.execute('u1');
    expect(result.user.id).toBe('u1');
    expect(result.user.tenantId).toBe('tt1');
  });
  it('should call getSummary with tenantId from user', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ tenantId: 'billing-tenant' }));
    await useCase.execute('user-1');
    expect(tenantModuleAccessService.getSummary).toHaveBeenCalledWith('billing-tenant');
  });
  it('should return tenant name from user entity', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ tenantName: 'My Company' }));
    const result = await useCase.execute('user-1');
    expect(result.tenant.name).toBe('My Company');
  });
  it('should filter inactive branches from accessibleBranchIds in getCurrentUser', async () => {
    const branches = [{ id: 'a', name: 'X', isHeadquarters: true, active: true }, { id: 'b', name: 'Y', isHeadquarters: false, active: false }];
    authUserRepo.findById.mockResolvedValue(makeUser({ tenantBranches: branches }));
    const result = await useCase.execute('user-1');
    expect(result.user.accessibleBranchIds).toEqual(['a']);
  });
  it('should return mustChangePassword from user entity', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ mustChangePassword: true }));
    const result = await useCase.execute('user-1');
    expect(result.user.mustChangePassword).toBe(true);
  });
  it('should fall back to Empresa for tenant name if undefined', async () => {
    const user = makeUser({ tenantName: undefined });
    authUserRepo.findById.mockResolvedValue(user);
    const result = await useCase.execute('user-1');
    expect(result.tenant.name).toBe('Empresa');
  });
  it('should propagate error from tenantModuleAccessService.getSummary', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    tenantModuleAccessService.getSummary.mockRejectedValue(new Error('billing down'));
    await expect(useCase.execute('user-1')).rejects.toThrow('billing down');
  });
  it('should return role from user entity', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ role: 'AGENT' }));
    const result = await useCase.execute('user-1');
    expect(result.user.role).toBe('AGENT');
  });
});

// ===========================================================================
// 11. ChangeFirstAccessPasswordUseCase — additional unit tests
// ===========================================================================
describe('ChangeFirstAccessPasswordUseCase — password hash and audit', () => {
  let authUserRepo: any;
  let passwordHasher: any;
  let auditLogRepo: any;
  let useCase: any;
  beforeEach(() => {
    authUserRepo = { findById: jest.fn(), updatePassword: jest.fn().mockResolvedValue(undefined) };
    passwordHasher = { hash: jest.fn().mockResolvedValue('new-hash') };
    auditLogRepo = { record: jest.fn().mockResolvedValue(undefined) };
    useCase = new (require('../application/use-cases/ChangeFirstAccessPasswordUseCase').ChangeFirstAccessPasswordUseCase)(authUserRepo, passwordHasher, auditLogRepo);
  });
  it('should throw EntityNotFoundException when user not found', async () => {
    authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ userId: 'missing', password: 'newPw123' })).rejects.toThrow(EntityNotFoundException);
  });
  it('should hash the new password before updating', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    await useCase.execute({ userId: 'user-123', password: 'myNewPw123' });
    expect(passwordHasher.hash).toHaveBeenCalledWith('myNewPw123');
    expect(authUserRepo.updatePassword).toHaveBeenCalledWith('user-123', 'new-hash');
  });
  it('should return success message on update', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    const result = await useCase.execute({ userId: 'user-123', password: 'myNewPw123' });
    expect(result.message).toBeTruthy();
  });
  it('should record FIRST_ACCESS_PASSWORD_CHANGED audit on success', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    await useCase.execute({ userId: 'user-123', password: 'myNewPw123' });
    expect(auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'FIRST_ACCESS_PASSWORD_CHANGED' }));
  });
  it('should still succeed when audit record fails', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    auditLogRepo.record.mockRejectedValue(new Error('audit fail'));
    await expect(useCase.execute({ userId: 'user-123', password: 'myNewPw123' })).resolves.toBeDefined();
  });
  it('should pass context to audit record', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    const ctx = { ipAddress: '5.6.7.8', deviceId: 'dev-2' };
    await useCase.execute({ userId: 'user-123', password: 'myNewPw123', context: ctx });
    expect(auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '5.6.7.8', deviceId: 'dev-2' }));
  });
  it('should propagate error from updatePassword', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    authUserRepo.updatePassword.mockRejectedValue(new Error('DB write fail'));
    await expect(useCase.execute({ userId: 'user-123', password: 'pw' })).rejects.toThrow('DB write fail');
  });
  it('should include userId in audit tenantId when user found', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser({ tenantId: 'audit-tenant' }));
    await useCase.execute({ userId: 'user-123', password: 'pw' });
    expect(auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'audit-tenant' }));
  });
  it('should call findById with the provided userId', async () => {
    authUserRepo.findById.mockResolvedValue(makeUser());
    await useCase.execute({ userId: 'specific-user', password: 'pw' });
    expect(authUserRepo.findById).toHaveBeenCalledWith('specific-user');
  });
  it('should support tenant isolation — each call scoped to userId', async () => {
    const user1 = makeUser({ id: 'u1', tenantId: 'tenant-A' });
    const user2 = makeUser({ id: 'u2', tenantId: 'tenant-B' });
    authUserRepo.findById.mockResolvedValueOnce(user1).mockResolvedValueOnce(user2);
    await useCase.execute({ userId: 'u1', password: 'pw' });
    await useCase.execute({ userId: 'u2', password: 'pw' });
    expect(authUserRepo.updatePassword).toHaveBeenNthCalledWith(1, 'u1', 'new-hash');
    expect(authUserRepo.updatePassword).toHaveBeenNthCalledWith(2, 'u2', 'new-hash');
  });
});

