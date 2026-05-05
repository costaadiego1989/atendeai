import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtTokenService } from '@shared/infrastructure/services/JwtTokenService';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({});
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        throw new Error(`Missing config key: ${key}`);
      }),
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new JwtTokenService(jwtService, configService);
  });

  it('should sign and verify access tokens', async () => {
    const token = await service.signAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'user-1@test.com',
      role: 'ADMIN',
      type: 'access',
    });

    const payload = await service.verifyAccessToken<{
      sub: string;
      tenantId: string;
      type: string;
    }>(token);

    expect(payload).toEqual(
      expect.objectContaining({
        sub: 'user-1',
        tenantId: 'tenant-1',
        type: 'access',
      }),
    );
  });

  it('should sign and verify refresh tokens with sid support', async () => {
    const token = await service.signRefreshToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sid: 'session-1',
      type: 'refresh',
    });

    const payload = await service.verifyRefreshToken<{
      sub: string;
      sid: string;
      type: string;
    }>(token);

    expect(payload).toEqual(
      expect.objectContaining({
        sub: 'user-1',
        sid: 'session-1',
        type: 'refresh',
      }),
    );
  });

  it('should throw UnauthorizedException for invalid access tokens', async () => {
    await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException for invalid refresh tokens', async () => {
    await expect(service.verifyRefreshToken('invalid-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should parse refresh TTL from the configured duration', () => {
    expect(service.getRefreshTokenTtlSeconds()).toBe(7 * 24 * 60 * 60);
  });

  it('should parse access TTL from the configured duration', () => {
    expect(service.getAccessTokenTtlSeconds()).toBe(15 * 60);
  });

  it('should return the numeric refresh TTL directly', () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'JWT_REFRESH_EXPIRATION') return 3600;
      return defaultValue;
    });

    expect(service.getRefreshTokenTtlSeconds()).toBe(3600);
  });

  it('should fallback to 7 days when the refresh TTL is invalid', () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'JWT_REFRESH_EXPIRATION') return 'invalid';
      return defaultValue;
    });

    expect(service.getRefreshTokenTtlSeconds()).toBe(7 * 24 * 60 * 60);
  });
});
