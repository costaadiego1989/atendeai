import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import { ProcessAIResponseUseCase } from '@modules/ai/application/use-cases/ProcessAIResponseUseCase';
import { IProcessAIResponseUseCase } from '@modules/ai/application/use-cases/interfaces/IProcessAIResponseUseCase';
import { AI_ENGINE } from '@modules/ai/application/ports/IAIEngine';
import { DeepSeekAdapter } from '@modules/ai/infrastructure/adapters/DeepSeekAdapter';
import { CHAT_HISTORY_REPOSITORY } from '@modules/ai/application/ports/IChatHistoryRepository';
import { RedisChatHistoryRepository } from '@modules/ai/infrastructure/persistence/RedisChatHistoryRepository';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SalesModule } from '@modules/sales/sales.module';
import { BillingModule } from '@modules/billing/billing.module';
import { PromptBuilder } from '@modules/ai/domain/services/PromptBuilder';
import { AIResponseProcessor } from '@modules/ai/application/services/AIResponseProcessor';
import { LeadScoringService } from '@modules/ai/domain/services/LeadScoringService';
import { HumanHandoffPolicy } from '@modules/ai/application/services/HumanHandoffPolicy';
import { MessageReceivedHandler } from '@modules/ai/application/handlers/MessageReceivedHandler';
import { FollowUpTriggeredHandler } from '@modules/ai/application/handlers/FollowUpTriggeredHandler';
import { CommerceSessionAbandonedHandler } from '@modules/ai/application/handlers/CommerceSessionAbandonedHandler';
import { AIResponseGeneratedHandler } from '@modules/ai/application/handlers/AIResponseGeneratedHandler';
import { AISessionService } from './application/services/AISessionService';
import { AIContextAggregator } from './application/services/AIContextAggregator';
import { PAYMENT_LINK_GENERATOR } from './application/ports/IPaymentLinkGenerator';
import { SalesPaymentLinkGenerator } from './infrastructure/adapters/SalesPaymentLinkGenerator';
import { SchedulingModule } from '@modules/scheduling/scheduling.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { InventoryModule } from '@modules/inventory/inventory.module';
import {
  ISchedulingContextProvider,
  SCHEDULING_CONTEXT_PROVIDER,
} from './application/ports/ISchedulingContextProvider';
import { SchedulingContextProvider } from './infrastructure/adapters/SchedulingContextProvider';
import {
  COMMERCIAL_CONTEXT_PROVIDER,
  ICommercialContextProvider,
} from './application/ports/ICommercialContextProvider';
import { CommercialContextProvider } from './infrastructure/adapters/CommercialContextProvider';
import {
  COMMERCE_CONTEXT_PROVIDER,
  ICommerceContextProvider,
} from './application/ports/ICommerceContextProvider';
import {
  ITenantPDFContextProvider,
  TENANT_PDF_CONTEXT_PROVIDER,
} from './application/ports/ITenantPDFContextProvider';
import { EMBEDDING_PROVIDER } from './application/ports/IEmbeddingProvider';
import { DOCUMENT_CHUNK_REPOSITORY } from './application/ports/IDocumentChunkRepository';
import { RAG_RESPONSE_CACHE } from './application/ports/IRAGResponseCache';
import { CommerceContextProvider } from './infrastructure/adapters/CommerceContextProvider';
import { TenantPDFContextProvider } from './infrastructure/adapters/TenantPDFContextProvider';
import { OpenAIEmbeddingAdapter } from './infrastructure/adapters/OpenAIEmbeddingAdapter';
import { PrismaDocumentChunkRepository } from './infrastructure/persistence/PrismaDocumentChunkRepository';
import { RedisRAGResponseCache } from './infrastructure/persistence/RedisRAGResponseCache';
import { DocumentChunkingService } from './domain/services/DocumentChunkingService';
import { ProcessDocumentForRAGUseCase } from './application/use-cases/ProcessDocumentForRAGUseCase';
import { PDFProcessingProcessor } from './infrastructure/queue/PDFProcessingProcessor';
import { CommerceModule } from '@modules/commerce/commerce.module';
import { AgentRulesModule } from '@modules/agent-rules/agent-rules.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MediaUnderstandingService } from './application/services/MediaUnderstandingService';
import { ProcessAIResponseService } from './application/services/ProcessAIResponseService';
import { AIQuotaGuard } from './application/services/AIQuotaGuard';
import { AISystemPromptAssembler } from './application/services/AISystemPromptAssembler';
import { AITurnPersistenceService } from './application/services/AITurnPersistenceService';
import { AIHandoffService } from './application/services/AIHandoffService';
import { AIAutomationDispatcher } from './application/services/AIAutomationDispatcher';
import { AIUserMessageResolver } from './application/services/AIUserMessageResolver';
import {
  AUDIO_TRANSCRIPTION_PROVIDER,
  DOCUMENT_TEXT_EXTRACTOR,
  IMAGE_OCR_PROVIDER,
} from './application/ports/IMediaUnderstandingProviders';
import {
  HttpAudioTranscriptionAdapter,
  HttpDocumentTextExtractorAdapter,
  HttpImageOcrAdapter,
} from './infrastructure/adapters/HttpMediaUnderstandingAdapters';
import { AI_SESSION_REPOSITORY } from './application/ports/IAISessionRepository';
import { PrismaAISessionRepository } from './infrastructure/persistence/PrismaAISessionRepository';
import { AdvanceCommerceConversationUseCase } from '@modules/commerce/application/use-cases/AdvanceCommerceConversationUseCase';
import { RepeatLastOrderUseCase } from '@modules/commerce/application/use-cases/RepeatLastOrderUseCase';
import { ReserveProfessionalSlotUseCase } from '@modules/scheduling/application/use-cases/ReserveProfessionalSlotUseCase';
import { AiSafetyGate } from './application/services/AiSafetyGate';
import { ADVANCE_COMMERCE_CONVERSATION } from './application/ports/IAdvanceCommerceConversation';
import { RESERVE_PROFESSIONAL_SLOT } from './application/ports/IReserveProfessionalSlot';
import { REPEAT_LAST_ORDER } from './application/ports/IRepeatLastOrder';
import { NicheWelcomeMenuService } from './application/services/welcome-menu/NicheWelcomeMenuService';
import { TenantAIContextSnapshotService } from './application/services/TenantAIContextSnapshotService';
import { TENANT_AI_CONTEXT_SNAPSHOT_STORE } from './application/ports/ITenantAIContextSnapshot';
import { RedisTenantAIContextSnapshotStore } from './infrastructure/persistence/RedisTenantAIContextSnapshotStore';
import { TenantAIContextSnapshotInvalidationHandler } from './infrastructure/handlers/TenantAIContextSnapshotInvalidationHandler';
import { WebCrawlerAdapter } from './infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';
import { GoogleDriveAdapter } from './infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';
import { NotionAdapter } from './infrastructure/adapters/knowledge-sources/NotionAdapter';
import { KnowledgeBaseSyncWorker } from './infrastructure/adapters/knowledge-sources/KnowledgeBaseSyncWorker';
import { IngestKnowledgeSourceUseCase } from './application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';
import { HybridSearchService } from './application/use-cases/knowledge-base/HybridSearchService';
import { KNOWLEDGE_SOURCE_REPOSITORY } from './application/ports/IKnowledgeSourceRepository';
import { PrismaKnowledgeSourceRepository } from './infrastructure/persistence/PrismaKnowledgeSourceRepository';
import { COMMERCE_CATALOG_SEARCH } from './application/ports/ICommerceCatalogSearch';
import { CommerceCatalogSearchAdapter } from './infrastructure/adapters/CommerceCatalogSearchAdapter';
import {
  AUTOMATION_AI_REPLY_FACADE,
  AutomationAiReplyFacade,
} from './application/facades/AutomationAiReplyFacade';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'pdf-processing' }),
    TenantModule,
    forwardRef(() => SalesModule),
    BillingModule,
    forwardRef(() => SchedulingModule),
    CatalogModule,
    InventoryModule,
    CommerceModule,
    AgentRulesModule,
    ContactModule,
  ],
  providers: [
    PromptBuilder,
    NicheWelcomeMenuService,
    {
      provide: TENANT_AI_CONTEXT_SNAPSHOT_STORE,
      useClass: RedisTenantAIContextSnapshotStore,
    },
    TenantAIContextSnapshotService,
    TenantAIContextSnapshotInvalidationHandler,
    AIResponseProcessor,
    HumanHandoffPolicy,
    {
      provide: PAYMENT_LINK_GENERATOR,
      useClass: SalesPaymentLinkGenerator,
    },
    {
      provide: SCHEDULING_CONTEXT_PROVIDER,
      useClass: SchedulingContextProvider,
    },
    {
      provide: COMMERCIAL_CONTEXT_PROVIDER,
      useClass: CommercialContextProvider,
    },
    {
      provide: COMMERCE_CONTEXT_PROVIDER,
      useClass: CommerceContextProvider,
    },
    {
      provide: TENANT_PDF_CONTEXT_PROVIDER,
      useClass: TenantPDFContextProvider,
    },
    {
      provide: EMBEDDING_PROVIDER,
      useClass: OpenAIEmbeddingAdapter,
    },
    {
      provide: DOCUMENT_CHUNK_REPOSITORY,
      useClass: PrismaDocumentChunkRepository,
    },
    {
      provide: KNOWLEDGE_SOURCE_REPOSITORY,
      useClass: PrismaKnowledgeSourceRepository,
    },
    {
      provide: COMMERCE_CATALOG_SEARCH,
      useClass: CommerceCatalogSearchAdapter,
    },
    {
      provide: RAG_RESPONSE_CACHE,
      useFactory: (redis: Redis, config: ConfigService) => {
        const ttl = Number(config.get<string>('RAG_CACHE_TTL_SECONDS')) || 3600;
        const maxEntries =
          Number(config.get<string>('RAG_CACHE_MAX_ENTRIES_PER_TENANT')) || 100;
        return new RedisRAGResponseCache(redis, ttl, maxEntries);
      },
      inject: [REDIS_CLIENT, ConfigService],
    },
    DocumentChunkingService,
    ProcessDocumentForRAGUseCase,
    PDFProcessingProcessor,
    WebCrawlerAdapter,
    GoogleDriveAdapter,
    NotionAdapter,
    IngestKnowledgeSourceUseCase,
    HybridSearchService,
    KnowledgeBaseSyncWorker,
    LeadScoringService,
    MessageReceivedHandler,
    FollowUpTriggeredHandler,
    CommerceSessionAbandonedHandler,
    AIResponseGeneratedHandler,
    MediaUnderstandingService,
    {
      provide: IMAGE_OCR_PROVIDER,
      useClass: HttpImageOcrAdapter,
    },
    {
      provide: AUDIO_TRANSCRIPTION_PROVIDER,
      useClass: HttpAudioTranscriptionAdapter,
    },
    {
      provide: DOCUMENT_TEXT_EXTRACTOR,
      useClass: HttpDocumentTextExtractorAdapter,
    },
    {
      provide: IProcessAIResponseUseCase,
      useFactory: (processAIResponseService: ProcessAIResponseService) =>
        new ProcessAIResponseUseCase(processAIResponseService),
      inject: [ProcessAIResponseService],
    },
    {
      provide: AI_ENGINE,
      useClass: DeepSeekAdapter,
    },
    {
      provide: AI_SESSION_REPOSITORY,
      useClass: PrismaAISessionRepository,
    },
    AISessionService,
    {
      provide: AIContextAggregator,
      useFactory: (
        promptBuilder: PromptBuilder,
        commercialContextProvider: ICommercialContextProvider,
        commerceContextProvider: ICommerceContextProvider,
        schedulingContextProvider: ISchedulingContextProvider,
        nicheWelcomeMenuService: NicheWelcomeMenuService,
        tenantPDFContextProvider: ITenantPDFContextProvider,
        config: ConfigService,
        snapshotService: TenantAIContextSnapshotService,
      ) => {
        const raw = Number(config.get<string>('AI_CONTEXT_AGGREGATOR_TTL_MS'));
        const ttlMs =
          Number.isFinite(raw) && raw > 0 ? Math.min(raw, 300_000) : 0;
        return new AIContextAggregator(
          promptBuilder,
          commercialContextProvider,
          commerceContextProvider,
          schedulingContextProvider,
          nicheWelcomeMenuService,
          tenantPDFContextProvider,
          ttlMs,
          snapshotService,
        );
      },
      inject: [
        PromptBuilder,
        COMMERCIAL_CONTEXT_PROVIDER,
        COMMERCE_CONTEXT_PROVIDER,
        SCHEDULING_CONTEXT_PROVIDER,
        NicheWelcomeMenuService,
        TENANT_PDF_CONTEXT_PROVIDER,
        ConfigService,
        TenantAIContextSnapshotService,
      ],
    },
    {
      provide: AiSafetyGate,
      useFactory: (config: ConfigService) => AiSafetyGate.fromEnvLike(config),
      inject: [ConfigService],
    },
    ProcessAIResponseService,
    AIQuotaGuard,
    AISystemPromptAssembler,
    AITurnPersistenceService,
    AIHandoffService,
    AIAutomationDispatcher,
    AIUserMessageResolver,
    {
      provide: CHAT_HISTORY_REPOSITORY,
      useClass: RedisChatHistoryRepository,
    },
    {
      provide: ADVANCE_COMMERCE_CONVERSATION,
      useExisting: AdvanceCommerceConversationUseCase,
    },
    {
      provide: RESERVE_PROFESSIONAL_SLOT,
      useExisting: ReserveProfessionalSlotUseCase,
    },
    {
      provide: REPEAT_LAST_ORDER,
      useExisting: RepeatLastOrderUseCase,
    },
    {
      provide: AUTOMATION_AI_REPLY_FACADE,
      useClass: AutomationAiReplyFacade,
    },
  ],
  controllers: [],
  exports: [
    AI_ENGINE,
    AUTOMATION_AI_REPLY_FACADE,
    IProcessAIResponseUseCase,
    LeadScoringService,
    PromptBuilder,
    AIResponseProcessor,
    MediaUnderstandingService,
    EMBEDDING_PROVIDER,
    DOCUMENT_CHUNK_REPOSITORY,
    DocumentChunkingService,
    HybridSearchService,
    IngestKnowledgeSourceUseCase,
  ],
})
export class AIModule {}
