import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AsaasAdapter } from './infrastructure/acl/AsaasAdapter';
import { IPAYMENT_GATEWAY } from './domain/ports/IPaymentGateway';
import { PaymentService } from './application/services/PaymentService';
import { ProcessWebhookUseCase } from './application/use-cases/ProcessWebhookUseCase';
import { PaymentController } from './presentation/controllers/PaymentController';
import { PrismaPaymentWebhookReceiptStore } from './infrastructure/persistence/PrismaPaymentWebhookReceiptStore';
import { PaymentManagementController } from './presentation/controllers/PaymentManagementController';
import { BootstrapTenantFinancialAccountUseCase } from './application/use-cases/BootstrapTenantFinancialAccountUseCase';
import { GetTenantFinancialAccountStatusUseCase } from './application/use-cases/GetTenantFinancialAccountStatusUseCase';
import { AuthModule } from '@modules/auth/auth.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { PrismaTenantFinancialAccountRepository } from './infrastructure/persistence/PrismaTenantFinancialAccountRepository';
import { PrismaContactFinancialProfileRepository } from './infrastructure/persistence/PrismaContactFinancialProfileRepository';
import { TENANT_FINANCIAL_ACCOUNT_REPOSITORY } from './domain/repositories/ITenantFinancialAccountRepository';
import { CONTACT_FINANCIAL_PROFILE_REPOSITORY } from './domain/repositories/IContactFinancialProfileRepository';
import { PAYMENT_FACADE } from './application/facades/IPaymentFacade';
import { PaymentFacadeAdapter } from './infrastructure/adapters/PaymentFacadeAdapter';

@Module({
  imports: [ConfigModule, TenantModule, AuthModule],
  controllers: [PaymentController, PaymentManagementController],
  providers: [
    { provide: IPAYMENT_GATEWAY, useClass: AsaasAdapter },
    {
      provide: TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
      useClass: PrismaTenantFinancialAccountRepository,
    },
    {
      provide: CONTACT_FINANCIAL_PROFILE_REPOSITORY,
      useClass: PrismaContactFinancialProfileRepository,
    },
    PaymentService,
    { provide: PAYMENT_FACADE, useClass: PaymentFacadeAdapter },
    ProcessWebhookUseCase,
    BootstrapTenantFinancialAccountUseCase,
    GetTenantFinancialAccountStatusUseCase,
    PrismaPaymentWebhookReceiptStore,
  ],
  exports: [
    PAYMENT_FACADE,
    TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
    CONTACT_FINANCIAL_PROFILE_REPOSITORY,
    ProcessWebhookUseCase,
    BootstrapTenantFinancialAccountUseCase,
    GetTenantFinancialAccountStatusUseCase,
  ],
})
export class PaymentModule {}
