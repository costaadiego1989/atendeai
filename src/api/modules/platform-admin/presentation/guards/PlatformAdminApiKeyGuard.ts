import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const HEADER = 'x-platform-admin-key';

@Injectable()
export class PlatformAdminApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(PlatformAdminApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const expected = this.config.get<string>('PLATFORM_ADMIN_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('Platform admin not configured');
    }
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | undefined>;
    }>();
    const provided = req.headers[HEADER] ?? req.headers[HEADER.toUpperCase()];
    if (!provided) {
      this.logger.warn(`Platform admin key missing: ${req.method} ${req.url}`);
      throw new UnauthorizedException('Invalid platform admin credentials');
    }
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    const isValid =
      expectedBuf.byteLength === providedBuf.byteLength &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);
    if (!isValid) {
      this.logger.warn(
        `Platform admin authentication failed: ${req.method} ${req.url}`,
      );
      throw new UnauthorizedException('Invalid platform admin credentials');
    }
    this.logger.log(`Platform admin authenticated: ${req.method} ${req.url}`);
    return true;
  }
}
