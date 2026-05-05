import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import {
  IExecuteProspectSearchUseCase,
} from '@modules/prospecting/application/use-cases/interfaces/IExecuteProspectSearchUseCase';
import { ExecuteProspectSearchUseCase } from '@modules/prospecting/application/use-cases/ExecuteProspectSearchUseCase';
import {
  PROSPECT_SEARCH_REPOSITORY,
} from '@modules/prospecting/domain/repositories/IProspectSearchRepository';
import { PrismaProspectSearchRepository } from '@modules/prospecting/infrastructure/persistence/repositories/PrismaProspectSearchRepository';
import {
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '@modules/prospecting/domain/repositories/IProspectSearchResultRepository';
import { PrismaProspectSearchResultRepository } from '@modules/prospecting/infrastructure/persistence/repositories/PrismaProspectSearchResultRepository';
import {
  PROSPECT_SEARCH_SOURCE_REGISTRY,
} from '@modules/prospecting/domain/ports/IProspectSearchSourceRegistry';
import { ProspectSearchSourceRegistry } from '@modules/prospecting/infrastructure/acl/ProspectSearchSourceRegistry';
import { GooglePlacesProspectSearchSource } from '@modules/prospecting/infrastructure/acl/GooglePlacesProspectSearchSource';
import {
  PROSPECT_WEBSITE_ENRICHER,
} from '@modules/prospecting/domain/ports/IProspectWebsiteEnricher';
import { HttpProspectWebsiteEnricher } from '@modules/prospecting/infrastructure/services/HttpProspectWebsiteEnricher';
import { ProspectSearchProcessor } from '@modules/prospecting/infrastructure/queue/ProspectSearchProcessor';
import { BillingModule } from '@modules/billing/billing.module';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@shared/infrastructure/redis/RedisModule';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';
import { ObservabilityModule } from '@shared/infrastructure/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    DatabaseModule,
    ObservabilityModule,
    RedisModule,
    EventBusModule,
    BillingModule,
  ],
  providers: [
    {
      provide: IExecuteProspectSearchUseCase,
      useClass: ExecuteProspectSearchUseCase,
    },
    {
      provide: PROSPECT_SEARCH_REPOSITORY,
      useClass: PrismaProspectSearchRepository,
    },
    {
      provide: PROSPECT_SEARCH_RESULT_REPOSITORY,
      useClass: PrismaProspectSearchResultRepository,
    },
    {
      provide: PROSPECT_SEARCH_SOURCE_REGISTRY,
      useClass: ProspectSearchSourceRegistry,
    },
    {
      provide: PROSPECT_WEBSITE_ENRICHER,
      useClass: HttpProspectWebsiteEnricher,
    },
    GooglePlacesProspectSearchSource,
    ProspectSearchProcessor,
  ],
})
export class ProspectSearchWorkerModule { }
