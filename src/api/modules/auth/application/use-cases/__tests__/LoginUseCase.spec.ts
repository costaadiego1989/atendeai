import { LoginUseCase } from '../LoginUseCase';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
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

  beforeEach(() => {
    authUserRepo = { findByEmail: jest.fn() };
    tokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
    };
    passwordHasher = { compare: jest.fn() };
    refreshSessionStore = { save: jest.fn() };
    useCase = new LoginUseCase(
      authUserRepo,
      tokenService,
      passwordHasher,
      refreshSessionStore,
    );
  });

  it('should return tokens and user info on valid credentials', async () => {
    const mockUser = AuthUser.create(
      {
        tenantId: 'tenant-123',
        tenantName: 'Tenant Test',
        tenantBusinessType: 'SCHEDULING',
        email: AuthUserEmail.create('test@test.com'),
        name: 'Test User',
        passwordHash: 'hashed_pw',
        role: Role.create('OWNER'),
      },
      new UniqueEntityID('user-123'),
    );

    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(true);
    tokenService.signAccessToken.mockResolvedValue('access_token_123');
    tokenService.signRefreshToken.mockResolvedValue('refresh_token_123');

    const result = await useCase.execute({
      email: 'test@test.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('access_token_123');
    expect(result.refreshToken).toBe('refresh_token_123');
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.role).toBe('OWNER');
    expect(result.user.mustChangePassword).toBe(false);
    expect(result.tenant).toEqual({
      id: 'tenant-123',
      name: 'Tenant Test',
      businessType: 'SCHEDULING',
    });

    expect(tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        type: 'access',
        role: 'OWNER',
      }),
    );
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        type: 'refresh',
        sid: expect.any(String),
      }),
    );
    expect(refreshSessionStore.save).toHaveBeenCalledWith(
      'user-123',
      expect.any(String),
      604800,
    );
  });

  it('should throw UnauthorizedException if user not found', async () => {
    authUserRepo.findByEmail.mockResolvedValue(null);
    await expect(
      useCase.execute({ email: 'unknown@test.com', password: 'pass' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if password incorrect', async () => {
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
    authUserRepo.findByEmail.mockResolvedValue(mockUser);
    passwordHasher.compare.mockResolvedValue(false);
    await expect(
      useCase.execute({ email: 't@t.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
