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
        const connectionString = (redisUrl?.includes('://') ? redisUrl : null) || (redisHost?.includes('://') ? redisHost : null);

        if (connectionString) {
          return new Redis(connectionString, {
            maxRetriesPerRequest: null,
          });
        }

        return new Redis({
          host: redisHost || 'localhost',
          port: config.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule { }
