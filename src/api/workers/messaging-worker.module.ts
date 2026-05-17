import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { RedisModule } from '@shared/infrastructure/redis/RedisModule';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';
import { ContactModule } from '@modules/contact/contact.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { PrismaConversationRepository } from '@modules/messaging/infrastructure/persistence/repositories/PrismaConversationRepository';
import { CONVERSATION_REPOSITORY } from '@modules/messaging/domain/repositories/IConversationRepository';
import { BubbleWhatsAdapter } from '@modules/messaging/infrastructure/acl/BubbleWhatsAdapter';
import { InstagramGraphAdapter } from '@modules/messaging/infrastructure/acl/InstagramGraphAdapter';
import { PrismaConversationIntelligenceRepository } from '@modules/messaging/infrastructure/persistence/repositories/PrismaConversationIntelligenceRepository';
import { CONVERSATION_INTELLIGENCE_REPOSITORY } from '@modules/messaging/domain/repositories/IConversationIntelligenceRepository';
import { Dialog360Adapter } from '@modules/messaging/infrastructure/acl/Dialog360Adapter';
import { TwilioAdapter } from '@modules/messaging/infrastructure/acl/TwilioAdapter';
import { MessagingGatewayRegistry } from '@modules/messaging/infrastructure/acl/MessagingGatewayRegistry';
import { MESSAGING_GATEWAY_REGISTRY } from '@modules/messaging/domain/ports/IMessagingGatewayRegistry';
import { ProcessOutboundMessageUseCase } from '@modules/messaging/application/use-cases/ProcessOutboundMessageUseCase';
import { OutboundMessageProcessor } from '@modules/messaging/infrastructure/queue/OutboundMessageProcessor';
import { FollowUpAuditService } from '@modules/messaging/application/services/FollowUpAuditService';
import { FollowUpWorker } from '@modules/messaging/application/workers/FollowUpWorker';
import { AIModule } from '@modules/ai/ai.module';
import { StorageModule } from '@shared/infrastructure/storage/StorageModule';
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
    DatabaseModule,
    RedisModule,
    EventBusModule,
    ContactModule,
    TenantModule,
    AIModule,
    StorageModule,
  ],
  providers: [
    BubbleWhatsAdapter,
    InstagramGraphAdapter,
    Dialog360Adapter,
    TwilioAdapter,
    MessagingGatewayRegistry,
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: PrismaConversationRepository,
    },
    {
      provide: CONVERSATION_INTELLIGENCE_REPOSITORY,
      useClass: PrismaConversationIntelligenceRepository,
    },
    {
      provide: MESSAGING_GATEWAY_REGISTRY,
      useExisting: MessagingGatewayRegistry,
    },
    ProcessOutboundMessageUseCase,
    OutboundMessageProcessor,
    FollowUpAuditService,
    FollowUpWorker,
  ],
})
export class MessagingWorkerModule {}
