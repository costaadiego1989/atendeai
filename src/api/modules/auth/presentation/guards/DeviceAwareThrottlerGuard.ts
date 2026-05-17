import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

import {
  resolveAuthThrottleDeviceId,
  resolveAuthThrottleIp,
} from '../utils/authThrottleKeys';

function readThrottleLimit(): number {
  const raw = process.env['AUTH_THROTTLE_LIMIT'];
  const n = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 12;
}

function readThrottleTtlSeconds(): number {
  const raw = process.env['AUTH_THROTTLE_TTL_SEC'];
  const n = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 60 ? n : 15 * 60;
}

/** Rate limit apenas por conjunto ({@link resolveAuthThrottleIp}, {@link resolveAuthThrottleDeviceId}) — dois contadores Redis por rota. */
@Injectable()
export class DeviceAwareThrottlerGuard implements CanActivate {
  private readonly limit = readThrottleLimit();
  private readonly ttlSeconds = readThrottleTtlSeconds();

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env['NODE_ENV'] === 'test') {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { deviceId?: string }>();

    const deviceId = resolveAuthThrottleDeviceId(request);
    const ipAddress = resolveAuthThrottleIp(request);
    const routePath = request.route?.path ?? request.path;
    const routeKey = `${request.method}:${routePath}`;

    const [deviceCount, ipCount] = await Promise.all([
      this.incrementKey(`auth:rl:device:${routeKey}:${deviceId}`),
      this.incrementKey(`auth:rl:ip:${routeKey}:${ipAddress}`),
    ]);

    if (deviceCount > this.limit || ipCount > this.limit) {
      throw new HttpException(
        'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async incrementKey(key: string): Promise<number> {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, this.ttlSeconds);
    }

    return count;
  }
}
