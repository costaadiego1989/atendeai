import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TenantModule } from '@modules/tenant/tenant.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ProspectCampaignController } from './presentation/controllers/ProspectCampaignController';
import { ProspectExecutionController } from './presentation/controllers/ProspectExecutionController';
import { ProspectSearchController } from './presentation/controllers/ProspectSearchController';
import { ProspectAdsController } from './presentation/controllers/ProspectAdsController';
import { ProspectReportController } from './presentation/controllers/ProspectReportController';
import { ICreateProspectCampaignUseCase } from './application/use-cases/interfaces/ICreateProspectCampaignUseCase';
import { CreateProspectCampaignUseCase } from './application/use-cases/CreateProspectCampaignUseCase';
import { IListProspectCampaignsUseCase } from './application/use-cases/interfaces/IListProspectCampaignsUseCase';
import { PROSPECT_CAMPAIGN_REPOSITORY } from './domain/repositories/IProspectCampaignRepository';
import { PrismaProspectCampaignRepository } from './infrastructure/persistence/repositories/PrismaProspectCampaignRepository';
import { ListProspectCampaignsUseCase } from './application/use-cases/ListProspectCampaignsUseCase';
import { IActivateProspectCampaignUseCase } from './application/use-cases/interfaces/IActivateProspectCampaignUseCase';
import { ActivateProspectCampaignUseCase } from './application/use-cases/ActivateProspectCampaignUseCase';
import { IPauseProspectCampaignUseCase } from './application/use-cases/interfaces/IPauseProspectCampaignUseCase';
import { PauseProspectCampaignUseCase } from './application/use-cases/PauseProspectCampaignUseCase';
import { IStartProspectCampaignUseCase } from './application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { StartProspectCampaignUseCase } from './application/use-cases/StartProspectCampaignUseCase';
import { PROSPECT_EXECUTION_REPOSITORY } from './domain/repositories/IProspectExecutionRepository';
import { PrismaProspectExecutionRepository } from './infrastructure/persistence/repositories/PrismaProspectExecutionRepository';
import { IDispatchProspectExecutionUseCase } from './application/use-cases/interfaces/IDispatchProspectExecutionUseCase';
import { DispatchProspectExecutionUseCase } from './application/use-cases/DispatchProspectExecutionUseCase';
import { IDispatchNextProspectCampaignExecutionUseCase } from './application/use-cases/interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { DispatchNextProspectCampaignExecutionUseCase } from './application/use-cases/DispatchNextProspectCampaignExecutionUseCase';
import { IRegisterProspectResponseUseCase } from './application/use-cases/interfaces/IRegisterProspectResponseUseCase';
import { RegisterProspectResponseUseCase } from './application/use-cases/RegisterProspectResponseUseCase';
import { ProspectMessageReceivedHandler } from './application/handlers/ProspectMessageReceivedHandler';
import { IRegisterProspectStopUseCase } from './application/use-cases/interfaces/IRegisterProspectStopUseCase';
import { RegisterProspectStopUseCase } from './application/use-cases/RegisterProspectStopUseCase';
import { ProspectOptOutPolicy } from './application/services/ProspectOptOutPolicy';
import { ProspectDispatchPolicy } from './application/services/ProspectDispatchPolicy';
import { ICreateProspectSearchUseCase } from './application/use-cases/interfaces/ICreateProspectSearchUseCase';
import { CreateProspectSearchUseCase } from './application/use-cases/CreateProspectSearchUseCase';
import { IListProspectSearchesUseCase } from './application/use-cases/interfaces/IListProspectSearchesUseCase';
import { ListProspectSearchesUseCase } from './application/use-cases/ListProspectSearchesUseCase';
import { PROSPECT_SEARCH_REPOSITORY } from './domain/repositories/IProspectSearchRepository';
import { PrismaProspectSearchRepository } from './infrastructure/persistence/repositories/PrismaProspectSearchRepository';
import { PROSPECT_SEARCH_QUEUE } from './domain/ports/IProspectSearchQueue';
import { BullMQProspectSearchQueue } from './infrastructure/queue/BullMQProspectSearchQueue';
import { IExecuteProspectSearchUseCase } from './application/use-cases/interfaces/IExecuteProspectSearchUseCase';
import { ExecuteProspectSearchUseCase } from './application/use-cases/ExecuteProspectSearchUseCase';
import { PROSPECT_SEARCH_RESULT_REPOSITORY } from './domain/repositories/IProspectSearchResultRepository';
import { PrismaProspectSearchResultRepository } from './infrastructure/persistence/repositories/PrismaProspectSearchResultRepository';
import { PROSPECT_SEARCH_SOURCE_REGISTRY } from './domain/ports/IProspectSearchSourceRegistry';
import { ProspectSearchSourceRegistry } from './infrastructure/acl/ProspectSearchSourceRegistry';
import { GooglePlacesProspectSearchSource } from './infrastructure/acl/GooglePlacesProspectSearchSource';
import { IListProspectSearchResultsUseCase } from './application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import { ListProspectSearchResultsUseCase } from './application/use-cases/ListProspectSearchResultsUseCase';
import { PROSPECT_WEBSITE_ENRICHER } from './domain/ports/IProspectWebsiteEnricher';
import { HttpProspectWebsiteEnricher } from './infrastructure/services/HttpProspectWebsiteEnricher';
import { IImportProspectSearchResultsUseCase } from './application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import { ImportProspectSearchResultsUseCase } from './application/use-cases/ImportProspectSearchResultsUseCase';
import { IProspectSelectedSearchResultsUseCase } from './application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';
import { ProspectSelectedSearchResultsUseCase } from './application/use-cases/ProspectSelectedSearchResultsUseCase';
import { ISuggestProspectCampaignMessageUseCase } from './application/use-cases/interfaces/ISuggestProspectCampaignMessageUseCase';
import { SuggestProspectCampaignMessageUseCase } from './application/use-cases/SuggestProspectCampaignMessageUseCase';
import { AIModule } from '@modules/ai/ai.module';
import { AgentRulesModule } from '@modules/agent-rules/agent-rules.module';
import { BillingModule } from '@modules/billing/billing.module';
import { ICreateProspectAdsInsightQueryUseCase } from './application/use-cases/interfaces/ICreateProspectAdsInsightQueryUseCase';
import { CreateProspectAdsInsightQueryUseCase } from './application/use-cases/CreateProspectAdsInsightQueryUseCase';
import { IListProspectAdsInsightQueriesUseCase } from './application/use-cases/interfaces/IListProspectAdsInsightQueriesUseCase';
import { ListProspectAdsInsightQueriesUseCase } from './application/use-cases/ListProspectAdsInsightQueriesUseCase';
import { IListProspectAdsInsightResultsUseCase } from './application/use-cases/interfaces/IListProspectAdsInsightResultsUseCase';
import { ListProspectAdsInsightResultsUseCase } from './application/use-cases/ListProspectAdsInsightResultsUseCase';
import { ISyncProspectAdsLeadsUseCase } from './application/use-cases/interfaces/ISyncProspectAdsLeadsUseCase';
import { SyncProspectAdsLeadsUseCase } from './application/use-cases/SyncProspectAdsLeadsUseCase';
import { IListProspectLeadCapturesUseCase } from './application/use-cases/interfaces/IListProspectLeadCapturesUseCase';
import { ListProspectLeadCapturesUseCase } from './application/use-cases/ListProspectLeadCapturesUseCase';
import { IImportProspectLeadCapturesUseCase } from './application/use-cases/interfaces/IImportProspectLeadCapturesUseCase';
import { ImportProspectLeadCapturesUseCase } from './application/use-cases/ImportProspectLeadCapturesUseCase';
import { IProspectLeadCapturesUseCase } from './application/use-cases/interfaces/IProspectLeadCapturesUseCase';
import { ProspectLeadCapturesUseCase } from './application/use-cases/ProspectLeadCapturesUseCase';
import { PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY } from './domain/repositories/IProspectAdsInsightQueryRepository';
import { PrismaProspectAdsInsightQueryRepository } from './infrastructure/persistence/repositories/PrismaProspectAdsInsightQueryRepository';
import { PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY } from './domain/repositories/IProspectAdsInsightResultRepository';
import { PrismaProspectAdsInsightResultRepository } from './infrastructure/persistence/repositories/PrismaProspectAdsInsightResultRepository';
import { PROSPECT_LEAD_CAPTURE_REPOSITORY } from './domain/repositories/IProspectLeadCaptureRepository';
import { PrismaProspectLeadCaptureRepository } from './infrastructure/persistence/repositories/PrismaProspectLeadCaptureRepository';
import { PROSPECT_ASYNC_JOB_REPOSITORY } from './domain/repositories/IProspectAsyncJobRepository';
import { PrismaProspectAsyncJobRepository } from './infrastructure/persistence/repositories/PrismaProspectAsyncJobRepository';
import { GOOGLE_ADS_INSIGHTS_SOURCE } from './domain/ports/IGoogleAdsInsightsSource';
import { GoogleAdsInsightsSource } from './infrastructure/acl/GoogleAdsInsightsSource';
import { GOOGLE_ADS_LEAD_SOURCE } from './domain/ports/IGoogleAdsLeadSource';
import { GoogleAdsLeadSource } from './infrastructure/acl/GoogleAdsLeadSource';
import { GOOGLE_ADS_CONNECTION_REPOSITORY } from './domain/repositories/IGoogleAdsConnectionRepository';
import { PrismaGoogleAdsConnectionRepository } from './infrastructure/persistence/repositories/PrismaGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from './infrastructure/services/GoogleAdsOAuthService';
import { GoogleAdsOAuthStateService } from './infrastructure/services/GoogleAdsOAuthStateService';
import { GetGoogleAdsConnectionStatusUseCase } from './application/use-cases/GetGoogleAdsConnectionStatusUseCase';
import { StartGoogleAdsConnectionUseCase } from './application/use-cases/StartGoogleAdsConnectionUseCase';
import { CompleteGoogleAdsConnectionUseCase } from './application/use-cases/CompleteGoogleAdsConnectionUseCase';
import { ListGoogleAdsAccessibleAccountsUseCase } from './application/use-cases/ListGoogleAdsAccessibleAccountsUseCase';
import { SelectGoogleAdsAccountUseCase } from './application/use-cases/SelectGoogleAdsAccountUseCase';
import { DisconnectGoogleAdsConnectionUseCase } from './application/use-cases/DisconnectGoogleAdsConnectionUseCase';
import { GenerateProspectSearchReportUseCase } from './application/use-cases/GenerateProspectSearchReportUseCase';
import { GenerateProspectCampaignReportUseCase } from './application/use-cases/GenerateProspectCampaignReportUseCase';
import { ProspectingAsyncJobsService } from './infrastructure/persistence/repositories/ProspectingAsyncJobsService';
import { ProspectReportCsvBuilder } from './application/services/ProspectReportCsvBuilder';
import { ProspectingAsyncJobProcessor } from './infrastructure/queue/ProspectingAsyncJobProcessor';
import { MetaWebhookController } from './presentation/controllers/MetaWebhookController';
import { IHandleMetaQualityEventUseCase } from './application/use-cases/interfaces/IHandleMetaQualityEventUseCase';
import { HandleMetaQualityEventUseCase } from './application/use-cases/HandleMetaQualityEventUseCase';
import { CONTACT_REPOSITORY } from '@modules/contact/domain/repositories/IContactRepository';
import { PROSPECTING_DAILY_QUOTA_PORT } from './application/ports/IProspectingDailyQuotaPort';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';
import { PROSPECT_DISPATCH_QUEUE } from './domain/ports/IProspectDispatchQueue';
import { BullMQProspectDispatchQueue } from './infrastructure/queue/BullMQProspectDispatchQueue';
import { ProspectDispatchProcessor } from './infrastructure/queue/ProspectDispatchProcessor';

const PROSPECTING_REPORTING_PROVIDERS = [
  GenerateProspectSearchReportUseCase,
  GenerateProspectCampaignReportUseCase,
  ProspectingAsyncJobsService,
  ProspectReportCsvBuilder,
  ProspectingAsyncJobProcessor,
];

const PROSPECTING_WEBHOOK_PROVIDERS = [
  {
    provide: IHandleMetaQualityEventUseCase,
    useClass: HandleMetaQualityEventUseCase,
  },
];

const PROSPECTING_CAMPAIGN_PROVIDERS = [
  {
    provide: ICreateProspectCampaignUseCase,
    useClass: CreateProspectCampaignUseCase,
  },
  {
    provide: IListProspectCampaignsUseCase,
    useClass: ListProspectCampaignsUseCase,
  },
  {
    provide: IActivateProspectCampaignUseCase,
    useClass: ActivateProspectCampaignUseCase,
  },
  {
    provide: IPauseProspectCampaignUseCase,
    useClass: PauseProspectCampaignUseCase,
  },
  {
    provide: IStartProspectCampaignUseCase,
    useClass: StartProspectCampaignUseCase,
  },
  {
    provide: IDispatchProspectExecutionUseCase,
    useClass: DispatchProspectExecutionUseCase,
  },
  {
    provide: IDispatchNextProspectCampaignExecutionUseCase,
    useClass: DispatchNextProspectCampaignExecutionUseCase,
  },
  {
    provide: IRegisterProspectResponseUseCase,
    useClass: RegisterProspectResponseUseCase,
  },
  {
    provide: IRegisterProspectStopUseCase,
    useClass: RegisterProspectStopUseCase,
  },
  {
    provide: ISuggestProspectCampaignMessageUseCase,
    useClass: SuggestProspectCampaignMessageUseCase,
  },
];

const PROSPECTING_SEARCH_PROVIDERS = [
  {
    provide: PROSPECTING_DAILY_QUOTA_PORT,
    useExisting: BillingProspectingQuotaService,
  },
  {
    provide: ICreateProspectSearchUseCase,
    useClass: CreateProspectSearchUseCase,
  },
  {
    provide: IListProspectSearchesUseCase,
    useClass: ListProspectSearchesUseCase,
  },
  {
    provide: IExecuteProspectSearchUseCase,
    useClass: ExecuteProspectSearchUseCase,
  },
  {
    provide: IListProspectSearchResultsUseCase,
    useClass: ListProspectSearchResultsUseCase,
  },
  {
    provide: IImportProspectSearchResultsUseCase,
    useClass: ImportProspectSearchResultsUseCase,
  },
  {
    provide: IProspectSelectedSearchResultsUseCase,
    useClass: ProspectSelectedSearchResultsUseCase,
  },
  { provide: PROSPECT_SEARCH_QUEUE, useClass: BullMQProspectSearchQueue },
  {
    provide: PROSPECT_SEARCH_SOURCE_REGISTRY,
    useClass: ProspectSearchSourceRegistry,
  },
  { provide: PROSPECT_WEBSITE_ENRICHER, useClass: HttpProspectWebsiteEnricher },
];

const PROSPECTING_ADS_PROVIDERS = [
  {
    provide: ICreateProspectAdsInsightQueryUseCase,
    useClass: CreateProspectAdsInsightQueryUseCase,
  },
  {
    provide: IListProspectAdsInsightQueriesUseCase,
    useClass: ListProspectAdsInsightQueriesUseCase,
  },
  {
    provide: IListProspectAdsInsightResultsUseCase,
    useClass: ListProspectAdsInsightResultsUseCase,
  },
  {
    provide: ISyncProspectAdsLeadsUseCase,
    useClass: SyncProspectAdsLeadsUseCase,
  },
  {
    provide: IListProspectLeadCapturesUseCase,
    useClass: ListProspectLeadCapturesUseCase,
  },
  {
    provide: IImportProspectLeadCapturesUseCase,
    useClass: ImportProspectLeadCapturesUseCase,
  },
  {
    provide: IProspectLeadCapturesUseCase,
    useClass: ProspectLeadCapturesUseCase,
  },
  GetGoogleAdsConnectionStatusUseCase,
  StartGoogleAdsConnectionUseCase,
  CompleteGoogleAdsConnectionUseCase,
  ListGoogleAdsAccessibleAccountsUseCase,
  SelectGoogleAdsAccountUseCase,
  DisconnectGoogleAdsConnectionUseCase,
  { provide: GOOGLE_ADS_INSIGHTS_SOURCE, useClass: GoogleAdsInsightsSource },
  { provide: GOOGLE_ADS_LEAD_SOURCE, useClass: GoogleAdsLeadSource },
  GoogleAdsOAuthService,
  GoogleAdsOAuthStateService,
  GoogleAdsInsightsSource,
  GoogleAdsLeadSource,
];

const PROSPECTING_REPOSITORY_PROVIDERS = [
  {
    provide: PROSPECT_CAMPAIGN_REPOSITORY,
    useClass: PrismaProspectCampaignRepository,
  },
  {
    provide: PROSPECT_EXECUTION_REPOSITORY,
    useClass: PrismaProspectExecutionRepository,
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
    provide: PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY,
    useClass: PrismaProspectAdsInsightQueryRepository,
  },
  {
    provide: PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY,
    useClass: PrismaProspectAdsInsightResultRepository,
  },
  {
    provide: PROSPECT_LEAD_CAPTURE_REPOSITORY,
    useClass: PrismaProspectLeadCaptureRepository,
  },
  {
    provide: GOOGLE_ADS_CONNECTION_REPOSITORY,
    useClass: PrismaGoogleAdsConnectionRepository,
  },
  {
    provide: PROSPECT_ASYNC_JOB_REPOSITORY,
    useClass: PrismaProspectAsyncJobRepository,
  },
];

const PROSPECTING_DISPATCH_QUEUE_PROVIDERS = [
  { provide: PROSPECT_DISPATCH_QUEUE, useClass: BullMQProspectDispatchQueue },
  ProspectDispatchProcessor,
];

const PROSPECTING_POLICY_AND_HANDLERS = [
  GooglePlacesProspectSearchSource,
  HttpProspectWebsiteEnricher,
  ProspectOptOutPolicy,
  ProspectDispatchPolicy,
  ProspectMessageReceivedHandler,
];

@Module({
  imports: [
    DatabaseModule,
    TenantModule,
    AuthModule,
    ContactModule,
    MessagingModule,
    AIModule,
    AgentRulesModule,
    BillingModule,
    BullModule.registerQueue({
      name: 'prospecting-async-jobs',
    }),
    BullModule.registerQueue({
      name: 'prospecting-dispatch',
    }),
  ],
  controllers: [
    ProspectCampaignController,
    ProspectExecutionController,
    MetaWebhookController,
    ProspectSearchController,
    ProspectAdsController,
    ProspectReportController,
  ],
  providers: [
    ...PROSPECTING_REPORTING_PROVIDERS,
    ...PROSPECTING_WEBHOOK_PROVIDERS,
    ...PROSPECTING_CAMPAIGN_PROVIDERS,
    ...PROSPECTING_SEARCH_PROVIDERS,
    ...PROSPECTING_ADS_PROVIDERS,
    ...PROSPECTING_REPOSITORY_PROVIDERS,
    ...PROSPECTING_POLICY_AND_HANDLERS,
    ...PROSPECTING_DISPATCH_QUEUE_PROVIDERS,
  ],
  exports: [
    ICreateProspectCampaignUseCase,
    IListProspectCampaignsUseCase,
    IActivateProspectCampaignUseCase,
    IPauseProspectCampaignUseCase,
    IStartProspectCampaignUseCase,
    IDispatchProspectExecutionUseCase,
    IDispatchNextProspectCampaignExecutionUseCase,
    IRegisterProspectResponseUseCase,
    IRegisterProspectStopUseCase,
    ICreateProspectSearchUseCase,
    IListProspectSearchesUseCase,
    IExecuteProspectSearchUseCase,
    IListProspectSearchResultsUseCase,
    IImportProspectSearchResultsUseCase,
    IProspectSelectedSearchResultsUseCase,
    ISuggestProspectCampaignMessageUseCase,
    ICreateProspectAdsInsightQueryUseCase,
    IListProspectAdsInsightQueriesUseCase,
    IListProspectAdsInsightResultsUseCase,
    ISyncProspectAdsLeadsUseCase,
    IListProspectLeadCapturesUseCase,
    IImportProspectLeadCapturesUseCase,
    IProspectLeadCapturesUseCase,
    PROSPECT_CAMPAIGN_REPOSITORY,
    PROSPECT_EXECUTION_REPOSITORY,
    PROSPECT_SEARCH_REPOSITORY,
    PROSPECT_SEARCH_RESULT_REPOSITORY,
    PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY,
    PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY,
    PROSPECT_LEAD_CAPTURE_REPOSITORY,
  ],
})
export class ProspectingModule {}
