import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ConfigModule } from '@nestjs/config';
import { PlatformTenantsController } from './presentation/controllers/PlatformTenantsController';
import { PlatformSupportController } from './presentation/controllers/PlatformSupportController';
import { PlatformTenantBillingReadDao } from './infrastructure/PlatformTenantBillingReadDao';
import { ListPlatformTenantsOverviewUseCase } from './application/use-cases/ListPlatformTenantsOverviewUseCase';
import { AdjustTenantSubscriptionQuotasUseCase } from './application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from './application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from './application/use-cases/SendTenantManualWhatsAppUseCase';
import { BillingModule } from '@modules/billing/billing.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { AIModule } from '@modules/ai/ai.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SupportModule } from '@modules/support/support.module';

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
  controllers: [PlatformTenantsController, PlatformSupportController],
  providers: [
    PlatformAdminApiKeyGuard,
    PlatformTenantBillingReadDao,
    ListPlatformTenantsOverviewUseCase,
    AdjustTenantSubscriptionQuotasUseCase,
    DraftTenantAdminMessageUseCase,
    SendTenantManualWhatsAppUseCase,
  ],
})
export class PlatformAdminModule {}
