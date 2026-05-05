import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UnauthorizedException } from '../../../domain/exceptions/DomainExceptions';
import { AuthenticatedUser } from './JwtCookieGuard';
import { TENANT_PARAM_KEY } from '../decorators/tenant-param.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;
    const tenantParamKey =
      this.reflector.getAllAndOverride<string>(TENANT_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'tenantId';

    if (!user) {
      throw new UnauthorizedException('User not authenticated', 'MISSING_USER');
    }

    const tenantId = request.params[tenantParamKey];
    if (!tenantId) {
      return true;
    }

    if (user.tenantId !== tenantId) {
      throw new UnauthorizedException(
        'Access denied: tenant mismatch',
        'TENANT_MISMATCH',
      );
    }

    return true;
  }
}
