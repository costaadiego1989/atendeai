import { LogoutUseCase } from '../LogoutUseCase';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let refreshSessionStore: any;
  let tokenService: any;
  let authAuditLogRepository: any;

  beforeEach(() => {
    refreshSessionStore = { revoke: jest.fn().mockResolvedValue(undefined) };
    tokenService = { verifyRefreshToken: jest.fn() };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };
    useCase = new LogoutUseCase(
      refreshSessionStore,
      tokenService,
      authAuditLogRepository,
    );
  });

  it('should revoke session when refreshToken is valid', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'refresh',
    });

    await useCase.execute({ refreshToken: 'valid-token' });

    expect(refreshSessionStore.revoke).toHaveBeenCalledWith('user-1');
  });

  it('should not throw when refreshToken is not provided (idempotent)', async () => {
    await expect(
      useCase.execute({ refreshToken: undefined }),
    ).resolves.toBeUndefined();

    expect(tokenService.verifyRefreshToken).not.toHaveBeenCalled();
    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });

  it('should not throw when token is invalid/expired (graceful)', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(
      new Error('Token expired'),
    );

    await expect(
      useCase.execute({ refreshToken: 'expired-token' }),
    ).resolves.toBeUndefined();

    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });

  it('should register audit LOGOUT_SUCCEEDED on valid logout', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'refresh',
    });

    await useCase.execute({
      refreshToken: 'valid-token',
      context: {
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent',
        deviceId: 'dev-1',
      },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOGOUT_SUCCEEDED',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent',
        deviceId: 'dev-1',
      }),
    );
  });

  it('should invalidate only the specific user session (revoke by userId)', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-specific',
      tenantId: 'tenant-1',
      sid: 'session-specific',
      type: 'refresh',
    });

    await useCase.execute({ refreshToken: 'token-for-specific-user' });

    expect(refreshSessionStore.revoke).toHaveBeenCalledTimes(1);
    expect(refreshSessionStore.revoke).toHaveBeenCalledWith('user-specific');
  });
});
