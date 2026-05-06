import { ConfigService } from '@nestjs/config';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
}

export function parseRedisConnection(config: ConfigService): RedisConnectionOptions {
  const redisUrl = config.get<string>('REDIS_URL');
  const redisHost = config.get<string>('REDIS_HOST');

  const clean = (s?: string) => s?.replace(/['"]/g, '').trim();
  const raw = clean(redisUrl) || clean(redisHost);

  if (raw?.includes('://')) {
    try {
      const parsed = new URL(raw);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch {
      const fallbackHost = raw.replace(/^rediss?:\/\//, '').split(':')[0];
      return {
        host: fallbackHost,
        port: 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }
  }

  return {
    host: raw || 'localhost',
    port: config.get<number>('REDIS_PORT', 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function parseRedisConnectionFromEnv(): RedisConnectionOptions {
  const raw = (process.env.REDIS_URL || process.env.REDIS_HOST || '')
    .replace(/['"]/g, '')
    .trim();

  if (raw.includes('://')) {
    try {
      const parsed = new URL(raw);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch {
      const fallbackHost = raw.replace(/^rediss?:\/\//, '').split(':')[0];
      return {
        host: fallbackHost,
        port: 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }
  }

  return {
    host: raw || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
