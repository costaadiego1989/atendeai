import { LoginUseCase } from '../LoginUseCase';
import {
  UnauthorizedException,
  ForbiddenException,
} from '@shared/domain/exceptions/DomainExceptions';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let authUserRepo: any;
  let tokenService: any;
  let passwordHasher: any;
  let refreshSessionStore: any;
  let authAuditLogRepository: any;
  let tenantModuleAccessService: any;

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
    includedModules: ['messaging', 'scheduling'],
    addonModules: [],
    enabledModules: ['messaging', 'scheduling'],
    moduleAccess: { messaging: true, scheduling: true },
  };

  function createMockUser(
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
          {
            id: 'branch-1',
            name: 'Matriz',
            isHeadquarters: true,
            active: true,
          },
          {
            id: 'branch-2',
            name: 'Filial',
            isHeadquarters: false,
            active: false,
          },
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

  beforeEach(() => {
    authUserRepo = { findByEmail: jest.fn() };
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('access_token_123'),
      signRefreshToken: jest.fn().mockResolvedValue('refresh_token_123'),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    };
    passwordHasher = { compare: jest.fn() };
    refreshSessionStore = { save: jest.fn() };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };
    tenantModuleAccessService = {
      getSummary: jest.fn().mockResolvedValue(mockBillingAccess),
    };

    useCase = new LoginUseCase(
      authUserRepo,
      tokenService,
      passwordHasher,
      refreshSessionStore,
      authAuditLogRepository,
      tenantModuleAccessService,
    );
  });

  it('should return tokens, user and tenant on valid credentials', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@test.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('access_token_123');
    expect(result.refreshToken).toBe('refresh_token_123');
    expect(result.user.id).toBe('user-123');
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.role).toBe('OWNER');
    expect(result.user.tenantId).toBe('tenant-123');
    expect(result.user.name).toBe('Test User');
    expect(result.tenant.id).toBe('tenant-123');
    expect(result.tenant.name).toBe('Tenant Test');
    expect(result.tenant.billingAccess).toEqual(mockBillingAccess);
  });

  it('should throw UnauthorizedException when email does not exist', async () => {
    authUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'unknown@test.com', password: 'pass' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password is wrong', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException when trial is expired', async () => {
    const mockUser = createMockUser({ planStatus: 'TRIAL_EXPIRED' });
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'pass' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should generate a unique refreshSessionId', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sid: expect.any(String),
        type: 'refresh',
      }),
    );
    const sid = tokenService.signRefreshToken.mock.calls[0][0].sid;
    expect(sid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should register audit LOGIN_SUCCEEDED on success', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOGIN_SUCCEEDED',
        userId: 'user-123',
        tenantId: 'tenant-123',
        email: 'test@test.com',
      }),
    );
  });

  it('should register audit LOGIN_FAILED when user not found', async () => {
    authUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'unknown@test.com', password: 'pass' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOGIN_FAILED',
        email: 'unknown@test.com',
        metadata: expect.objectContaining({ reason: 'USER_NOT_FOUND' }),
      }),
    );
  });

  it('should register audit LOGIN_FAILED when password is invalid', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@test.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOGIN_FAILED',
        userId: 'user-123',
        metadata: expect.objectContaining({ reason: 'INVALID_PASSWORD' }),
      }),
    );
  });

  it('should include billingAccess in response', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(result.tenant.billingAccess).toBeDefined();
    expect(result.tenant.billingAccess).toEqual(mockBillingAccess);
    expect(tenantModuleAccessService.getSummary).toHaveBeenCalledWith(
      'tenant-123',
    );
  });

  it('should include active branches in response', async () => {
    const mockUser = createMockUser({
      tenantBranches: [
        { id: 'b1', name: 'Matriz', isHeadquarters: true, active: true },
        {
          id: 'b2',
          name: 'Filial Inativa',
          isHeadquarters: false,
          active: false,
        },
        { id: 'b3', name: 'Filial Ativa', isHeadquarters: false, active: true },
      ],
    });
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(result.user.accessibleBranchIds).toEqual(['b1', 'b3']);
    expect(result.tenant.branches).toHaveLength(3);
  });

  it('should propagate context (IP, userAgent, deviceId) to audit', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({
      email: 'test@test.com',
      password: 'pass',
      context: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-abc',
      },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-abc',
      }),
    );
  });

  it('should include mustChangePassword=true in response when set', async () => {
    const mockUser = createMockUser({ mustChangePassword: true });
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(result.user.mustChangePassword).toBe(true);
  });

  it('should call tokenService with correct payload', async () => {
    const mockUser = createMockUser({ role: 'ADMIN' });
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        tenantId: 'tenant-123',
        email: 'test@test.com',
        role: 'ADMIN',
        type: 'access',
      }),
    );
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        tenantId: 'tenant-123',
        type: 'refresh',
        sid: expect.any(String),
      }),
    );
  });

  it('should save session with correct TTL', async () => {
    const mockUser = createMockUser();
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@test.com', password: 'pass' });

    expect(refreshSessionStore.save).toHaveBeenCalledWith(
      'user-123',
      expect.any(String),
      604800,
    );
  });
});
