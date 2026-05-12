import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './HealthController';
import { PrismaHealthIndicator } from './PrismaHealthIndicator';
import { RedisHealthIndicator } from './RedisHealthIndicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
