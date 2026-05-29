import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { ContactModule } from '../contact/contact.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PaymentModule } from '../payment/payment.module';
import { RecoveryMessageReceivedHandler } from './application/handlers/RecoveryMessageReceivedHandler';
import { RECOVERY_GUIDANCE_GENERATOR } from './application/ports/IRecoveryGuidanceGenerator';
import { RECOVERY_OUTREACH_GENERATOR } from './application/ports/IRecoveryOutreachGenerator';
import { GenerateRecoveryPaymentLinkUseCase } from './application/use-cases/GenerateRecoveryPaymentLinkUseCase';
import { GetRecoveryCaseUseCase } from './application/use-cases/GetRecoveryCaseUseCase';
import { RegenerateRecoveryGuidanceUseCase } from './application/use-cases/RegenerateRecoveryGuidanceUseCase';
import { SendRecoveryGuidanceUseCase } from './application/use-cases/SendRecoveryGuidanceUseCase';
import { StartRecoveryReportExportUseCase } from './application/use-cases/StartRecoveryReportExportUseCase';
import { RecoveryPaymentEventHandler } from './application/handlers/RecoveryPaymentEventHandler';
import { RecoveryRecurringChargeDueHandler } from './application/handlers/RecoveryRecurringChargeDueHandler';
import { RecoveryController } from './presentation/controllers/RecoveryController';
import { RecoveryRecurringChargeScheduler } from './application/schedulers/RecoveryRecurringChargeScheduler';
import { CreateRecoveryCaseUseCase } from './application/use-cases/CreateRecoveryCaseUseCase';
import { ListRecoveryCasesUseCase } from './application/use-cases/ListRecoveryCasesUseCase';
import { RegisterRecoveryReplyUseCase } from './application/use-cases/RegisterRecoveryReplyUseCase';
import { RecoveryReplyPolicy } from './application/services/RecoveryReplyPolicy';
import { TriggerRecoveryOutreachUseCase } from './application/use-cases/TriggerRecoveryOutreachUseCase';
import { UpdateRecoveryCaseStatusUseCase } from './application/use-cases/UpdateRecoveryCaseStatusUseCase';
import { AIRecoveryOutreachGenerator } from './infrastructure/adapters/AIRecoveryOutreachGenerator';
import { RECOVERY_REPOSITORY } from './domain/ports/IRecoveryRepository';
import { AIRecoveryGuidanceGenerator } from './infrastructure/adapters/AIRecoveryGuidanceGenerator';
import { PrismaRecoveryRepository } from './infrastructure/persistence/repositories/PrismaRecoveryRepository';
import { RecoverySchemaBootstrapService } from './application/services/RecoverySchemaBootstrapService';
import { RecoveryCaseMessagingService } from './application/services/RecoveryCaseMessagingService';
import { GenerateRecoveryReportUseCase } from './application/use-cases/GenerateRecoveryReportUseCase';
import { RecoveryAsyncJobsService } from './application/services/RecoveryAsyncJobsService';
import { RecoveryReportCsvBuilder } from './application/services/RecoveryReportCsvBuilder';
import { RecoveryAsyncJobProcessor } from './infrastructure/queue/RecoveryAsyncJobProcessor';
import { ScheduleRecoveryRecurringChargeUseCase } from './application/use-cases/ScheduleRecoveryRecurringChargeUseCase';
import { ListRecoveryRecurringChargesUseCase } from './application/use-cases/ListRecoveryRecurringChargesUseCase';
import { CancelRecoveryRecurringChargeUseCase } from './application/use-cases/CancelRecoveryRecurringChargeUseCase';
import { ProcessRecoveryRecurringChargeUseCase } from './application/use-cases/ProcessRecoveryRecurringChargeUseCase';
import { RECOVERY_RECURRING_CHARGE_REPOSITORY } from './domain/ports/IRecoveryRecurringChargeRepository';
import { PrismaRecoveryRecurringChargeRepository } from './infrastructure/persistence/repositories/PrismaRecoveryRecurringChargeRepository';
import { RECOVERY_PLAYBOOK_REPOSITORY } from './domain/ports/IRecoveryPlaybookRepository';
import { PrismaRecoveryPlaybookRepository } from './infrastructure/persistence/repositories/PrismaRecoveryPlaybookRepository';
import { ListRecoveryPlaybooksUseCase } from './application/use-cases/ListRecoveryPlaybooksUseCase';
import { SeedDefaultRecoveryPlaybookUseCase } from './application/use-cases/SeedDefaultRecoveryPlaybookUseCase';
import { CreateRecoveryPlaybookUseCase } from './application/use-cases/CreateRecoveryPlaybookUseCase';
import { ActivateRecoveryPlaybookUseCase } from './application/use-cases/ActivateRecoveryPlaybookUseCase';

@Module({
  imports: [
    AuthModule,
    ContactModule,
    MessagingModule,
    AIModule,
    PaymentModule,
    BullModule.registerQueue({
      name: 'recovery-async-jobs',
    }),
  ],
  controllers: [RecoveryController],
  providers: [
    CreateRecoveryCaseUseCase,
    GenerateRecoveryReportUseCase,
    GenerateRecoveryPaymentLinkUseCase,
    GetRecoveryCaseUseCase,
    ListRecoveryCasesUseCase,
    RegenerateRecoveryGuidanceUseCase,
    ScheduleRecoveryRecurringChargeUseCase,
    ListRecoveryRecurringChargesUseCase,
    CancelRecoveryRecurringChargeUseCase,
    ProcessRecoveryRecurringChargeUseCase,
    SendRecoveryGuidanceUseCase,
    StartRecoveryReportExportUseCase,
    RegisterRecoveryReplyUseCase,
    RecoveryCaseMessagingService,
    RecoveryReplyPolicy,
    RecoverySchemaBootstrapService,
    RecoveryAsyncJobsService,
    RecoveryReportCsvBuilder,
    RecoveryAsyncJobProcessor,
    RecoveryRecurringChargeScheduler,
    TriggerRecoveryOutreachUseCase,
    ListRecoveryPlaybooksUseCase,
    SeedDefaultRecoveryPlaybookUseCase,
    CreateRecoveryPlaybookUseCase,
    ActivateRecoveryPlaybookUseCase,
    UpdateRecoveryCaseStatusUseCase,
    RecoveryMessageReceivedHandler,
    RecoveryPaymentEventHandler,
    RecoveryRecurringChargeDueHandler,
    {
      provide: RECOVERY_GUIDANCE_GENERATOR,
      useClass: AIRecoveryGuidanceGenerator,
    },
    {
      provide: RECOVERY_OUTREACH_GENERATOR,
      useClass: AIRecoveryOutreachGenerator,
    },
    {
      provide: RECOVERY_REPOSITORY,
      useClass: PrismaRecoveryRepository,
    },
    {
      provide: RECOVERY_RECURRING_CHARGE_REPOSITORY,
      useClass: PrismaRecoveryRecurringChargeRepository,
    },
    {
      provide: RECOVERY_PLAYBOOK_REPOSITORY,
      useClass: PrismaRecoveryPlaybookRepository,
    },
  ],
  exports: [
    CreateRecoveryCaseUseCase,
    GenerateRecoveryReportUseCase,
    GenerateRecoveryPaymentLinkUseCase,
    GetRecoveryCaseUseCase,
    ListRecoveryCasesUseCase,
    RegenerateRecoveryGuidanceUseCase,
    SendRecoveryGuidanceUseCase,
    TriggerRecoveryOutreachUseCase,
    UpdateRecoveryCaseStatusUseCase,
  ],
})
export class RecoveryModule {}
