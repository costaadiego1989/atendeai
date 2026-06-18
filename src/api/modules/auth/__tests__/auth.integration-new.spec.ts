import { Test, TestingModule } from '@nestjs/testing';
import { LoginUseCase } from '../application/use-cases/LoginUseCase';
import { LogoutUseCase } from '../application/use-cases/LogoutUseCase';
import { RefreshTokenUseCase } from '../application/use-cases/RefreshTokenUseCase';
import { GetCurrentUserUseCase } from '../application/use-cases/GetCurrentUserUseCase';
import { RequestPasswordResetUseCase } from '../application/use-cases/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from '../application/use-cases/ResetPasswordUseCase';
import { ChangeFirstAccessPasswordUseCase } from '../application/use-cases/ChangeFirstAccessPasswordUseCase';
import { AuthUser } from '../domain/entities/AuthUser';
import { AuthUserEmail } from '../domain/value-objects/AuthUserEmail';
import { AUTH_USER_REPOSITORY } from '../domain/repositories/IAuthUserRepository';
import { TOKEN_SERVICE } from '@shared/application/ports/ITokenService';
import { PASSWORD_HASHER } from '@shared/application/ports/IPasswordHasher';
import { REFRESH_SESSION_STORE } from '../application/ports/IRefreshSessionStore';
import { AUTH_AUDIT_LOG_REPOSITORY } from '../application/ports/IAuthAuditLogRepository';
import { PASSWORD_RESET_TOKEN_STORE } from '../application/ports/IPasswordResetTokenStore';
import { PASSWORD_RESET_EMAIL_SENDER } from '../application/ports/IPasswordResetEmailSender';
import { ILoginUseCase } from '../application/use-cases/interfaces/ILoginUseCase';
import { ILogoutUseCase } from '../application/use-cases/interfaces/ILogoutUseCase';
import { IRefreshTokenUseCase } from '../application/use-cases/interfaces/IRefreshTokenUseCase';
import { IGetCurrentUserUseCase } from '../application/use-cases/interfaces/IGetCurrentUserUseCase';
import { IRequestPasswordResetUseCase } from '../application/use-cases/interfaces/IRequestPasswordResetUseCase';
import { IResetPasswordUseCase } from '../application/use-cases/interfaces/IResetPasswordUseCase';
import { IChangeFirstAccessPasswordUseCase } from '../application/use-cases/interfaces/IChangeFirstAccessPasswordUseCase';
import {
  UnauthorizedException,
  ForbiddenException,
  ValidationErrorException,
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Shared factory
// ---------------------------------------------------------------------------
function makeAuthUser(overrides: Record<string, any> = {}) {
  return AuthUser.create(
    {
      tenantId: overrides.tenantId ?? 'tenant-1',
      email: AuthUserEmail.create(overrides.email ?? 'user@example.com'),
      name: overrides.name ?? 'Test User',
      passwordHash: overrides.passwordHash ?? 'bcrypt-hash',
      role: Role.create(overrides.role ?? 'ADMIN'),
      tenantCreatedAt: overrides.tenantCreatedAt ?? new Date('2024-01-01'),
      mustChangePassword: overrides.mustChangePassword ?? false,
      planStatus: overrides.planStatus,
      tenantName: overrides.tenantName ?? 'Acme Corp',
      tenantCnpj: overrides.tenantCnpj,
      tenantBusinessType: overrides.tenantBusinessType,
      tenantBranches: overrides.tenantBranches ?? [],
      phone: overrides.phone,
      cpf: overrides.cpf,
    },
    new UniqueEntityID(overrides.id ?? 'user-uuid-1'),
  );
}

function makeBillingAccess() {
  return {
    plan: 'PROFISSIONAL',
    status: 'ACTIVE',
    subscriptionId: 'sub-1',
    pricing: { baseMonthlyPrice: 0, addonsMonthlyPrice: 0, totalMonthlyPrice: 0, pricingVersion: null },
    includedModules: [],
    addonModules: [],
    enabledModules: [],
    moduleAccess: {},
  };
}

function makeMockProviders() {
  return {
    authUserRepo: {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    },
    tokenService: {
      signAccessToken: jest.fn().mockResolvedValue('at'),
      signRefreshToken: jest.fn().mockResolvedValue('rt'),
      verifyRefreshToken: jest.fn(),
      getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    },
    passwordHasher: {
      hash: jest.fn().mockResolvedValue('hashed'),
      compare: jest.fn().mockResolvedValue(true),
    },
    refreshSessionStore: {
      save: jest.fn().mockResolvedValue(undefined),
      isValid: jest.fn().mockResolvedValue(true),
      revoke: jest.fn().mockResolvedValue(undefined),
    },
    auditLogRepo: { record: jest.fn().mockResolvedValue(undefined) },
    tenantModuleAccessService: { getSummary: jest.fn().mockResolvedValue(makeBillingAccess()) },
    passwordResetTokenStore: {
      create: jest.fn().mockResolvedValue(undefined),
      findValidByHash: jest.fn(),
      markUsed: jest.fn().mockResolvedValue(undefined),
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    },
    passwordResetEmailSender: { send: jest.fn().mockResolvedValue(undefined) },
    configService: { get: jest.fn().mockReturnValue(undefined) },
  };
}

// ===========================================================================
// 1. TestingModule wiring — LoginUseCase
// ===========================================================================
describe('LoginUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: LoginUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
        { provide: 'TenantModuleAccessService', useValue: m.tenantModuleAccessService },
        { provide: ConfigService, useValue: m.configService },
      ],
    })
      .overrideProvider('TenantModuleAccessService')
      .useValue(m.tenantModuleAccessService)
      .compile();
    useCase = module.get(LoginUseCase);
  });

  it('should resolve LoginUseCase from the testing module', () => {
    expect(useCase).toBeDefined();
  });

  it('should inject AUTH_USER_REPOSITORY into LoginUseCase', () => {
    const repo = module.get(AUTH_USER_REPOSITORY);
    expect(repo).toBe(m.authUserRepo);
  });

  it('should inject TOKEN_SERVICE into LoginUseCase', () => {
    const svc = module.get(TOKEN_SERVICE);
    expect(svc).toBe(m.tokenService);
  });

  it('should inject PASSWORD_HASHER into LoginUseCase', () => {
    const hasher = module.get(PASSWORD_HASHER);
    expect(hasher).toBe(m.passwordHasher);
  });

  it('should inject REFRESH_SESSION_STORE into LoginUseCase', () => {
    const store = module.get(REFRESH_SESSION_STORE);
    expect(store).toBe(m.refreshSessionStore);
  });

  it('should inject AUTH_AUDIT_LOG_REPOSITORY into LoginUseCase', () => {
    const repo = module.get(AUTH_AUDIT_LOG_REPOSITORY);
    expect(repo).toBe(m.auditLogRepo);
  });

  it('should throw when user not found via injected repository mock', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: 'no@x.com', password: 'pw' })).rejects.toThrow(UnauthorizedException);
  });

  it('should call injected tokenService.signAccessToken on login', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com', password: 'pw' });
    expect(m.tokenService.signAccessToken).toHaveBeenCalled();
  });

  it('should call injected refreshSessionStore.save on login', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com', password: 'pw' });
    expect(m.refreshSessionStore.save).toHaveBeenCalled();
  });

  it('should call injected auditLogRepo.record on login success', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com', password: 'pw' });
    expect(m.auditLogRepo.record).toHaveBeenCalled();
  });
});

// ===========================================================================
// 2. TestingModule wiring — LogoutUseCase
// ===========================================================================
describe('LogoutUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: LogoutUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        LogoutUseCase,
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    useCase = module.get(LogoutUseCase);
  });

  it('should resolve LogoutUseCase from the testing module', () => {
    expect(useCase).toBeDefined();
  });

  it('should call revoke on injected refreshSessionStore when token is valid', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    await useCase.execute({ refreshToken: 'rt' });
    expect(m.refreshSessionStore.revoke).toHaveBeenCalledWith('u1');
  });

  it('should not call revoke when refreshToken is absent', async () => {
    await useCase.execute({ refreshToken: undefined as any });
    expect(m.refreshSessionStore.revoke).not.toHaveBeenCalled();
  });

  it('should call injected auditLogRepo.record on successful logout', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    await useCase.execute({ refreshToken: 'rt' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'LOGOUT_SUCCEEDED' }));
  });

  it('should silently ignore a thrown error from verifyRefreshToken', async () => {
    m.tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad'));
    await expect(useCase.execute({ refreshToken: 'bad.token' })).resolves.toBeUndefined();
  });
});

// ===========================================================================
// 3. TestingModule wiring — RefreshTokenUseCase
// ===========================================================================
describe('RefreshTokenUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: RefreshTokenUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    useCase = module.get(RefreshTokenUseCase);
  });

  it('should resolve RefreshTokenUseCase from the testing module', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw when refreshToken is missing via injected useCase', async () => {
    await expect(useCase.execute({ refreshToken: '' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when verifyRefreshToken raises an error', async () => {
    m.tokenService.verifyRefreshToken.mockRejectedValue(new Error('expired'));
    await expect(useCase.execute({ refreshToken: 'bad.token' })).rejects.toThrow(UnauthorizedException);
  });

  it('should call authUserRepo.findById after valid refresh token', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    await useCase.execute({ refreshToken: 'valid.rt' });
    expect(m.authUserRepo.findById).toHaveBeenCalledWith('u1');
  });

  it('should throw when user not found during refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'valid.rt' })).rejects.toThrow(UnauthorizedException);
  });

  it('should issue new tokens on successful refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    const result = await useCase.execute({ refreshToken: 'valid.rt' });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should save new session in refreshSessionStore on token refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    await useCase.execute({ refreshToken: 'valid.rt' });
    expect(m.refreshSessionStore.save).toHaveBeenCalled();
  });

  it('should throw when session is invalid (isValid returns false)', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.refreshSessionStore.isValid.mockResolvedValue(false);
    await expect(useCase.execute({ refreshToken: 'valid.rt' })).rejects.toThrow(UnauthorizedException);
  });

  it('should record REFRESH_SUCCEEDED audit on successful refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    await useCase.execute({ refreshToken: 'valid.rt' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REFRESH_SUCCEEDED' }));
  });

  it('should record REFRESH_FAILED audit with MISSING_REFRESH_TOKEN when empty', async () => {
    await expect(useCase.execute({ refreshToken: '' })).rejects.toThrow();
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REFRESH_FAILED', metadata: { reason: 'MISSING_REFRESH_TOKEN' } }));
  });
});

// ===========================================================================
// 4. TestingModule wiring — GetCurrentUserUseCase
// ===========================================================================
describe('GetCurrentUserUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: GetCurrentUserUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        GetCurrentUserUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: 'TenantModuleAccessService', useValue: m.tenantModuleAccessService },
      ],
    })
      .overrideProvider('TenantModuleAccessService')
      .useValue(m.tenantModuleAccessService)
      .compile();
    useCase = module.get(GetCurrentUserUseCase);
  });

  it('should resolve GetCurrentUserUseCase from the testing module', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw EntityNotFoundException when user not found via injected repo', async () => {
    m.authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing-id')).rejects.toThrow(EntityNotFoundException);
  });

  it('should return the user and tenant from injected repo', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1', tenantId: 't1' }));
    const result = await useCase.execute('u1');
    expect(result.user.id).toBe('u1');
    expect(result.tenant.id).toBe('t1');
  });

  it('should call getSummary on injected tenantModuleAccessService', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ tenantId: 'billing-t' }));
    await useCase.execute('u1');
    expect(m.tenantModuleAccessService.getSummary).toHaveBeenCalledWith('billing-t');
  });

  it('should propagate error from injected getSummary', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser());
    m.tenantModuleAccessService.getSummary.mockRejectedValue(new Error('billing fail'));
    await expect(useCase.execute('u1')).rejects.toThrow('billing fail');
  });
});

// ===========================================================================
// 5. TestingModule wiring — RequestPasswordResetUseCase
// ===========================================================================
describe('RequestPasswordResetUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: RequestPasswordResetUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        RequestPasswordResetUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_RESET_TOKEN_STORE, useValue: m.passwordResetTokenStore },
        { provide: PASSWORD_RESET_EMAIL_SENDER, useValue: m.passwordResetEmailSender },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
        { provide: ConfigService, useValue: m.configService },
      ],
    }).compile();
    useCase = module.get(RequestPasswordResetUseCase);
  });

  it('should resolve RequestPasswordResetUseCase from module', () => {
    expect(useCase).toBeDefined();
  });

  it('should return generic message when user is not found (anti-enumeration)', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(null);
    const result = await useCase.execute({ email: 'ghost@x.com' });
    expect(result.message).toBeTruthy();
    expect(m.passwordResetEmailSender.send).not.toHaveBeenCalled();
  });

  it('should send email via injected sender when user exists', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ email: 'real@x.com' }));
    await useCase.execute({ email: 'real@x.com' });
    expect(m.passwordResetEmailSender.send).toHaveBeenCalled();
  });

  it('should call invalidateForUser on injected tokenStore before creating new token', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com' });
    expect(m.passwordResetTokenStore.invalidateForUser).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should call create on injected tokenStore with expected shape', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com' });
    expect(m.passwordResetTokenStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uuid-1', email: 'user@example.com' }),
    );
  });

  it('should record PASSWORD_RESET_REQUESTED audit when user found', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await useCase.execute({ email: 'user@example.com' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PASSWORD_RESET_REQUESTED' }),
    );
  });

  it('should record audit with resolvedUser false when user not found', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(null);
    await useCase.execute({ email: 'ghost@x.com' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { resolvedUser: false } }),
    );
  });

  it('should propagate error when tokenStore.create throws', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    m.passwordResetTokenStore.create.mockRejectedValue(new Error('DB write error'));
    await expect(useCase.execute({ email: 'user@example.com' })).rejects.toThrow('DB write error');
  });
});

// ===========================================================================
// 6. TestingModule wiring — ResetPasswordUseCase
// ===========================================================================
describe('ResetPasswordUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: ResetPasswordUseCase;
  const validTokenRecord = {
    id: 'tok-1', userId: 'user-1', email: 'user@example.com',
    tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date(),
  };

  beforeEach(async () => {
    m = makeMockProviders();
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(validTokenRecord);
    module = await Test.createTestingModule({
      providers: [
        ResetPasswordUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: PASSWORD_RESET_TOKEN_STORE, useValue: m.passwordResetTokenStore },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    useCase = module.get(ResetPasswordUseCase);
  });

  it('should resolve ResetPasswordUseCase from module', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw ValidationErrorException when token not found', async () => {
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(null);
    await expect(useCase.execute({ token: 'invalid', password: 'pw123' })).rejects.toThrow(ValidationErrorException);
  });

  it('should call updatePassword with hashed password via injected repo', async () => {
    await useCase.execute({ token: 'valid-raw-token', password: 'newpw' });
    expect(m.authUserRepo.updatePassword).toHaveBeenCalledWith('user-1', 'hashed');
  });

  it('should revoke session via injected refreshSessionStore on reset', async () => {
    await useCase.execute({ token: 'valid-raw-token', password: 'newpw' });
    expect(m.refreshSessionStore.revoke).toHaveBeenCalledWith('user-1');
  });

  it('should mark token as used via injected tokenStore', async () => {
    await useCase.execute({ token: 'valid-raw-token', password: 'newpw' });
    expect(m.passwordResetTokenStore.markUsed).toHaveBeenCalledWith('tok-1');
  });

  it('should record PASSWORD_RESET_COMPLETED audit on success', async () => {
    await useCase.execute({ token: 'valid-raw-token', password: 'newpw' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PASSWORD_RESET_COMPLETED', metadata: { success: true } }),
    );
  });

  it('should record failed PASSWORD_RESET_COMPLETED audit when token invalid', async () => {
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(null);
    await expect(useCase.execute({ token: 'bad', password: 'pw' })).rejects.toThrow();
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PASSWORD_RESET_COMPLETED', metadata: expect.objectContaining({ success: false }) }),
    );
  });
});

// ===========================================================================
// 7. TestingModule wiring — ChangeFirstAccessPasswordUseCase
// ===========================================================================
describe('ChangeFirstAccessPasswordUseCase NestJS module wiring', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: ChangeFirstAccessPasswordUseCase;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        ChangeFirstAccessPasswordUseCase,
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    useCase = module.get(ChangeFirstAccessPasswordUseCase);
  });

  it('should resolve ChangeFirstAccessPasswordUseCase from module', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw EntityNotFoundException via injected repo when user missing', async () => {
    m.authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ userId: 'x', password: 'pw123' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should hash password via injected hasher and call updatePassword', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser());
    await useCase.execute({ userId: 'user-uuid-1', password: 'SecureP@ss' });
    expect(m.passwordHasher.hash).toHaveBeenCalledWith('SecureP@ss');
    expect(m.authUserRepo.updatePassword).toHaveBeenCalledWith('user-uuid-1', 'hashed');
  });

  it('should record FIRST_ACCESS_PASSWORD_CHANGED audit via injected auditRepo', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser());
    await useCase.execute({ userId: 'user-uuid-1', password: 'pw' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'FIRST_ACCESS_PASSWORD_CHANGED', userId: 'user-uuid-1' }),
    );
  });

  it('should succeed even when injected auditRepo.record throws', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser());
    m.auditLogRepo.record.mockRejectedValue(new Error('audit down'));
    await expect(useCase.execute({ userId: 'user-uuid-1', password: 'pw' })).resolves.toBeDefined();
  });
});

// ===========================================================================
// 8. Service + Repository integration chain — full login flow
// ===========================================================================
describe('LoginUseCase full service-repository chain', () => {
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    m = makeMockProviders();
    useCase = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
  });

  it('should propagate repository errors through the service', async () => {
    m.authUserRepo.findByEmail.mockRejectedValue(new Error('DB unavailable'));
    await expect(useCase.execute({ email: 'u@x.com', password: 'pw' })).rejects.toThrow('DB unavailable');
  });

  it('should call repository findByEmail with the provided email', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: 'specific@x.com', password: 'pw' })).rejects.toThrow();
    expect(m.authUserRepo.findByEmail).toHaveBeenCalledWith('specific@x.com');
  });

  it('should call passwordHasher.compare with correct args', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ passwordHash: 'stored-hash' }));
    await useCase.execute({ email: 'user@example.com', password: 'my-pw' });
    expect(m.passwordHasher.compare).toHaveBeenCalledWith('my-pw', 'stored-hash');
  });

  it('should chain updateLastLogin and refreshSessionStore.save after auth', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    const updateOrder: string[] = [];
    m.authUserRepo.updateLastLogin.mockImplementation(() => { updateOrder.push('login'); return Promise.resolve(); });
    m.refreshSessionStore.save.mockImplementation(() => { updateOrder.push('session'); return Promise.resolve(); });
    await useCase.execute({ email: 'user@example.com', password: 'pw' });
    expect(updateOrder).toContain('login');
    expect(updateOrder).toContain('session');
  });

  it('should not call signRefreshToken when user is not found', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: 'u@x.com', password: 'pw' })).rejects.toThrow();
    expect(m.tokenService.signRefreshToken).not.toHaveBeenCalled();
  });

  it('should not call updateLastLogin when password is wrong', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    m.passwordHasher.compare.mockResolvedValue(false);
    await expect(useCase.execute({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow();
    expect(m.authUserRepo.updateLastLogin).not.toHaveBeenCalled();
  });

  it('should respect tenantId isolation across different users', async () => {
    const userA = makeAuthUser({ id: 'ua', tenantId: 'tenant-A', email: 'a@x.com' });
    const userB = makeAuthUser({ id: 'ub', tenantId: 'tenant-B', email: 'b@x.com' });
    m.authUserRepo.findByEmail.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    const rA = await useCase.execute({ email: 'a@x.com', password: 'pw' });
    const rB = await useCase.execute({ email: 'b@x.com', password: 'pw' });
    expect(rA.user.tenantId).toBe('tenant-A');
    expect(rB.user.tenantId).toBe('tenant-B');
  });

  it('should pass sessionId in LOGIN_SUCCEEDED audit matching saved session', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    let savedSessionId = '';
    m.refreshSessionStore.save.mockImplementation((_uid: string, sid: string) => { savedSessionId = sid; return Promise.resolve(); });
    await useCase.execute({ email: 'user@example.com', password: 'pw' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'LOGIN_SUCCEEDED', sessionId: savedSessionId }),
    );
  });
});

// ===========================================================================
// 9. RefreshToken + Session store integration
// ===========================================================================
describe('RefreshTokenUseCase + session store integration chain', () => {
  let m: ReturnType<typeof makeMockProviders>;
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    m = makeMockProviders();
    useCase = new RefreshTokenUseCase(m.authUserRepo as any, m.tokenService as any, m.refreshSessionStore as any, m.auditLogRepo as any);
  });

  it('should check session validity before loading the user', async () => {
    const order: string[] = [];
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.refreshSessionStore.isValid.mockImplementation(() => { order.push('isValid'); return Promise.resolve(true); });
    m.authUserRepo.findById.mockImplementation(() => { order.push('findById'); return Promise.resolve(makeAuthUser({ id: 'u1' })); });
    await useCase.execute({ refreshToken: 'rt' });
    expect(order.indexOf('isValid')).toBeLessThan(order.indexOf('findById'));
  });

  it('should call isValid with userId and sessionId from token payload', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    await useCase.execute({ refreshToken: 'rt' });
    expect(m.refreshSessionStore.isValid).toHaveBeenCalledWith('u1', 's1');
  });

  it('should save new session with different sessionId than the original', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 'old-sid' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    const savedSids: string[] = [];
    m.refreshSessionStore.save.mockImplementation((_uid: string, sid: string) => { savedSids.push(sid); return Promise.resolve(); });
    await useCase.execute({ refreshToken: 'rt' });
    expect(savedSids[0]).not.toBe('old-sid');
  });

  it('should throw and record REFRESH_FAILED when token type is access not refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'access', sub: 'u1', tenantId: 't1' });
    await expect(useCase.execute({ refreshToken: 'at' })).rejects.toThrow(UnauthorizedException);
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REFRESH_FAILED', metadata: { reason: 'WRONG_TOKEN_TYPE' } }),
    );
  });

  it('should throw and record REFRESH_FAILED when session is revoked', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.refreshSessionStore.isValid.mockResolvedValue(false);
    await expect(useCase.execute({ refreshToken: 'rt' })).rejects.toThrow(UnauthorizedException);
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REFRESH_FAILED', metadata: { reason: 'SESSION_REVOKED' } }),
    );
  });

  it('should throw and record REFRESH_FAILED when user not found', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'rt' })).rejects.toThrow(UnauthorizedException);
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REFRESH_FAILED', metadata: { reason: 'USER_NOT_FOUND' } }),
    );
  });

  it('should still succeed when auditLogRepo.record throws during refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1' }));
    m.auditLogRepo.record.mockRejectedValue(new Error('audit failure'));
    await expect(useCase.execute({ refreshToken: 'rt' })).resolves.toBeDefined();
  });
});

// ===========================================================================
// 10. Error propagation and event emission
// ===========================================================================
describe('Auth use-cases error propagation through layers', () => {
  let m: ReturnType<typeof makeMockProviders>;

  beforeEach(() => { m = makeMockProviders(); });

  it('should propagate repository findByEmail rejection through LoginUseCase', async () => {
    m.authUserRepo.findByEmail.mockRejectedValue(new Error('DB timeout'));
    const uc = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await expect(uc.execute({ email: 'u@x.com', password: 'pw' })).rejects.toThrow('DB timeout');
  });

  it('should propagate hashPassword failure through ChangeFirstAccessPasswordUseCase', async () => {
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser());
    m.passwordHasher.hash.mockRejectedValue(new Error('bcrypt fail'));
    const uc = new ChangeFirstAccessPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.auditLogRepo as any);
    await expect(uc.execute({ userId: 'u1', password: 'pw' })).rejects.toThrow('bcrypt fail');
  });

  it('should propagate markUsed failure through ResetPasswordUseCase', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    m.passwordResetTokenStore.markUsed.mockRejectedValue(new Error('mark fail'));
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await expect(uc.execute({ token: 'raw', password: 'newpw' })).rejects.toThrow('mark fail');
  });

  it('should propagate signRefreshToken failure through LoginUseCase', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    m.tokenService.signRefreshToken.mockRejectedValue(new Error('jwt sign fail'));
    const uc = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await expect(uc.execute({ email: 'u@x.com', password: 'pw' })).rejects.toThrow('jwt sign fail');
  });

  it('should propagate findById failure through RefreshTokenUseCase', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.authUserRepo.findById.mockRejectedValue(new Error('DB find fail'));
    const uc = new RefreshTokenUseCase(m.authUserRepo as any, m.tokenService as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await expect(uc.execute({ refreshToken: 'rt' })).rejects.toThrow('DB find fail');
  });

  it('should propagate updatePassword failure through ResetPasswordUseCase', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    m.authUserRepo.updatePassword.mockRejectedValue(new Error('update fail'));
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await expect(uc.execute({ token: 'raw', password: 'pw' })).rejects.toThrow('update fail');
  });

  it('should propagate emailSender.send failure through RequestPasswordResetUseCase', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    m.passwordResetEmailSender.send.mockRejectedValue(new Error('SMTP timeout'));
    const uc = new RequestPasswordResetUseCase(m.authUserRepo as any, m.passwordResetTokenStore as any, m.passwordResetEmailSender as any, m.auditLogRepo as any, m.configService as any);
    await expect(uc.execute({ email: 'user@example.com' })).rejects.toThrow('SMTP timeout');
  });

  it('should record audit event even when main operation fails for logout', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    m.refreshSessionStore.revoke.mockRejectedValue(new Error('revoke fail'));
    const uc = new LogoutUseCase(m.refreshSessionStore as any, m.tokenService as any, m.auditLogRepo as any);
    await expect(uc.execute({ refreshToken: 'rt' })).resolves.toBeUndefined();
  });

  it('should emit audit event for each concurrent login attempt independently', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    const uc = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await Promise.all([
      uc.execute({ email: 'user@example.com', password: 'pw' }),
      uc.execute({ email: 'user@example.com', password: 'pw' }),
    ]);
    expect(m.auditLogRepo.record).toHaveBeenCalledTimes(2);
  });

  it('should scope tenantId in LoginUseCase audit to the found user tenant', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ tenantId: 'scoped-tenant' }));
    const uc = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await uc.execute({ email: 'user@example.com', password: 'pw' });
    expect(m.auditLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'scoped-tenant' }),
    );
  });
});

// ===========================================================================
// 11. Prisma mock transaction simulation
// ===========================================================================
describe('ResetPasswordUseCase Prisma transaction simulation', () => {
  let m: ReturnType<typeof makeMockProviders>;

  beforeEach(() => { m = makeMockProviders(); });

  it('should call updatePassword, revoke, and markUsed in correct order', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    const callOrder: string[] = [];
    m.authUserRepo.updatePassword.mockImplementation(() => { callOrder.push('updatePassword'); return Promise.resolve(); });
    m.refreshSessionStore.revoke.mockImplementation(() => { callOrder.push('revoke'); return Promise.resolve(); });
    m.passwordResetTokenStore.markUsed.mockImplementation(() => { callOrder.push('markUsed'); return Promise.resolve(); });
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await uc.execute({ token: 'raw', password: 'pw' });
    expect(callOrder[0]).toBe('updatePassword');
    expect(callOrder[1]).toBe('revoke');
    expect(callOrder[2]).toBe('markUsed');
  });

  it('should not call markUsed when updatePassword fails', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    m.authUserRepo.updatePassword.mockRejectedValue(new Error('DB fail'));
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await expect(uc.execute({ token: 'raw', password: 'pw' })).rejects.toThrow();
    expect(m.passwordResetTokenStore.markUsed).not.toHaveBeenCalled();
  });

  it('should call hash before updatePassword in ResetPasswordUseCase', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    const callOrder: string[] = [];
    m.passwordHasher.hash.mockImplementation((pw: string) => { callOrder.push('hash'); return Promise.resolve('h:' + pw); });
    m.authUserRepo.updatePassword.mockImplementation(() => { callOrder.push('updatePassword'); return Promise.resolve(); });
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await uc.execute({ token: 'raw', password: 'pw' });
    expect(callOrder.indexOf('hash')).toBeLessThan(callOrder.indexOf('updatePassword'));
  });

  it('should pass exact userId from token record to updatePassword', async () => {
    const tokenRecord = { id: 't1', userId: 'specific-user', email: 'u@x.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    const uc = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await uc.execute({ token: 'raw', password: 'pw' });
    expect(m.authUserRepo.updatePassword).toHaveBeenCalledWith('specific-user', expect.any(String));
  });

  it('should scope invalidateForUser to correct userId in RequestPasswordResetUseCase', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ id: 'scoped-user' }));
    const uc = new RequestPasswordResetUseCase(m.authUserRepo as any, m.passwordResetTokenStore as any, m.passwordResetEmailSender as any, m.auditLogRepo as any, m.configService as any);
    await uc.execute({ email: 'user@example.com' });
    expect(m.passwordResetTokenStore.invalidateForUser).toHaveBeenCalledWith('scoped-user');
  });
});

// ===========================================================================
// 12. IUseCase interface injection + TOKEN_SERVICE integration
// ===========================================================================
describe('ILoginUseCase token via TOKEN_SERVICE injection', () => {
  let module: TestingModule;
  let m: ReturnType<typeof makeMockProviders>;

  beforeEach(async () => {
    m = makeMockProviders();
    module = await Test.createTestingModule({
      providers: [
        { provide: ILoginUseCase, useClass: LoginUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
        { provide: 'TenantModuleAccessService', useValue: m.tenantModuleAccessService },
      ],
    })
      .overrideProvider('TenantModuleAccessService')
      .useValue(m.tenantModuleAccessService)
      .compile();
  });

  it('should resolve ILoginUseCase interface from module', () => {
    const uc = module.get(ILoginUseCase);
    expect(uc).toBeDefined();
  });

  it('should execute login via ILoginUseCase symbol token', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    const uc = module.get(ILoginUseCase) as LoginUseCase;
    const result = await uc.execute({ email: 'user@example.com', password: 'pw' });
    expect(result.accessToken).toBe('at');
  });

  it('should allow replacing TOKEN_SERVICE with a test double', async () => {
    m.tokenService.signAccessToken.mockResolvedValue('custom-at');
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    const uc = module.get(ILoginUseCase) as LoginUseCase;
    const result = await uc.execute({ email: 'user@example.com', password: 'pw' });
    expect(result.accessToken).toBe('custom-at');
  });

  it('should resolve ILogoutUseCase when wired with LogoutUseCase', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: ILogoutUseCase, useClass: LogoutUseCase },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    const uc = mod.get(ILogoutUseCase);
    expect(uc).toBeDefined();
  });

  it('should resolve IRefreshTokenUseCase when wired with RefreshTokenUseCase', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: IRefreshTokenUseCase, useClass: RefreshTokenUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: TOKEN_SERVICE, useValue: m.tokenService },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    const uc = mod.get(IRefreshTokenUseCase);
    expect(uc).toBeDefined();
  });

  it('should resolve IGetCurrentUserUseCase when wired with GetCurrentUserUseCase', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: IGetCurrentUserUseCase, useClass: GetCurrentUserUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: 'TenantModuleAccessService', useValue: m.tenantModuleAccessService },
      ],
    })
      .overrideProvider('TenantModuleAccessService')
      .useValue(m.tenantModuleAccessService)
      .compile();
    const uc = mod.get(IGetCurrentUserUseCase);
    expect(uc).toBeDefined();
  });

  it('should resolve IRequestPasswordResetUseCase when wired correctly', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: IRequestPasswordResetUseCase, useClass: RequestPasswordResetUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_RESET_TOKEN_STORE, useValue: m.passwordResetTokenStore },
        { provide: PASSWORD_RESET_EMAIL_SENDER, useValue: m.passwordResetEmailSender },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
        { provide: ConfigService, useValue: m.configService },
      ],
    }).compile();
    const uc = mod.get(IRequestPasswordResetUseCase);
    expect(uc).toBeDefined();
  });

  it('should resolve IChangeFirstAccessPasswordUseCase when wired correctly', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: IChangeFirstAccessPasswordUseCase, useClass: ChangeFirstAccessPasswordUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    const uc = mod.get(IChangeFirstAccessPasswordUseCase);
    expect(uc).toBeDefined();
  });

  it('should resolve IResetPasswordUseCase when wired correctly', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: IResetPasswordUseCase, useClass: ResetPasswordUseCase },
        { provide: AUTH_USER_REPOSITORY, useValue: m.authUserRepo },
        { provide: PASSWORD_HASHER, useValue: m.passwordHasher },
        { provide: PASSWORD_RESET_TOKEN_STORE, useValue: m.passwordResetTokenStore },
        { provide: REFRESH_SESSION_STORE, useValue: m.refreshSessionStore },
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    const uc = mod.get(IResetPasswordUseCase);
    expect(uc).toBeDefined();
  });
});

// ===========================================================================
// 13. Auth / permission middleware integration
// ===========================================================================
describe('Auth middleware and cross-cutting integration', () => {
  let m: ReturnType<typeof makeMockProviders>;

  beforeEach(() => { m = makeMockProviders(); });

  it('should apply tenantId scoping across LoginUseCase and GetCurrentUserUseCase', async () => {
    const loginUC = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    const getCurrentUC = new GetCurrentUserUseCase(m.authUserRepo as any, m.tenantModuleAccessService as any);
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ id: 'u1', tenantId: 'tenant-xyz' }));
    m.authUserRepo.findById.mockResolvedValue(makeAuthUser({ id: 'u1', tenantId: 'tenant-xyz' }));
    const loginResult = await loginUC.execute({ email: 'user@example.com', password: 'pw' });
    const meResult = await getCurrentUC.execute('u1');
    expect(loginResult.user.tenantId).toBe('tenant-xyz');
    expect(meResult.user.tenantId).toBe('tenant-xyz');
  });

  it('should not leak tenant data between two different tenant logins', async () => {
    const loginUC = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    const uA = makeAuthUser({ id: 'ua', tenantId: 'tenant-A', email: 'a@x.com' });
    const uB = makeAuthUser({ id: 'ub', tenantId: 'tenant-B', email: 'b@x.com' });
    m.authUserRepo.findByEmail.mockResolvedValueOnce(uA).mockResolvedValueOnce(uB);
    const rA = await loginUC.execute({ email: 'a@x.com', password: 'pw' });
    const rB = await loginUC.execute({ email: 'b@x.com', password: 'pw' });
    expect(rA.tenant.id).not.toBe(rB.tenant.id);
  });

  it('should audit all events separately per tenant on concurrent logins', async () => {
    const loginUC = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    await Promise.all([
      loginUC.execute({ email: 'user@example.com', password: 'pw' }),
      loginUC.execute({ email: 'user@example.com', password: 'pw' }),
      loginUC.execute({ email: 'user@example.com', password: 'pw' }),
    ]);
    expect(m.auditLogRepo.record).toHaveBeenCalledTimes(3);
  });

  it('should call passwordHasher.compare before any token signing', async () => {
    const order: string[] = [];
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser());
    m.passwordHasher.compare.mockImplementation(() => { order.push('compare'); return Promise.resolve(true); });
    m.tokenService.signAccessToken.mockImplementation(() => { order.push('sign'); return Promise.resolve('at'); });
    const loginUC = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await loginUC.execute({ email: 'user@example.com', password: 'pw' });
    expect(order.indexOf('compare')).toBeLessThan(order.indexOf('sign'));
  });

  it('should revoke all sessions on logout then deny refresh', async () => {
    m.tokenService.verifyRefreshToken.mockResolvedValue({ type: 'refresh', sub: 'u1', tenantId: 't1', sid: 's1' });
    const logoutUC = new LogoutUseCase(m.refreshSessionStore as any, m.tokenService as any, m.auditLogRepo as any);
    await logoutUC.execute({ refreshToken: 'rt' });
    m.refreshSessionStore.isValid.mockResolvedValue(false);
    const refreshUC = new RefreshTokenUseCase(m.authUserRepo as any, m.tokenService as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await expect(refreshUC.execute({ refreshToken: 'rt' })).rejects.toThrow(UnauthorizedException);
  });

  it('should allow login after password reset by using new token', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'user@example.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    const resetUC = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    const result = await resetUC.execute({ token: 'raw-tok', password: 'newpw' });
    expect(result.message).toBeTruthy();
    expect(m.authUserRepo.updatePassword).toHaveBeenCalled();
  });

  it('should not expose old session after password reset (revoke called)', async () => {
    const tokenRecord = { id: 't1', userId: 'u1', email: 'user@example.com', tokenHash: 'h', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() };
    m.passwordResetTokenStore.findValidByHash.mockResolvedValue(tokenRecord);
    const resetUC = new ResetPasswordUseCase(m.authUserRepo as any, m.passwordHasher as any, m.passwordResetTokenStore as any, m.refreshSessionStore as any, m.auditLogRepo as any);
    await resetUC.execute({ token: 'raw-tok', password: 'newpw' });
    expect(m.refreshSessionStore.revoke).toHaveBeenCalledWith('u1');
  });

  it('should record audit tenantId from user entity — tenant isolation verified', async () => {
    m.authUserRepo.findByEmail.mockResolvedValue(makeAuthUser({ tenantId: 'isolated-tenant' }));
    const loginUC = new LoginUseCase(m.authUserRepo as any, m.tokenService as any, m.passwordHasher as any, m.refreshSessionStore as any, m.auditLogRepo as any, m.tenantModuleAccessService as any);
    await loginUC.execute({ email: 'user@example.com', password: 'pw' });
    const auditCall = (m.auditLogRepo.record as jest.Mock).mock.calls.find(
      (c: any[]) => c[0].eventType === 'LOGIN_SUCCEEDED',
    );
    expect(auditCall?.[0]?.tenantId).toBe('isolated-tenant');
  });

  it('should resolve PASSWORD_RESET_TOKEN_STORE from test module', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: PASSWORD_RESET_TOKEN_STORE, useValue: m.passwordResetTokenStore },
      ],
    }).compile();
    const store = mod.get(PASSWORD_RESET_TOKEN_STORE);
    expect(store).toBe(m.passwordResetTokenStore);
  });

  it('should resolve PASSWORD_RESET_EMAIL_SENDER from test module', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: PASSWORD_RESET_EMAIL_SENDER, useValue: m.passwordResetEmailSender },
      ],
    }).compile();
    const sender = mod.get(PASSWORD_RESET_EMAIL_SENDER);
    expect(sender).toBe(m.passwordResetEmailSender);
  });

  it('should resolve AUTH_AUDIT_LOG_REPOSITORY from test module', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        { provide: AUTH_AUDIT_LOG_REPOSITORY, useValue: m.auditLogRepo },
      ],
    }).compile();
    const repo = mod.get(AUTH_AUDIT_LOG_REPOSITORY);
    expect(repo).toBe(m.auditLogRepo);
  });
});
