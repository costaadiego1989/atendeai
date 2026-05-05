import { LogoutUseCase } from '../LogoutUseCase';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let refreshSessionStore: any;
  let tokenService: any;

  beforeEach(() => {
    refreshSessionStore = { revoke: jest.fn() };
    tokenService = { verifyRefreshToken: jest.fn() };
    useCase = new LogoutUseCase(refreshSessionStore, tokenService);
  });

  it('should revoke refresh session when token is valid', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      type: 'refresh',
    });

    await useCase.execute({ refreshToken: 'valid-token' });

    expect(refreshSessionStore.revoke).toHaveBeenCalledWith('user-1');
  });

  it('should ignore invalid tokens and remain idempotent', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(new Error('invalid'));

    await expect(
      useCase.execute({ refreshToken: 'invalid-token' }),
    ).resolves.toBeUndefined();
    expect(refreshSessionStore.revoke).not.toHaveBeenCalled();
  });
});
