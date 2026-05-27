import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaTenantRepository } from './infrastructure/persistence/repositories/PrismaTenantRepository';
import { TENANT_REPOSITORY } from './domain/repositories/ITenantRepository';
import { CreateTenantUseCase } from './application/use-cases/CreateTenantUseCase';
import { ICreateTenantUseCase } from './application/use-cases/interfaces/ICreateTenantUseCase';
import { ConfigureWhatsAppUseCase } from './application/use-cases/ConfigureWhatsAppUseCase';
import { IConfigureWhatsAppUseCase } from './application/use-cases/interfaces/IConfigureWhatsAppUseCase';
import { ConfigureInstagramUseCase } from './application/use-cases/ConfigureInstagramUseCase';
import { IConfigureInstagramUseCase } from './application/use-cases/interfaces/IConfigureInstagramUseCase';
import { ConfigureAIUseCase } from './application/use-cases/ConfigureAIUseCase';
import { IConfigureAIUseCase } from './application/use-cases/interfaces/IConfigureAIUseCase';
import { UpdateBusinessDataUseCase } from './application/use-cases/UpdateBusinessDataUseCase';
import { IUpdateBusinessDataUseCase } from './application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { AddPromotionUseCase } from './application/use-cases/AddPromotionUseCase';
import { UpdatePromotionUseCase } from './application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from './application/use-cases/DeletePromotionUseCase';
import { CreateExternalTenantUseCase } from './application/use-cases/CreateExternalTenantUseCase';
import { GetTenantDetailsUseCase } from './application/use-cases/GetTenantDetailsUseCase';
import { TenantController } from './presentation/controllers/TenantController';
import { TenantWhatsAppController } from './presentation/controllers/TenantWhatsAppController';
import { TenantBranchController } from './presentation/controllers/TenantBranchController';
import { IntegrationController } from './presentation/controllers/IntegrationController';
import { UserController } from './presentation/controllers/UserController';
import { InstagramMetaConnectionController } from './presentation/controllers/InstagramMetaConnectionController';
import { MetaDataDeletionController } from './presentation/controllers/MetaDataDeletionController';
import { AuthModule } from '../auth/auth.module';
import { BcryptPasswordHasher } from '@shared/infrastructure/services/BcryptPasswordHasher';
import { PASSWORD_HASHER } from '@shared/application/ports/IPasswordHasher';
import {
  ITenantFacade,
  TENANT_FACADE,
} from './application/facades/ITenantFacade';
import { TenantFacade } from './application/facades/TenantFacade';
import { USER_REPOSITORY } from './domain/repositories/IUserRepository';
import { PrismaUserRepository } from './infrastructure/persistence/repositories/PrismaUserRepository';
import { CreateUserUseCase } from './application/use-cases/users/CreateUserUseCase';
import { UpdateUserUseCase } from './application/use-cases/users/UpdateUserUseCase';
import { DeleteUserUseCase } from './application/use-cases/users/DeleteUserUseCase';
import { GetUsersByTenantUseCase } from './application/use-cases/users/GetUsersByTenantUseCase';
import { TenantDomainEventPublisher } from './application/services/TenantDomainEventPublisher';
import { UserDomainEventPublisher } from './application/services/UserDomainEventPublisher';
import { IGetTenantDetailsUseCase } from './application/use-cases/interfaces/IGetTenantDetailsUseCase';
import { IGetTenantSettingsUseCase } from './application/use-cases/interfaces/IGetTenantSettingsUseCase';
import { GetTenantSettingsUseCase } from './application/use-cases/GetTenantSettingsUseCase';
import { IGetTenantProfileSectionsUseCase } from './application/use-cases/interfaces/IGetTenantProfileSectionsUseCase';
import { GetTenantProfileSectionsUseCase } from './application/use-cases/GetTenantProfileSectionsUseCase';
import { IGetTenantOnboardingChecklistUseCase } from './application/use-cases/interfaces/IGetTenantOnboardingChecklistUseCase';
import { GetTenantOnboardingChecklistUseCase } from './application/use-cases/GetTenantOnboardingChecklistUseCase';
import { TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER } from './application/ports/ITeamMemberCredentialsEmailSender';
import { ConsoleTeamMemberCredentialsEmailSender } from './infrastructure/services/ConsoleTeamMemberCredentialsEmailSender';
import { BrevoTeamMemberCredentialsEmailSender } from './infrastructure/services/BrevoTeamMemberCredentialsEmailSender';
import { BubbleWhatsConfigurationStrategy } from './application/strategies/whatsapp/BubbleWhatsConfigurationStrategy';
import { Dialog360ConfigurationStrategy } from './application/strategies/whatsapp/Dialog360ConfigurationStrategy';
import { WhatsAppConfigurationStrategyRegistry } from './application/strategies/whatsapp/WhatsAppConfigurationStrategyRegistry';
import { Dialog360ManagementAcl } from './infrastructure/acl/Dialog360ManagementAcl';
import { TwilioManagementAcl } from './infrastructure/acl/TwilioManagementAcl';
import { GetWhatsAppConnectionUseCase } from './application/use-cases/GetWhatsAppConnectionUseCase';
import { RegisterTwilioWhatsAppSenderUseCase } from './application/use-cases/RegisterTwilioWhatsAppSenderUseCase';
import { VerifyTwilioWhatsAppSenderUseCase } from './application/use-cases/VerifyTwilioWhatsAppSenderUseCase';
import { RefreshTwilioWhatsAppSenderStatusUseCase } from './application/use-cases/RefreshTwilioWhatsAppSenderStatusUseCase';
import { OnboardTrialTenantUseCase } from './application/use-cases/OnboardTrialTenantUseCase';
import { TrialPaymentConfirmedHandler } from './application/handlers/TrialPaymentConfirmedHandler';
import { UpdateTenantPlanStatusUseCase } from './application/use-cases/UpdateTenantPlanStatusUseCase';
import { TenantSubscriptionStatusHandler } from './application/handlers/TenantSubscriptionStatusHandler';
import { TENANT_AUDIT_LOG_REPOSITORY } from './domain/repositories/ITenantAuditLogRepository';
import { PrismaTenantAuditLogRepository } from './infrastructure/persistence/repositories/PrismaTenantAuditLogRepository';
import { TenantAuditService } from './application/services/TenantAuditService';
import { TenantSchemaBootstrapService } from './application/services/TenantSchemaBootstrapService';
import { CreateTenantBranchUseCase } from './application/use-cases/CreateTenantBranchUseCase';
import { UpdateTenantBranchUseCase } from './application/use-cases/UpdateTenantBranchUseCase';
import { DeleteTenantBranchUseCase } from './application/use-cases/DeleteTenantBranchUseCase';
import { MetaInstagramOAuthService } from './infrastructure/services/MetaInstagramOAuthService';
import { MetaInstagramOAuthStateService } from './infrastructure/services/MetaInstagramOAuthStateService';
import { StartMetaInstagramConnectionUseCase } from './application/use-cases/StartMetaInstagramConnectionUseCase';
import { CompleteMetaInstagramConnectionUseCase } from './application/use-cases/CompleteMetaInstagramConnectionUseCase';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';
import { TenantTwilioAccountService } from './application/services/TenantTwilioAccountService';
import { TENANT_TWILIO_ACCOUNT_REPOSITORY } from './domain/repositories/ITenantTwilioAccountRepository';
import { PrismaTenantTwilioAccountRepository } from './infrastructure/persistence/repositories/PrismaTenantTwilioAccountRepository';
import { TenantTwilioProvisioningHandler } from './application/handlers/TenantTwilioProvisioningHandler';
import { TenantPDFResumeRepository } from './infrastructure/persistence/repositories/TenantPDFResumeRepository';
import { TENANT_PDF_RESUME_REPOSITORY } from './domain/repositories/ITenantPDFResumeRepository';
import {
  TenantPDFResumeFacade,
  TENANT_PDF_RESUME_QUERY_PORT,
} from './application/facades/TenantPDFResumeFacade';
import { UpsertTenantPDFResumeUseCase } from './application/use-cases/UpsertTenantPDFResumeUseCase';
import { ListTenantPDFResumesUseCase } from './application/use-cases/ListTenantPDFResumesUseCase';
import { UploadDocumentUseCase } from './application/use-cases/UploadDocumentUseCase';
import { DeleteDocumentUseCase } from './application/use-cases/DeleteDocumentUseCase';
import { DocumentsController } from './presentation/controllers/DocumentsController';
import { DOCUMENT_CHUNK_WRITER } from './application/ports/IDocumentChunkWriter';
import { PrismaDocumentChunkCounter } from './infrastructure/persistence/repositories/PrismaDocumentChunkCounter';

const TENANT_REPOSITORY_PROVIDERS = [
  {
    provide: TENANT_REPOSITORY,
    useClass: PrismaTenantRepository,
  },
  {
    provide: PASSWORD_HASHER,
    useClass: BcryptPasswordHasher,
  },
  {
    provide: USER_REPOSITORY,
    useClass: PrismaUserRepository,
  },
  {
    provide: TENANT_AUDIT_LOG_REPOSITORY,
    useClass: PrismaTenantAuditLogRepository,
  },
  {
    provide: DOCUMENT_CHUNK_WRITER,
    useClass: PrismaDocumentChunkCounter,
  },
  TenantPDFResumeRepository,
  {
    provide: TENANT_PDF_RESUME_REPOSITORY,
    useExisting: TenantPDFResumeRepository,
  },
  {
    provide: TENANT_PDF_RESUME_QUERY_PORT,
    useClass: TenantPDFResumeFacade,
  },
];

const TENANT_USE_CASE_PROVIDERS = [
  {
    provide: ICreateTenantUseCase,
    useClass: CreateTenantUseCase,
  },
  {
    provide: IConfigureWhatsAppUseCase,
    useClass: ConfigureWhatsAppUseCase,
  },
  {
    provide: IConfigureInstagramUseCase,
    useClass: ConfigureInstagramUseCase,
  },
  {
    provide: IConfigureAIUseCase,
    useClass: ConfigureAIUseCase,
  },
  {
    provide: IUpdateBusinessDataUseCase,
    useClass: UpdateBusinessDataUseCase,
  },
  {
    provide: IGetTenantDetailsUseCase,
    useClass: GetTenantDetailsUseCase,
  },
  {
    provide: IGetTenantSettingsUseCase,
    useClass: GetTenantSettingsUseCase,
  },
  {
    provide: IGetTenantProfileSectionsUseCase,
    useClass: GetTenantProfileSectionsUseCase,
  },
  {
    provide: IGetTenantOnboardingChecklistUseCase,
    useClass: GetTenantOnboardingChecklistUseCase,
  },
  {
    provide: TENANT_FACADE,
    useClass: TenantFacade,
  },
  AddPromotionUseCase,
  UpdatePromotionUseCase,
  DeletePromotionUseCase,
  CreateTenantBranchUseCase,
  UpdateTenantBranchUseCase,
  DeleteTenantBranchUseCase,
  CreateExternalTenantUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  GetUsersByTenantUseCase,
  GetWhatsAppConnectionUseCase,
  RegisterTwilioWhatsAppSenderUseCase,
  VerifyTwilioWhatsAppSenderUseCase,
  RefreshTwilioWhatsAppSenderStatusUseCase,
  OnboardTrialTenantUseCase,
  UpdateTenantPlanStatusUseCase,
  UpsertTenantPDFResumeUseCase,
  ListTenantPDFResumesUseCase,
  UploadDocumentUseCase,
  DeleteDocumentUseCase,
];

const TENANT_INTEGRATION_PROVIDERS = [
  {
    provide: TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER,
    inject: [ConfigService, ConsoleTeamMemberCredentialsEmailSender],
    useFactory: (
      configService: ConfigService,
      consoleTeamMemberCredentialsEmailSender: ConsoleTeamMemberCredentialsEmailSender,
    ) => {
      const hasBrevoCredentials =
        !!configService.get<string>('BREVO_SMTP_LOGIN') &&
        !!configService.get<string>('BREVO_SMTP_KEY');

      return hasBrevoCredentials
        ? new BrevoTeamMemberCredentialsEmailSender(configService)
        : consoleTeamMemberCredentialsEmailSender;
    },
  },
  StartMetaInstagramConnectionUseCase,
  CompleteMetaInstagramConnectionUseCase,
  BubbleWhatsConfigurationStrategy,
  Dialog360ConfigurationStrategy,
  WhatsAppConfigurationStrategyRegistry,
  Dialog360ManagementAcl,
  TwilioManagementAcl,
  MetaInstagramOAuthService,
  MetaInstagramOAuthStateService,
  ConsoleTeamMemberCredentialsEmailSender,
];

const TENANT_DOMAIN_EVENT_PROVIDERS = [
  TenantAuditService,
  TenantSchemaBootstrapService,
  TenantDomainEventPublisher,
  UserDomainEventPublisher,
  TrialPaymentConfirmedHandler,
  TenantSubscriptionStatusHandler,
  TenantTwilioProvisioningHandler,
];

const TENANT_BILLING_PROVIDERS = [
  TenantModuleAccessService,
  TenantBillingCapacityService,
  TenantTwilioAccountService,
  {
    provide: TENANT_TWILIO_ACCOUNT_REPOSITORY,
    useClass: PrismaTenantTwilioAccountRepository,
  },
];

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    BullModule.registerQueue({ name: 'pdf-processing' }),
  ],
  controllers: [
    TenantController,
    TenantWhatsAppController,
    TenantBranchController,
    IntegrationController,
    UserController,
    InstagramMetaConnectionController,
    MetaDataDeletionController,
    DocumentsController,
  ],
  providers: [
    ...TENANT_REPOSITORY_PROVIDERS,
    ...TENANT_USE_CASE_PROVIDERS,
    ...TENANT_INTEGRATION_PROVIDERS,
    ...TENANT_DOMAIN_EVENT_PROVIDERS,
    ...TENANT_BILLING_PROVIDERS,
  ],
  exports: [
    TENANT_REPOSITORY,
    USER_REPOSITORY,
    TENANT_FACADE,
    OnboardTrialTenantUseCase,
    ICreateTenantUseCase,
    TenantPDFResumeRepository,
    TENANT_PDF_RESUME_QUERY_PORT,
  ],
})
export class TenantModule {}
