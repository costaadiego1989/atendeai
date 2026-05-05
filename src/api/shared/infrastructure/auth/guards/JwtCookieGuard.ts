import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '../../../domain/exceptions/DomainExceptions';
import {
  AccessTokenPayload,
  ITokenService,
  TOKEN_SERVICE,
} from '@shared/application/ports/ITokenService';

export type AuthenticatedUser = AccessTokenPayload;

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = request.cookies?.['atendeai_access'];
    if (!token) {
      throw new UnauthorizedException(
        'Access token not provided',
        'MISSING_TOKEN',
      );
    }

    try {
      const payload =
        await this.tokenService.verifyAccessToken<AccessTokenPayload>(token);

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token', 'INVALID_TOKEN');
      }

      (request as any).user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Token expired or invalid',
        'INVALID_TOKEN',
      );
    }
  }
}
