import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { RedisModule } from '@shared/infrastructure/redis/RedisModule';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';
import { ContactModule } from '@modules/contact/contact.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { MessagingInfrastructureModule } from '@modules/messaging/infrastructure/messaging-infrastructure.module';
import { ProcessOutboundMessageUseCase } from '@modules/messaging/application/use-cases/ProcessOutboundMessageUseCase';
import { OutboundMessageProcessor } from '@modules/messaging/infrastructure/queue/OutboundMessageProcessor';
import { FollowUpAuditService } from '@modules/messaging/application/services/FollowUpAuditService';
import { FollowUpWorker } from '@modules/messaging/application/workers/FollowUpWorker';
import { AIModule } from '@modules/ai/ai.module';
import { StorageModule } from '@shared/infrastructure/storage/StorageModule';
import { ObservabilityModule } from '@shared/infrastructure/observability/observability.module';
import { BullModule } from '@nestjs/bullmq';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisConnection(config),
      }),
    }),
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    EventBusModule,
    ContactModule,
    TenantModule,
    AIModule,
    StorageModule,
    MessagingInfrastructureModule,
  ],
  providers: [
    ProcessOutboundMessageUseCase,
    OutboundMessageProcessor,
    FollowUpAuditService,
    FollowUpWorker,
  ],
})
export class MessagingWorkerModule {}
