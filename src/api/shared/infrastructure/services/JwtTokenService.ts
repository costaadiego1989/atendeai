import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  AccessTokenPayload,
  ITokenService,
  RefreshTokenPayload,
} from '../../application/ports/ITokenService';
import { UnauthorizedException } from '../../domain/exceptions/DomainExceptions';

@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.getAccessExpiration() as any,
    });
  }

  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.getRefreshExpiration() as any,
    });
  }

  async verifyAccessToken<T extends object = any>(token: string): Promise<T> {
    try {
      return await this.jwtService.verifyAsync<T>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
        'INVALID_TOKEN',
      );
    }
  }

  async verifyRefreshToken<T extends object = any>(token: string): Promise<T> {
    try {
      return await this.jwtService.verifyAsync<T>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
        'INVALID_TOKEN',
      );
    }
  }

  getAccessTokenTtlSeconds(): number {
    return this.parseExpirationToSeconds(this.getAccessExpiration());
  }

  getRefreshTokenTtlSeconds(): number {
    return this.parseExpirationToSeconds(this.getRefreshExpiration());
  }

  private getAccessExpiration(): string | number {
    return this.configService.get<string | number>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    );
  }

  private getRefreshExpiration(): string | number {
    return this.configService.get<string | number>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
  }

  private parseExpirationToSeconds(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
    if (!match) {
      return 7 * 24 * 60 * 60;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return value * multipliers[unit];
  }
}
