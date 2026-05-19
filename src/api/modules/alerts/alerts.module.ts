import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { AlertReminderController } from './presentation/controllers/AlertReminderController';
import { CreateAlertReminderUseCase } from './application/use-cases/CreateAlertReminderUseCase';
import { ListAlertRemindersUseCase } from './application/use-cases/ListAlertRemindersUseCase';
import { UpdateAlertReminderUseCase } from './application/use-cases/UpdateAlertReminderUseCase';
import { DeleteAlertReminderUseCase } from './application/use-cases/DeleteAlertReminderUseCase';
import { ProcessAlertReminderUseCase } from './application/use-cases/ProcessAlertReminderUseCase';
import { OperationalAlertEventHandler } from './application/handlers/OperationalAlertEventHandler';
import { ALERT_REMINDER_REPOSITORY } from './domain/repositories/IAlertReminderRepository';
import { PrismaAlertReminderRepository } from './infrastructure/persistence/repositories/PrismaAlertReminderRepository';
import { ALERT_REMINDER_QUEUE } from './domain/ports/IAlertReminderQueue';
import { BullMQAlertReminderQueue } from './infrastructure/queue/BullMQAlertReminderQueue';
import { AlertReminderRuntimeConfig } from './application/services/AlertReminderRuntimeConfig';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    TenantModule,
    ContactModule,
    MessagingModule,
  ],
  controllers: [AlertReminderController],
  providers: [
    AlertReminderRuntimeConfig,
    CreateAlertReminderUseCase,
    ListAlertRemindersUseCase,
    UpdateAlertReminderUseCase,
    DeleteAlertReminderUseCase,
    ProcessAlertReminderUseCase,
    OperationalAlertEventHandler,
    {
      provide: ALERT_REMINDER_REPOSITORY,
      useClass: PrismaAlertReminderRepository,
    },
    {
      provide: ALERT_REMINDER_QUEUE,
      useClass: BullMQAlertReminderQueue,
    },
  ],
  exports: [
    CreateAlertReminderUseCase,
    ListAlertRemindersUseCase,
    UpdateAlertReminderUseCase,
    DeleteAlertReminderUseCase,
    ProcessAlertReminderUseCase,
    ALERT_REMINDER_REPOSITORY,
    ALERT_REMINDER_QUEUE,
  ],
})
export class AlertsModule {}
