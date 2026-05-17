import { RefreshTokenUseCase } from '../RefreshTokenUseCase';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let authUserRepo: any;
  let tokenService: any;
  let refreshSessionStore: any;
  let authAuditLogRepository: any;

  function createMockUser(
    overrides: Partial<{
      id: string;
      tenantId: string;
      email: string;
      role: string;
    }> = {},
  ) {
    return AuthUser.create(
      {
        tenantId: overrides.tenantId ?? 'tenant-1',
        email: AuthUserEmail.create(overrides.email ?? 'user@test.com'),
        name: 'Test User',
        passwordHash: 'hashed',
        role: Role.create(overrides.role ?? 'AGENT'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID(overrides.id ?? 'user-1'),
    );
  }

  beforeEach(() => {
    authUserRepo = { findById: jest.fn() };
    tokenService = {
      verifyRefreshToken: jest.fn(),
      signAccessToken: jest.fn().mockResolvedValue('new_access_token'),
      signRefreshToken: jest.fn().mockResolvedValue('new_refresh_token'),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    };
    refreshSessionStore = {
      isValid: jest.fn(),
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

  it('should return new tokens on valid refresh token and active session', async () => {
    const mockUser = createMockUser();
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-old',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute({ refreshToken: 'valid_refresh' });

    expect(result.accessToken).toBe('new_access_token');
    expect(result.refreshToken).toBe('new_refresh_token');
  });

  it('should throw UnauthorizedException when token is expired/invalid', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(
      new Error('Token expired'),
    );

    await expect(
      useCase.execute({ refreshToken: 'expired_token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when session is revoked', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-revoked',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(false);

    await expect(
      useCase.execute({ refreshToken: 'valid_token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should rotate session (generate new sessionId)', async () => {
    const mockUser = createMockUser();
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'old-session-id',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);

    await useCase.execute({ refreshToken: 'valid_refresh' });

    const savedSessionId = refreshSessionStore.save.mock.calls[0][1];
    expect(savedSessionId).not.toBe('old-session-id');
    expect(savedSessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should save new session (previous session is implicitly invalidated by rotation)', async () => {
    const mockUser = createMockUser();
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'old-session',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);

    await useCase.execute({ refreshToken: 'valid_refresh' });

    expect(refreshSessionStore.save).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      604800,
    );
  });

  it('should throw UnauthorizedException when token is malformed (missing sid)', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      type: 'refresh',
      // sid is missing
    });

    await expect(
      useCase.execute({ refreshToken: 'malformed_token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should register audit REFRESH_SUCCEEDED on success', async () => {
    const mockUser = createMockUser();
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'old-session',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);

    await useCase.execute({
      refreshToken: 'valid_refresh',
      context: { ipAddress: '10.0.0.1', userAgent: 'Agent', deviceId: 'dev-1' },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REFRESH_SUCCEEDED',
        userId: 'user-1',
        tenantId: 'tenant-1',
        metadata: expect.objectContaining({ previousSessionId: 'old-session' }),
      }),
    );
  });

  it('should maintain same tenantId and userId in new tokens', async () => {
    const mockUser = createMockUser({ id: 'user-42', tenantId: 'tenant-42' });
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-42',
      tenantId: 'tenant-42',
      sid: 'session-1',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);

    await useCase.execute({ refreshToken: 'valid_refresh' });

    expect(tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-42',
        tenantId: 'tenant-42',
      }),
    );
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-42',
        tenantId: 'tenant-42',
      }),
    );
  });
});
