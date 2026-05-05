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

  beforeEach(() => {
    authUserRepo = { findById: jest.fn() };
    tokenService = {
      verifyRefreshToken: jest.fn(),
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    };
    refreshSessionStore = {
      isValid: jest.fn(),
      save: jest.fn(),
    };
    useCase = new RefreshTokenUseCase(
      authUserRepo,
      tokenService,
      refreshSessionStore,
    );
  });

  it('should return new tokens on valid refresh token', async () => {
    const mockUser = AuthUser.create(
      {
        tenantId: 't1',
        email: AuthUserEmail.create('t@t.com'),
        name: 'T',
        passwordHash: 'h',
        role: Role.create('AGENT'),
      },
      new UniqueEntityID('u1'),
    );

    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      sid: 'session-1',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(mockUser);
    tokenService.signAccessToken.mockResolvedValue('new_access');
    tokenService.signRefreshToken.mockResolvedValue('new_refresh');

    const result = await useCase.execute({ refreshToken: 'valid_refresh' });

    expect(result.accessToken).toBe('new_access');
    expect(result.refreshToken).toBe('new_refresh');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', type: 'access', role: 'AGENT' }),
    );
    expect(refreshSessionStore.save).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      604800,
    );
  });

  it('should throw UnauthorizedException if token invalid', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(
      new Error('Invalid token'),
    );
    await expect(useCase.execute({ refreshToken: 'invalid' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if user not found', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      sid: 'session-1',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(true);
    authUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'valid' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if token type is not refresh', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      type: 'access',
    });
    await expect(useCase.execute({ refreshToken: 'valid' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if refresh session was revoked', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      sid: 'session-1',
      type: 'refresh',
    });
    refreshSessionStore.isValid.mockResolvedValue(false);

    await expect(useCase.execute({ refreshToken: 'valid' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
