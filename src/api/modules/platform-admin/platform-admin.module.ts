import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ConfigModule } from '@nestjs/config';

// Existing controllers
import { PlatformTenantsController } from './presentation/controllers/PlatformTenantsController';
import { PlatformSupportController } from './presentation/controllers/PlatformSupportController';

// New P0 controllers
import { PlatformDashboardController } from './presentation/controllers/PlatformDashboardController';
import { PlatformBillingController } from './presentation/controllers/PlatformBillingController';
import { PlatformMessagingController } from './presentation/controllers/PlatformMessagingController';
import { PlatformSalesController } from './presentation/controllers/PlatformSalesController';

// Existing infrastructure
import { PlatformTenantBillingReadDao } from './infrastructure/PlatformTenantBillingReadDao';

// New P0 ReadDaos
import { PlatformDashboardReadDao } from './infrastructure/daos/PlatformDashboardReadDao';
import { PlatformBillingReadDao } from './infrastructure/daos/PlatformBillingReadDao';
import { PlatformMessagingReadDao } from './infrastructure/daos/PlatformMessagingReadDao';
import { PlatformSalesReadDao } from './infrastructure/daos/PlatformSalesReadDao';
import { PlatformTenantsMetricsReadDao } from './infrastructure/daos/PlatformTenantsMetricsReadDao';

// Existing use cases
import { ListPlatformTenantsOverviewUseCase } from './application/use-cases/ListPlatformTenantsOverviewUseCase';
import { AdjustTenantSubscriptionQuotasUseCase } from './application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from './application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from './application/use-cases/SendTenantManualWhatsAppUseCase';

// New P0 use cases
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
    PlatformTenantsController,
    PlatformSupportController,
    PlatformDashboardController,
    PlatformBillingController,
    PlatformMessagingController,
    PlatformSalesController,
  ],
  providers: [
    // Guard
    PlatformAdminApiKeyGuard,

    // Existing ReadDaos
    PlatformTenantBillingReadDao,

    // New P0 ReadDaos
    PlatformDashboardReadDao,
    PlatformBillingReadDao,
    PlatformMessagingReadDao,
    PlatformSalesReadDao,
    PlatformTenantsMetricsReadDao,

    // Existing use cases
    ListPlatformTenantsOverviewUseCase,
    AdjustTenantSubscriptionQuotasUseCase,
    DraftTenantAdminMessageUseCase,
    SendTenantManualWhatsAppUseCase,

    // New P0 use cases
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
  ],
})
export class PlatformAdminModule {}
