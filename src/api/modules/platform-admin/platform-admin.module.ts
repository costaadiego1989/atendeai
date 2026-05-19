import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ConfigModule } from '@nestjs/config';

// Existing controllers
import { PlatformTenantsController } from './presentation/controllers/PlatformTenantsController';
import { PlatformSupportController } from './presentation/controllers/PlatformSupportController';

// P0 controllers
import { PlatformDashboardController } from './presentation/controllers/PlatformDashboardController';
import { PlatformBillingController } from './presentation/controllers/PlatformBillingController';
import { PlatformMessagingController } from './presentation/controllers/PlatformMessagingController';
import { PlatformSalesController } from './presentation/controllers/PlatformSalesController';

// P1 controllers
import { PlatformCommerceController } from './presentation/controllers/PlatformCommerceController';
import { PlatformRecoveryController } from './presentation/controllers/PlatformRecoveryController';
import { PlatformContactsController } from './presentation/controllers/PlatformContactsController';
import { PlatformProspectingController } from './presentation/controllers/PlatformProspectingController';
import { PlatformSchedulingController } from './presentation/controllers/PlatformSchedulingController';
import { PlatformAIController } from './presentation/controllers/PlatformAIController';

// P2 controllers
import { PlatformSocialController } from './presentation/controllers/PlatformSocialController';
import { PlatformCatalogController } from './presentation/controllers/PlatformCatalogController';
import { PlatformInventoryController } from './presentation/controllers/PlatformInventoryController';
import { PlatformSupportMetricsController } from './presentation/controllers/PlatformSupportMetricsController';
import { PlatformAuthController } from './presentation/controllers/PlatformAuthController';
import { PlatformPaymentController } from './presentation/controllers/PlatformPaymentController';
import { PlatformProposalController } from './presentation/controllers/PlatformProposalController';

// Existing infrastructure
import { PlatformTenantBillingReadDao } from './infrastructure/PlatformTenantBillingReadDao';

// P0 ReadDaos
import { PlatformDashboardReadDao } from './infrastructure/daos/PlatformDashboardReadDao';
import { PlatformBillingReadDao } from './infrastructure/daos/PlatformBillingReadDao';
import { PlatformMessagingReadDao } from './infrastructure/daos/PlatformMessagingReadDao';
import { PlatformSalesReadDao } from './infrastructure/daos/PlatformSalesReadDao';
import { PlatformTenantsMetricsReadDao } from './infrastructure/daos/PlatformTenantsMetricsReadDao';

// P1 ReadDaos
import { PlatformCommerceReadDao } from './infrastructure/daos/PlatformCommerceReadDao';
import { PlatformRecoveryReadDao } from './infrastructure/daos/PlatformRecoveryReadDao';
import { PlatformContactsReadDao } from './infrastructure/daos/PlatformContactsReadDao';
import { PlatformProspectingReadDao } from './infrastructure/daos/PlatformProspectingReadDao';
import { PlatformSchedulingReadDao } from './infrastructure/daos/PlatformSchedulingReadDao';
import { PlatformAIReadDao } from './infrastructure/daos/PlatformAIReadDao';

// P2 ReadDaos
import { PlatformSocialReadDao } from './infrastructure/daos/PlatformSocialReadDao';
import { PlatformCatalogReadDao } from './infrastructure/daos/PlatformCatalogReadDao';
import { PlatformInventoryReadDao } from './infrastructure/daos/PlatformInventoryReadDao';
import { PlatformSupportMetricsReadDao } from './infrastructure/daos/PlatformSupportMetricsReadDao';
import { PlatformAuthReadDao } from './infrastructure/daos/PlatformAuthReadDao';
import { PlatformPaymentReadDao } from './infrastructure/daos/PlatformPaymentReadDao';
import { PlatformProposalReadDao } from './infrastructure/daos/PlatformProposalReadDao';

// Existing use cases
import { ListPlatformTenantsOverviewUseCase } from './application/use-cases/ListPlatformTenantsOverviewUseCase';
import { AdjustTenantSubscriptionQuotasUseCase } from './application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from './application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from './application/use-cases/SendTenantManualWhatsAppUseCase';

// P0 use cases
import { GetPlatformDashboardOverviewUseCase } from './application/use-cases/metrics/GetPlatformDashboardOverviewUseCase';
import { GetPlatformBillingMetricsUseCase } from './application/use-cases/metrics/GetPlatformBillingMetricsUseCase';
import { ListPlatformSubscriptionsUseCase } from './application/use-cases/metrics/ListPlatformSubscriptionsUseCase';
import { ListPlatformUsageUseCase } from './application/use-cases/metrics/ListPlatformUsageUseCase';
import { GetPlatformMessagingMetricsUseCase } from './application/use-cases/metrics/GetPlatformMessagingMetricsUseCase';
import { ListPlatformConversationsUseCase } from './application/use-cases/metrics/ListPlatformConversationsUseCase';
import { GetPlatformSalesMetricsUseCase } from './application/use-cases/metrics/GetPlatformSalesMetricsUseCase';
import { ListPlatformPaymentLinksUseCase } from './application/use-cases/metrics/ListPlatformPaymentLinksUseCase';
import {
  GetPlatformTenantsMetricsUseCase,
  GetPlatformTenantDetailUseCase,
} from './application/use-cases/metrics/GetPlatformTenantsMetricsUseCase';

// P1 use cases
import { GetPlatformCommerceMetricsUseCase } from './application/use-cases/metrics/GetPlatformCommerceMetricsUseCase';
import {
  GetPlatformRecoveryMetricsUseCase,
  ListPlatformRecoveryCasesUseCase,
} from './application/use-cases/metrics/GetPlatformRecoveryMetricsUseCase';
import {
  GetPlatformContactsMetricsUseCase,
  ListPlatformContactsUseCase,
} from './application/use-cases/metrics/GetPlatformContactsMetricsUseCase';
import {
  GetPlatformProspectingMetricsUseCase,
  ListPlatformCampaignsUseCase,
} from './application/use-cases/metrics/GetPlatformProspectingMetricsUseCase';
import {
  GetPlatformSchedulingMetricsUseCase,
  ListPlatformRecurrencesUseCase,
} from './application/use-cases/metrics/GetPlatformSchedulingMetricsUseCase';
import {
  GetPlatformAIMetricsUseCase,
  ListPlatformAISessionsUseCase,
} from './application/use-cases/metrics/GetPlatformAIMetricsUseCase';

// P2 use cases
import { GetPlatformSocialMetricsUseCase } from './application/use-cases/metrics/GetPlatformSocialMetricsUseCase';
import { GetPlatformCatalogMetricsUseCase } from './application/use-cases/metrics/GetPlatformCatalogMetricsUseCase';
import { GetPlatformInventoryMetricsUseCase } from './application/use-cases/metrics/GetPlatformInventoryMetricsUseCase';
import { GetPlatformSupportMetricsUseCase } from './application/use-cases/metrics/GetPlatformSupportMetricsUseCase';
import { GetPlatformAuthMetricsUseCase } from './application/use-cases/metrics/GetPlatformAuthMetricsUseCase';
import { GetPlatformPaymentMetricsUseCase } from './application/use-cases/metrics/GetPlatformPaymentMetricsUseCase';
import { GetPlatformProposalMetricsUseCase } from './application/use-cases/metrics/GetPlatformProposalMetricsUseCase';

// External modules
import { BillingModule } from '@modules/billing/billing.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { AIModule } from '@modules/ai/ai.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SupportModule } from '@modules/support/support.module';

// Guard
import { PlatformAdminApiKeyGuard } from './presentation/guards/PlatformAdminApiKeyGuard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BillingModule,
    ContactModule,
    MessagingModule,
    AIModule,
    TenantModule,
    SupportModule,
  ],
  controllers: [
    // Existing
    PlatformTenantsController,
    PlatformSupportController,
    // P0
    PlatformDashboardController,
    PlatformBillingController,
    PlatformMessagingController,
    PlatformSalesController,
    // P1
    PlatformCommerceController,
    PlatformRecoveryController,
    PlatformContactsController,
    PlatformProspectingController,
    PlatformSchedulingController,
    PlatformAIController,
    // P2
    PlatformSocialController,
    PlatformCatalogController,
    PlatformInventoryController,
    PlatformSupportMetricsController,
    PlatformAuthController,
    PlatformPaymentController,
    PlatformProposalController,
  ],
  providers: [
    // Guard
    PlatformAdminApiKeyGuard,

    // Existing ReadDaos
    PlatformTenantBillingReadDao,

    // P0 ReadDaos
    PlatformDashboardReadDao,
    PlatformBillingReadDao,
    PlatformMessagingReadDao,
    PlatformSalesReadDao,
    PlatformTenantsMetricsReadDao,

    // P1 ReadDaos
    PlatformCommerceReadDao,
    PlatformRecoveryReadDao,
    PlatformContactsReadDao,
    PlatformProspectingReadDao,
    PlatformSchedulingReadDao,
    PlatformAIReadDao,

    // P2 ReadDaos
    PlatformSocialReadDao,
    PlatformCatalogReadDao,
    PlatformInventoryReadDao,
    PlatformSupportMetricsReadDao,
    PlatformAuthReadDao,
    PlatformPaymentReadDao,
    PlatformProposalReadDao,

    // Existing use cases
    ListPlatformTenantsOverviewUseCase,
    AdjustTenantSubscriptionQuotasUseCase,
    DraftTenantAdminMessageUseCase,
    SendTenantManualWhatsAppUseCase,

    // P0 use cases
    GetPlatformDashboardOverviewUseCase,
    GetPlatformBillingMetricsUseCase,
    ListPlatformSubscriptionsUseCase,
    ListPlatformUsageUseCase,
    GetPlatformMessagingMetricsUseCase,
    ListPlatformConversationsUseCase,
    GetPlatformSalesMetricsUseCase,
    ListPlatformPaymentLinksUseCase,
    GetPlatformTenantsMetricsUseCase,
    GetPlatformTenantDetailUseCase,

    // P1 use cases
    GetPlatformCommerceMetricsUseCase,
    GetPlatformRecoveryMetricsUseCase,
    ListPlatformRecoveryCasesUseCase,
    GetPlatformContactsMetricsUseCase,
    ListPlatformContactsUseCase,
    GetPlatformProspectingMetricsUseCase,
    ListPlatformCampaignsUseCase,
    GetPlatformSchedulingMetricsUseCase,
    ListPlatformRecurrencesUseCase,
    GetPlatformAIMetricsUseCase,
    ListPlatformAISessionsUseCase,

    // P2 use cases
    GetPlatformSocialMetricsUseCase,
    GetPlatformCatalogMetricsUseCase,
    GetPlatformInventoryMetricsUseCase,
    GetPlatformSupportMetricsUseCase,
    GetPlatformAuthMetricsUseCase,
    GetPlatformPaymentMetricsUseCase,
    GetPlatformProposalMetricsUseCase,
  ],
})
export class PlatformAdminModule {}
