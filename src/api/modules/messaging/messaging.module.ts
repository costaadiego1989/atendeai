import { forwardRef, Module } from '@nestjs/common';
import { MessagingInfrastructureModule } from './infrastructure/messaging-infrastructure.module';
import { ProcessInboundMessageUseCase } from './application/use-cases/ProcessInboundMessageUseCase';
import { IProcessInboundMessageUseCase } from './application/use-cases/interfaces/IProcessInboundMessageUseCase';
import { ListConversationsUseCase } from './application/use-cases/ListConversationsUseCase';
import { IListConversationsUseCase } from './application/use-cases/interfaces/IListConversationsUseCase';
import { GetMessageHistoryUseCase } from './application/use-cases/GetMessageHistoryUseCase';
import { IGetMessageHistoryUseCase } from './application/use-cases/interfaces/IGetMessageHistoryUseCase';
import { MarkConversationReadUseCase } from './application/use-cases/MarkConversationReadUseCase';
import { IMarkConversationReadUseCase } from './application/use-cases/interfaces/IMarkConversationReadUseCase';
import { SendHumanMessageUseCase } from './application/use-cases/SendHumanMessageUseCase';
import { ISendHumanMessageUseCase } from './application/use-cases/interfaces/ISendHumanMessageUseCase';
import { EnsureConversationForContactUseCase } from './application/use-cases/EnsureConversationForContactUseCase';
import { IEnsureConversationForContactUseCase } from './application/use-cases/interfaces/IEnsureConversationForContactUseCase';
import { UpdateConversationStatusUseCase } from './application/use-cases/UpdateConversationStatusUseCase';
import { IUpdateConversationStatusUseCase } from './application/use-cases/interfaces/IUpdateConversationStatusUseCase';
import { SuggestAgentReplyUseCase } from './application/use-cases/SuggestAgentReplyUseCase';
import { SUGGEST_AGENT_REPLY_USE_CASE } from './application/use-cases/interfaces/ISuggestAgentReplyUseCase';
import { MarkConversationSaleUseCase } from './application/use-cases/MarkConversationSaleUseCase';
import { MARK_CONVERSATION_SALE_USE_CASE } from './application/use-cases/interfaces/IMarkConversationSaleUseCase';
import { VoidConversationSaleUseCase } from './application/use-cases/VoidConversationSaleUseCase';
import { VOID_CONVERSATION_SALE_USE_CASE } from './application/use-cases/interfaces/IVoidConversationSaleUseCase';
import { GetConversationSaleAttributionUseCase } from './application/use-cases/GetConversationSaleAttributionUseCase';
import { GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE } from './application/use-cases/interfaces/IGetConversationSaleAttributionUseCase';
import { UpdateConversationSaleAttributionUseCase } from './application/use-cases/UpdateConversationSaleAttributionUseCase';
import { UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE } from './application/use-cases/interfaces/IUpdateConversationSaleAttributionUseCase';
import { ConversationSaleAiValidationService } from './application/services/ConversationSaleAiValidationService';
import { ConversationSaleEvidenceService } from './application/services/ConversationSaleEvidenceService';
import { SuggestAgentReplyService } from './application/services/SuggestAgentReplyService';
import { SendAIMessageUseCase } from './application/use-cases/SendAIMessageUseCase';
import { ProcessOutboundMessageUseCase } from './application/use-cases/ProcessOutboundMessageUseCase';
import { ProcessWebhookUseCase } from './application/use-cases/ProcessWebhookUseCase';
import { AIResponseGeneratedHandler } from './application/handlers/AIResponseGeneratedHandler';
import { MessagingBusinessRulesHandler } from './application/handlers/MessagingBusinessRulesHandler';
import { WebhookController } from './presentation/controllers/WebhookController';
import { MessagingController } from './presentation/controllers/MessagingController';
import { ContactModule } from '../contact/contact.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { AgentRulesModule } from '../agent-rules/agent-rules.module';
import { BillingModule } from '../billing/billing.module';
import { MESSAGE_QUEUE } from './domain/ports/IMessageQueue';
import { BullMQMessageQueue } from './infrastructure/queue/BullMQMessageQueue';
import { FollowUpService } from './application/services/FollowUpService';
import { FollowUpAuditService } from './application/services/FollowUpAuditService';
import {
  DeduplicateMessageStep,
  IdentifyContactStep,
  EnsureConversationStep,
  PersistMessageStep,
  AnalyzeMessageStep,
  DispatchReplyStep,
  InboundMessagePipeline,
} from './application/services/inbound-pipeline';
import { AIEscalationRequestedHandler } from './application/handlers/AIEscalationRequestedHandler';
import { INBOUND_MESSAGE_PERSISTER } from './application/ports/IInboundMessagePersister';
import { PrismaMessagingWebhookReceiptStore } from './infrastructure/persistence/repositories/PrismaMessagingWebhookReceiptStore';
import { ConversationIntelligenceService } from './application/services/ConversationIntelligenceService';
import {
  MESSAGING_FACADE,
  MessagingFacade,
} from './application/facades/MessagingFacade';
import { MessagingRealtimeEventsHandler } from './application/handlers/MessagingRealtimeEventsHandler';
import { WebSocketMessagingRealtimePublisher } from './infrastructure/realtime/WebSocketMessagingRealtimePublisher';
import { MESSAGING_REALTIME_PUBLISHER } from './application/ports/IMessagingRealtimePublisher';
import { TrialWelcomeNotificationHandler } from './application/handlers/TrialWelcomeNotificationHandler';
import { BillingQuotaMessagingHandlers } from './application/handlers/BillingQuotaMessagingHandlers';
import { SchedulingIntegrationHandlers } from './application/handlers/SchedulingIntegrationHandlers';
import { SalesIntegrationHandlers } from './application/handlers/SalesIntegrationHandlers';
import { CommerceIntegrationHandlers } from './application/handlers/CommerceIntegrationHandlers';
import { CommerceModule } from '@modules/commerce/commerce.module';
import { OutboundMessageRetryService } from './application/services/OutboundMessageRetryService';
import { WidgetController } from './presentation/controllers/WidgetController';
import { WidgetConfigController } from './presentation/controllers/WidgetConfigController';
import { WidgetScriptController } from './presentation/controllers/WidgetScriptController';
import { GetWidgetConfigUseCase } from './application/use-cases/GetWidgetConfigUseCase';
import { UpdateWidgetConfigUseCase } from './application/use-cases/UpdateWidgetConfigUseCase';
import { UploadWidgetAvatarUseCase } from './application/use-cases/UploadWidgetAvatarUseCase';
import { ProcessWidgetMessageUseCase } from './application/use-cases/ProcessWidgetMessageUseCase';
import { InitiateWidgetContactUseCase } from './application/use-cases/InitiateWidgetContactUseCase';
import { GetWidgetPublicConfigUseCase } from './application/use-cases/GetWidgetPublicConfigUseCase';
import { InitWidgetSessionUseCase } from './application/use-cases/InitWidgetSessionUseCase';
import { CloseWidgetSessionUseCase } from './application/use-cases/CloseWidgetSessionUseCase';
import { GetWidgetSessionMessagesUseCase } from './application/use-cases/GetWidgetSessionMessagesUseCase';
import { PrismaWidgetConfigRepository } from './infrastructure/persistence/repositories/PrismaWidgetConfigRepository';
import { PrismaWidgetSessionRepository } from './infrastructure/persistence/repositories/PrismaWidgetSessionRepository';
import { WIDGET_CONFIG_REPOSITORY } from './domain/repositories/IWidgetConfigRepository';
import { WIDGET_SESSION_REPOSITORY } from './domain/repositories/IWidgetSessionRepository';

@Module({
  imports: [
    MessagingInfrastructureModule,
    ContactModule,
    TenantModule,
    AuthModule,
    AIModule,
    AgentRulesModule,
    BillingModule,
    forwardRef(() => CommerceModule),
  ],
  controllers: [
    WebhookController,
    MessagingController,
    WidgetController,
    WidgetConfigController,
    WidgetScriptController,
  ],
  providers: [
    DeduplicateMessageStep,
    IdentifyContactStep,
    EnsureConversationStep,
    PersistMessageStep,
    AnalyzeMessageStep,
    DispatchReplyStep,
    InboundMessagePipeline,
    ProcessInboundMessageUseCase,
    SalesIntegrationHandlers,
    SchedulingIntegrationHandlers,
    CommerceIntegrationHandlers,
    {
      provide: MESSAGE_QUEUE,
      useClass: BullMQMessageQueue,
    },
    {
      provide: IProcessInboundMessageUseCase,
      useExisting: ProcessInboundMessageUseCase,
    },
    {
      provide: INBOUND_MESSAGE_PERSISTER,
      useExisting: ProcessInboundMessageUseCase,
    },
    {
      provide: IListConversationsUseCase,
      useClass: ListConversationsUseCase,
    },
    {
      provide: IGetMessageHistoryUseCase,
      useClass: GetMessageHistoryUseCase,
    },
    {
      provide: IMarkConversationReadUseCase,
      useClass: MarkConversationReadUseCase,
    },
    {
      provide: ISendHumanMessageUseCase,
      useClass: SendHumanMessageUseCase,
    },
    {
      provide: IEnsureConversationForContactUseCase,
      useClass: EnsureConversationForContactUseCase,
    },
    {
      provide: IUpdateConversationStatusUseCase,
      useClass: UpdateConversationStatusUseCase,
    },
    {
      provide: SUGGEST_AGENT_REPLY_USE_CASE,
      useClass: SuggestAgentReplyUseCase,
    },
    {
      provide: MARK_CONVERSATION_SALE_USE_CASE,
      useExisting: MarkConversationSaleUseCase,
    },
    {
      provide: VOID_CONVERSATION_SALE_USE_CASE,
      useExisting: VoidConversationSaleUseCase,
    },
    {
      provide: GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
      useExisting: GetConversationSaleAttributionUseCase,
    },
    {
      provide: UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
      useExisting: UpdateConversationSaleAttributionUseCase,
    },
    SuggestAgentReplyService,
    ConversationSaleAiValidationService,
    ConversationSaleEvidenceService,
    MarkConversationSaleUseCase,
    VoidConversationSaleUseCase,
    GetConversationSaleAttributionUseCase,
    UpdateConversationSaleAttributionUseCase,
    SendAIMessageUseCase,
    ProcessOutboundMessageUseCase,
    ProcessWebhookUseCase,
    OutboundMessageRetryService,
    AIResponseGeneratedHandler,
    MessagingRealtimeEventsHandler,
    MessagingBusinessRulesHandler,
    FollowUpService,
    FollowUpAuditService,
    ConversationIntelligenceService,
    AIEscalationRequestedHandler,
    PrismaMessagingWebhookReceiptStore,
    WebSocketMessagingRealtimePublisher,
    MessagingFacade,
    {
      provide: WIDGET_CONFIG_REPOSITORY,
      useClass: PrismaWidgetConfigRepository,
    },
    {
      provide: WIDGET_SESSION_REPOSITORY,
      useClass: PrismaWidgetSessionRepository,
    },
    GetWidgetConfigUseCase,
    UpdateWidgetConfigUseCase,
    UploadWidgetAvatarUseCase,
    ProcessWidgetMessageUseCase,
    InitiateWidgetContactUseCase,
    GetWidgetPublicConfigUseCase,
    InitWidgetSessionUseCase,
    CloseWidgetSessionUseCase,
    GetWidgetSessionMessagesUseCase,
    TrialWelcomeNotificationHandler,
    BillingQuotaMessagingHandlers,
    {
      provide: MESSAGING_REALTIME_PUBLISHER,
      useExisting: WebSocketMessagingRealtimePublisher,
    },
    {
      provide: MESSAGING_FACADE,
      useExisting: MessagingFacade,
    },
  ],
  exports: [
    MESSAGE_QUEUE,
    FollowUpService,
    FollowUpAuditService,
    MESSAGING_FACADE,
  ],
})
export class MessagingModule {}
