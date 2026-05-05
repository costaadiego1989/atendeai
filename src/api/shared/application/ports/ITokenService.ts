import { RoleType } from '@shared/domain/Role';

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: RoleType;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  sid: string;
  type: 'refresh';
}

export interface TokenPayload {
  sub: string;
  tenantId: string;
  email?: string;
  role?: RoleType;
  sid?: string;
  type: 'access' | 'refresh';
}

export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  signRefreshToken(payload: RefreshTokenPayload): Promise<string>;
  verifyAccessToken<T extends object = any>(token: string): Promise<T>;
  verifyRefreshToken<T extends object = any>(token: string): Promise<T>;
  getAccessTokenTtlSeconds(): number;
  getRefreshTokenTtlSeconds(): number;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
