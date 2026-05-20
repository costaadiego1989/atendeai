import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import { ProcessAIResponseUseCase } from '@modules/ai/application/use-cases/ProcessAIResponseUseCase';
import { IProcessAIResponseUseCase } from '@modules/ai/application/use-cases/interfaces/IProcessAIResponseUseCase';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import { DeepSeekAdapter } from '@modules/ai/infrastructure/adapters/DeepSeekAdapter';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '@modules/ai/application/ports/IChatHistoryRepository';
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
import {
  IPaymentLinkGenerator,
  PAYMENT_LINK_GENERATOR,
} from './application/ports/IPaymentLinkGenerator';
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
import {
  EMBEDDING_PROVIDER,
  IEmbeddingProvider,
} from './application/ports/IEmbeddingProvider';
import { DOCUMENT_CHUNK_REPOSITORY } from './application/ports/IDocumentChunkRepository';
import {
  IRAGResponseCache,
  RAG_RESPONSE_CACHE,
} from './application/ports/IRAGResponseCache';
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
import {
  AUDIO_TRANSCRIPTION_PROVIDER,
  AudioTranscriptionProvider,
  DOCUMENT_TEXT_EXTRACTOR,
  DocumentTextExtractor,
  IMAGE_OCR_PROVIDER,
  ImageOcrProvider,
} from './application/ports/IMediaUnderstandingProviders';
import {
  HttpAudioTranscriptionAdapter,
  HttpDocumentTextExtractorAdapter,
  HttpImageOcrAdapter,
} from './infrastructure/adapters/HttpMediaUnderstandingAdapters';
import {
  AI_SESSION_REPOSITORY,
  IAISessionRepository,
} from './application/ports/IAISessionRepository';
import { PrismaAISessionRepository } from './infrastructure/persistence/PrismaAISessionRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '@modules/contact/domain/repositories/IContactRepository';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';
import { AdvanceCommerceConversationUseCase } from '@modules/commerce/application/use-cases/AdvanceCommerceConversationUseCase';
import { RepeatLastOrderUseCase } from '@modules/commerce/application/use-cases/RepeatLastOrderUseCase';
import { ReserveProfessionalSlotUseCase } from '@modules/scheduling/application/use-cases/ReserveProfessionalSlotUseCase';
import { AiSafetyGate } from './application/services/AiSafetyGate';
import { ADVANCE_COMMERCE_CONVERSATION } from './application/ports/IAdvanceCommerceConversation';
import { RESERVE_PROFESSIONAL_SLOT } from './application/ports/IReserveProfessionalSlot';
import {
  IRepeatLastOrder,
  REPEAT_LAST_ORDER,
} from './application/ports/IRepeatLastOrder';
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

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'pdf-processing' }),
    TenantModule,
    forwardRef(() => SalesModule),
    BillingModule,
    SchedulingModule,
    CatalogModule,
    InventoryModule,
    CommerceModule,
    AgentRulesModule,
    ContactModule,
  ],
  providers: [
    {
      provide: PromptBuilder,
      useFactory: () => new PromptBuilder(),
    },
    {
      provide: NicheWelcomeMenuService,
      useFactory: () => new NicheWelcomeMenuService(),
    },
    {
      provide: TENANT_AI_CONTEXT_SNAPSHOT_STORE,
      useClass: RedisTenantAIContextSnapshotStore,
    },
    TenantAIContextSnapshotService,
    TenantAIContextSnapshotInvalidationHandler,
    {
      provide: AIResponseProcessor,
      useFactory: (
        paymentLinkGenerator: IPaymentLinkGenerator,
        reserveProfessionalSlotUseCase: ReserveProfessionalSlotUseCase,
        repeatLastOrderUseCase: IRepeatLastOrder,
      ) =>
        new AIResponseProcessor(
          paymentLinkGenerator,
          reserveProfessionalSlotUseCase,
          repeatLastOrderUseCase,
        ),
      inject: [
        PAYMENT_LINK_GENERATOR,
        RESERVE_PROFESSIONAL_SLOT,
        REPEAT_LAST_ORDER,
      ],
    },
    {
      provide: HumanHandoffPolicy,
      useFactory: () => new HumanHandoffPolicy(),
    },
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
      provide: RAG_RESPONSE_CACHE,
      useFactory: (redis: Redis, config: ConfigService) => {
        const ttl = Number(config.get<string>('RAG_CACHE_TTL_SECONDS')) || 3600;
        const maxEntries =
          Number(config.get<string>('RAG_CACHE_MAX_ENTRIES_PER_TENANT')) || 100;
        return new RedisRAGResponseCache(redis, ttl, maxEntries);
      },
      inject: [REDIS_CLIENT, ConfigService],
    },
    {
      provide: DocumentChunkingService,
      useFactory: () => new DocumentChunkingService(),
    },
    ProcessDocumentForRAGUseCase,
    PDFProcessingProcessor,
    WebCrawlerAdapter,
    GoogleDriveAdapter,
    NotionAdapter,
    IngestKnowledgeSourceUseCase,
    HybridSearchService,
    KnowledgeBaseSyncWorker,
    {
      provide: LeadScoringService,
      useFactory: () => new LeadScoringService(),
    },
    MessageReceivedHandler,
    FollowUpTriggeredHandler,
    CommerceSessionAbandonedHandler,
    AIResponseGeneratedHandler,
    {
      provide: MediaUnderstandingService,
      useFactory: (
        imageOcrProvider: ImageOcrProvider,
        audioTranscriptionProvider: AudioTranscriptionProvider,
        documentTextExtractor: DocumentTextExtractor,
      ) =>
        new MediaUnderstandingService(
          imageOcrProvider,
          audioTranscriptionProvider,
          documentTextExtractor,
        ),
      inject: [
        IMAGE_OCR_PROVIDER,
        AUDIO_TRANSCRIPTION_PROVIDER,
        DOCUMENT_TEXT_EXTRACTOR,
      ],
    },
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
    {
      provide: AISessionService,
      useFactory: (repository: IAISessionRepository) =>
        new AISessionService(repository),
      inject: [AI_SESSION_REPOSITORY],
    },
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
    {
      provide: ProcessAIResponseService,
      useFactory: (
        aiEngine: IAIEngine,
        eventBus: IEventBus,
        tenantRepository: ITenantRepository,
        chatHistoryRepository: IChatHistoryRepository,
        checkQuotaUseCase: ICheckQuotaUseCase,
        responseProcessor: AIResponseProcessor,
        humanHandoffPolicy: HumanHandoffPolicy,
        advanceCommerceConversationUseCase: AdvanceCommerceConversationUseCase,
        aiSessionService: AISessionService,
        contextAggregator: AIContextAggregator,
        contactRepository: IContactRepository,
        tenantAgentRuleService: TenantAgentRuleService,
        aiSafetyGate: AiSafetyGate,
        mediaUnderstandingService: MediaUnderstandingService,
        ragResponseCache: IRAGResponseCache,
        embeddingProvider: IEmbeddingProvider,
      ) =>
        new ProcessAIResponseService(
          aiEngine,
          eventBus,
          tenantRepository,
          chatHistoryRepository,
          checkQuotaUseCase,
          responseProcessor,
          humanHandoffPolicy,
          advanceCommerceConversationUseCase,
          aiSessionService,
          contextAggregator,
          contactRepository,
          tenantAgentRuleService,
          aiSafetyGate,
          mediaUnderstandingService,
          ragResponseCache,
          embeddingProvider,
        ),
      inject: [
        AI_ENGINE,
        EVENT_BUS,
        TENANT_REPOSITORY,
        CHAT_HISTORY_REPOSITORY,
        ICheckQuotaUseCase,
        AIResponseProcessor,
        HumanHandoffPolicy,
        ADVANCE_COMMERCE_CONVERSATION,
        AISessionService,
        AIContextAggregator,
        CONTACT_REPOSITORY,
        TenantAgentRuleService,
        AiSafetyGate,
        MediaUnderstandingService,
        RAG_RESPONSE_CACHE,
        EMBEDDING_PROVIDER,
      ],
    },
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
  ],
  controllers: [],
  exports: [
    AI_ENGINE,
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
