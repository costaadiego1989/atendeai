import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AsaasAdapter } from './infrastructure/acl/AsaasAdapter';
import { IPAYMENT_GATEWAY } from './domain/ports/IPaymentGateway';
import { PaymentService } from './application/services/PaymentService';
import { PaymentWebhookSalesProjectionService } from './application/services/PaymentWebhookSalesProjectionService';
import { PaymentWebhookSchedulingProjectionService } from './application/services/PaymentWebhookSchedulingProjectionService';
import { TrialPaymentProjectionService } from './application/services/TrialPaymentProjectionService';
import { ProcessWebhookUseCase } from './application/use-cases/ProcessWebhookUseCase';
import { PaymentController } from './presentation/controllers/PaymentController';
import { PrismaPaymentWebhookReceiptStore } from './infrastructure/persistence/PrismaPaymentWebhookReceiptStore';
import { PaymentManagementController } from './presentation/controllers/PaymentManagementController';
import { BootstrapTenantFinancialAccountUseCase } from './application/use-cases/BootstrapTenantFinancialAccountUseCase';
import { GetTenantFinancialAccountStatusUseCase } from './application/use-cases/GetTenantFinancialAccountStatusUseCase';
import { InitiateTrialSubscriptionUseCase } from './application/use-cases/InitiateTrialSubscriptionUseCase';
import { TrialExpirationProcessor } from './application/workers/TrialExpirationProcessor';
import { TrialSignupController } from './presentation/controllers/TrialSignupController';
import { AuthModule } from '@modules/auth/auth.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { PrismaTenantFinancialAccountRepository } from './infrastructure/persistence/PrismaTenantFinancialAccountRepository';
import { PrismaContactFinancialProfileRepository } from './infrastructure/persistence/PrismaContactFinancialProfileRepository';
import { BullModule } from '@nestjs/bullmq';
import { TENANT_FINANCIAL_ACCOUNT_REPOSITORY } from './domain/repositories/ITenantFinancialAccountRepository';
import { CONTACT_FINANCIAL_PROFILE_REPOSITORY } from './domain/repositories/IContactFinancialProfileRepository';
import { BILLING_REPOSITORY } from '@modules/billing/domain/repositories/IBillingRepository';
import { PrismaBillingRepository } from '@modules/billing/infrastructure/persistence/repositories/PrismaBillingRepository';
import { PAYMENT_FACADE } from './application/facades/IPaymentFacade';
import { PaymentFacadeAdapter } from './infrastructure/adapters/PaymentFacadeAdapter';

@Global()
@Module({
  imports: [
    ConfigModule,
    TenantModule,
    AuthModule,
    BullModule.registerQueue({ name: 'BILLING_QUEUE' }),
  ],
  controllers: [
    PaymentController,
    PaymentManagementController,
    TrialSignupController,
  ],
  providers: [
    {
      provide: IPAYMENT_GATEWAY,
      useClass: AsaasAdapter,
    },
    {
      provide: TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
      useClass: PrismaTenantFinancialAccountRepository,
    },
    {
      provide: CONTACT_FINANCIAL_PROFILE_REPOSITORY,
      useClass: PrismaContactFinancialProfileRepository,
    },
    {
      provide: BILLING_REPOSITORY,
      useClass: PrismaBillingRepository,
    },
    PaymentService,
    {
      provide: PAYMENT_FACADE,
      useClass: PaymentFacadeAdapter,
    },
    PaymentWebhookSchedulingProjectionService,
    PaymentWebhookSalesProjectionService,
    TrialPaymentProjectionService,
    ProcessWebhookUseCase,
    BootstrapTenantFinancialAccountUseCase,
    GetTenantFinancialAccountStatusUseCase,
    InitiateTrialSubscriptionUseCase,
    PrismaPaymentWebhookReceiptStore,
  ],
  exports: [
    IPAYMENT_GATEWAY,
    PaymentService,
    PAYMENT_FACADE,
    ProcessWebhookUseCase,
    TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
    CONTACT_FINANCIAL_PROFILE_REPOSITORY,
    BootstrapTenantFinancialAccountUseCase,
    GetTenantFinancialAccountStatusUseCase,
  ],
})
export class PaymentModule {}
