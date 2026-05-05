import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const HEADER = 'x-platform-admin-key';

@Injectable()
export class PlatformAdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const expected = this.config.get<string>('PLATFORM_ADMIN_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('Platform admin not configured');
    }
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const provided =
      req.headers[HEADER] ??
      req.headers[HEADER.toUpperCase()];
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid platform admin credentials');
    }
    return true;
  }
}
