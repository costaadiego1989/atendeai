import { Module } from '@nestjs/common';
import { PrismaBillingRepository } from './infrastructure/persistence/repositories/PrismaBillingRepository';
import { UsageController } from './presentation/controllers/UsageController';
import { SubscriptionController } from './presentation/controllers/SubscriptionController';
import { PublicBillingController } from './presentation/controllers/PublicBillingController';
import { GetUsageUseCase } from './application/use-cases/GetUsageUseCase';
import { BILLING_REPOSITORY } from './domain/repositories/IBillingRepository';
import { IGetUsageUseCase } from './application/use-cases/interfaces/IGetUsageUseCase';
import { BillingTenantHandlers } from './application/handlers/BillingTenantHandlers';
import { BillingUsageHandlers } from './application/handlers/BillingUsageHandlers';
import { BillingPaymentHandlers } from './application/handlers/BillingPaymentHandlers';
import { RecordUsageUseCase } from './application/use-cases/RecordUsageUseCase';
import { IRecordUsageUseCase } from './application/use-cases/interfaces/IRecordUsageUseCase';
import { CheckQuotaUseCase } from './application/use-cases/CheckQuotaUseCase';
import { ICheckQuotaUseCase } from './application/use-cases/interfaces/ICheckQuotaUseCase';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { BullModule } from '@nestjs/bullmq';
import { BillingProvisioningProcessor } from './application/processors/BillingProvisioningProcessor';
import { BillingPlanChangeProcessor } from './application/processors/BillingPlanChangeProcessor';
import { TenantModule } from '../tenant/tenant.module';
import { ChangeSubscriptionPlanUseCase } from './application/use-cases/ChangeSubscriptionPlanUseCase';
import { IChangeSubscriptionPlanUseCase } from './application/use-cases/interfaces/IChangeSubscriptionPlanUseCase';
import { CancelSubscriptionUseCase } from './application/use-cases/CancelSubscriptionUseCase';
import { ICancelSubscriptionUseCase } from './application/use-cases/interfaces/ICancelSubscriptionUseCase';
import { IListBillingPlansUseCase } from './application/use-cases/interfaces/IListBillingPlansUseCase';
import { ListBillingPlansUseCase } from './application/use-cases/ListBillingPlansUseCase';
import { IGetSubscriptionCatalogUseCase } from './application/use-cases/interfaces/IGetSubscriptionCatalogUseCase';
import { GetSubscriptionCatalogUseCase } from './application/use-cases/GetSubscriptionCatalogUseCase';
import { IReplaceSubscriptionModulesUseCase } from './application/use-cases/interfaces/IReplaceSubscriptionModulesUseCase';
import { ReplaceSubscriptionModulesUseCase } from './application/use-cases/ReplaceSubscriptionModulesUseCase';
import { PurchaseAddonPackageUseCase } from './application/use-cases/PurchaseAddonPackageUseCase';
import { IPurchaseAddonPackageUseCase } from './application/use-cases/interfaces/IPurchaseAddonPackageUseCase';
import { CancelAddonPackageUseCase } from './application/use-cases/CancelAddonPackageUseCase';
import { ICancelAddonPackageUseCase } from './application/use-cases/interfaces/ICancelAddonPackageUseCase';
import { GetAddonPackageInfoUseCase } from './application/use-cases/GetAddonPackageInfoUseCase';
import { IGetAddonPackageInfoUseCase } from './application/use-cases/interfaces/IGetAddonPackageInfoUseCase';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import { TenantManualSaleEligibilityService } from '@shared/infrastructure/billing/TenantManualSaleEligibilityService';
import { BillingProspectingQuotaService } from './application/services/BillingProspectingQuotaService';

@Module({
  imports: [
    AuthModule,
    PaymentModule,
    TenantModule,
    BullModule.registerQueue({
      name: 'billing-provisioning',
    }),
    BullModule.registerQueue({
      name: 'billing-plan-changes',
    }),
  ],
  controllers: [UsageController, SubscriptionController, PublicBillingController],
  providers: [
    BillingTenantHandlers,
    BillingUsageHandlers,
    BillingPaymentHandlers,
    BillingProvisioningProcessor,
    BillingPlanChangeProcessor,
    TenantModuleAccessService,
    TenantManualSaleEligibilityService,
    BillingProspectingQuotaService,
    {
      provide: BILLING_REPOSITORY,
      useClass: PrismaBillingRepository,
    },
    {
      provide: IGetUsageUseCase,
      useClass: GetUsageUseCase,
    },
    {
      provide: IRecordUsageUseCase,
      useClass: RecordUsageUseCase,
    },
    {
      provide: ICheckQuotaUseCase,
      useClass: CheckQuotaUseCase,
    },
    {
      provide: IChangeSubscriptionPlanUseCase,
      useClass: ChangeSubscriptionPlanUseCase,
    },
    {
      provide: ICancelSubscriptionUseCase,
      useClass: CancelSubscriptionUseCase,
    },
    {
      provide: IListBillingPlansUseCase,
      useClass: ListBillingPlansUseCase,
    },
    {
      provide: IGetSubscriptionCatalogUseCase,
      useClass: GetSubscriptionCatalogUseCase,
    },
    {
      provide: IReplaceSubscriptionModulesUseCase,
      useClass: ReplaceSubscriptionModulesUseCase,
    },
    {
      provide: IPurchaseAddonPackageUseCase,
      useClass: PurchaseAddonPackageUseCase,
    },
    {
      provide: ICancelAddonPackageUseCase,
      useClass: CancelAddonPackageUseCase,
    },
    {
      provide: IGetAddonPackageInfoUseCase,
      useClass: GetAddonPackageInfoUseCase,
    },
  ],
  exports: [
    BILLING_REPOSITORY,
    IGetUsageUseCase,
    IRecordUsageUseCase,
    ICheckQuotaUseCase,
    IChangeSubscriptionPlanUseCase,
    ICancelSubscriptionUseCase,
    IListBillingPlansUseCase,
    IGetSubscriptionCatalogUseCase,
    IReplaceSubscriptionModulesUseCase,
    IPurchaseAddonPackageUseCase,
    ICancelAddonPackageUseCase,
    IGetAddonPackageInfoUseCase,
    BillingProspectingQuotaService,
    TenantModuleAccessService,
    TenantManualSaleEligibilityService,
  ],
})
export class BillingModule {}
