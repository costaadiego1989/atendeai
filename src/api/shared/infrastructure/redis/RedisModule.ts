import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const redisHost = config.get<string>('REDIS_HOST');

        // Limpeza agressiva de aspas e espaços
        const clean = (s?: string) => s?.replace(/['"]/g, '').trim();
        const url = clean(redisUrl);
        const host = clean(redisHost);

        const connectionString = (url?.includes('://') ? url : null) || 
                                (host?.includes('://') ? host : null);

        if (connectionString) {
          try {
            const parsed = new URL(connectionString);
            const options = {
              host: parsed.hostname,
              port: Number(parsed.port) || 6379,
              password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
              db: parsed.pathname ? parseInt(parsed.pathname.substring(1)) || 0 : 0,
              maxRetriesPerRequest: null,
              keepAlive: 30000,
              retryStrategy: (times: number) => Math.min(times * 50, 2000),
            };

            const redis = new Redis(options);
            redis.on('error', (err) => console.error('[RedisModule] Connection Error:', err.message));
            return redis;
          } catch (e) {
            // Se falhar o parse, tenta limpar o host manualmente
            const fallbackHost = connectionString.replace(/^redis[s]?:\/\//, '').split(':')[0];
            return new Redis({
              host: fallbackHost,
              port: 6379,
              maxRetriesPerRequest: null,
              keepAlive: 30000,
            });
          }
        }

        const redis = new Redis({
          host: host || 'localhost',
          port: config.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,
          keepAlive: 30000,
        });
        redis.on('error', (err) => console.error('[RedisModule] Error:', err.message));
        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule { }
