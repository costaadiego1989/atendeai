import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/infrastructure/database/DatabaseModule';
import { RedisModule } from './shared/infrastructure/redis/RedisModule';
import { EventBusModule } from './shared/infrastructure/event-bus/EventBusModule';
import { TenantModule } from './modules/tenant/tenant.module';
import { ContactModule } from './modules/contact/contact.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AIModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuthModule } from './modules/auth/auth.module';
import { SalesModule } from './modules/sales/sales.module';
import { ProspectingModule } from './modules/prospecting/prospecting.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecoveryModule } from './modules/recovery/recovery.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SupportModule } from './modules/support/support.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { SocialModule } from './modules/social/social.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from './shared/infrastructure/storage/StorageModule';
import { ConfigService } from '@nestjs/config';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { ObservabilityModule } from './shared/infrastructure/observability/observability.module';
import { ResilienceModule } from './shared/infrastructure/resilience/ResilienceModule';
import { HealthModule } from './shared/infrastructure/health/HealthModule';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './shared/infrastructure/http/filters/GlobalExceptionFilter';
import { StructuredLogEmitter } from './shared/infrastructure/observability/StructuredLogEmitter';
import { parseRedisConnection } from './shared/infrastructure/redis/redis-connection.helper';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env['RENDER'] === 'true',
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
    ResilienceModule,
    HealthModule,
    DatabaseModule,
    RedisModule,
    EventBusModule,
    AuthModule,
    TenantModule,
    ContactModule,
    MessagingModule,
    AIModule,
    BillingModule,
    SalesModule,
    ProspectingModule,
    SchedulingModule,
    CatalogModule,
    InventoryModule,
    RecoveryModule,
    AlertsModule,
    SupportModule,
    CommerceModule,
    SocialModule,
    StorageModule,
    ProposalModule,
    PlatformAdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useFactory: (log: StructuredLogEmitter) => new GlobalExceptionFilter(log),
      inject: [StructuredLogEmitter],
    },
  ],
})
export class AppModule {}
