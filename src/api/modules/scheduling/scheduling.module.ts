import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulingController } from './presentation/controllers/SchedulingController';
import { CreateSchedulingProfessionalUseCase } from './application/use-cases/CreateSchedulingProfessionalUseCase';
import { ListSchedulingProfessionalsUseCase } from './application/use-cases/ListSchedulingProfessionalsUseCase';
import { CreateSchedulingCategoryUseCase } from './application/use-cases/CreateSchedulingCategoryUseCase';
import { ListSchedulingCategoriesUseCase } from './application/use-cases/ListSchedulingCategoriesUseCase';
import { AssignProfessionalCategoriesUseCase } from './application/use-cases/AssignProfessionalCategoriesUseCase';
import { ListCategoryProfessionalsUseCase } from './application/use-cases/ListCategoryProfessionalsUseCase';
import { GetCategoryAvailabilityUseCase } from './application/use-cases/GetCategoryAvailabilityUseCase';
import {
  ISchedulingFacade,
  SCHEDULING_FACADE,
  SchedulingFacade,
} from './application/facades/SchedulingFacade';
import { SetProfessionalAvailabilityUseCase } from './application/use-cases/SetProfessionalAvailabilityUseCase';
import { GetProfessionalAvailabilityUseCase } from './application/use-cases/GetProfessionalAvailabilityUseCase';
import { ReserveProfessionalSlotUseCase } from './application/use-cases/ReserveProfessionalSlotUseCase';
import { UpdateAvailabilitySlotUseCase } from './application/use-cases/UpdateAvailabilitySlotUseCase';
import { GenerateSchedulingPaymentLinkUseCase } from './application/use-cases/GenerateSchedulingPaymentLinkUseCase';
import { RescheduleSchedulingReservationUseCase } from './application/use-cases/RescheduleSchedulingReservationUseCase';
import { SchedulingPaymentEventHandler } from './application/handlers/SchedulingPaymentEventHandler';
import { ExpirePendingSchedulingReservationUseCase } from './application/use-cases/ExpirePendingSchedulingReservationUseCase';
import { RedisSchedulingStore } from './infrastructure/persistence/RedisSchedulingStore';
import { SCHEDULING_STORE } from './domain/ports/ISchedulingStore';
import { AVAILABILITY_STORE } from './domain/ports/IAvailabilityStore';
import { RESERVATION_STORE } from './domain/ports/IReservationStore';
import { PAYMENT_STATUS_STORE } from './domain/ports/IPaymentStatusStore';
import { BullMQSchedulingReservationExpirationQueue } from './infrastructure/queue/BullMQSchedulingReservationExpirationQueue';
import {
  ISchedulingReservationExpirationQueue,
  SCHEDULING_RESERVATION_EXPIRATION_QUEUE,
} from './domain/ports/ISchedulingReservationExpirationQueue';
import { AuthModule } from '../auth/auth.module';
import { ContactModule } from '../contact/contact.module';
import { PaymentModule } from '../payment/payment.module';
import { MessagingModule } from '../messaging/messaging.module';
import { SchedulingGoogleCalendarController } from './presentation/controllers/SchedulingGoogleCalendarController';
import { SchedulingGoogleCalendarSchemaBootstrapService } from './application/services/SchedulingGoogleCalendarSchemaBootstrapService';
import { GoogleCalendarOAuthService } from './infrastructure/services/GoogleCalendarOAuthService';
import { GoogleCalendarOAuthStateService } from './infrastructure/services/GoogleCalendarOAuthStateService';
import { SchedulingGoogleCalendarSyncService } from './application/services/SchedulingGoogleCalendarSyncService';
import { StartGoogleCalendarConnectionUseCase } from './application/use-cases/StartGoogleCalendarConnectionUseCase';
import { CompleteGoogleCalendarConnectionUseCase } from './application/use-cases/CompleteGoogleCalendarConnectionUseCase';
import { GetGoogleCalendarConnectionStatusUseCase } from './application/use-cases/GetGoogleCalendarConnectionStatusUseCase';
import { DisconnectGoogleCalendarConnectionUseCase } from './application/use-cases/DisconnectGoogleCalendarConnectionUseCase';
import { ListGoogleCalendarCalendarsUseCase } from './application/use-cases/ListGoogleCalendarCalendarsUseCase';
import { SelectGoogleCalendarUseCase } from './application/use-cases/SelectGoogleCalendarUseCase';
import { GenerateSchedulingReportUseCase } from './application/use-cases/GenerateSchedulingReportUseCase';
import { PrismaSchedulingGoogleCalendarConnectionRepository } from './infrastructure/persistence/PrismaSchedulingGoogleCalendarConnectionRepository';
import { PrismaSchedulingGoogleCalendarEventLinkRepository } from './infrastructure/persistence/PrismaSchedulingGoogleCalendarEventLinkRepository';
import { SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY } from './domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import { SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY } from './domain/ports/ISchedulingGoogleCalendarEventLinkRepository';
import { SchedulingReportCsvBuilder } from './application/services/SchedulingReportCsvBuilder';
import { SchedulingAsyncJobsService } from './application/services/SchedulingAsyncJobsService';
import { SchedulingAsyncJobProcessor } from './infrastructure/queue/SchedulingAsyncJobProcessor';
import { SchedulingReservationExpirationProcessor } from './infrastructure/queue/SchedulingReservationExpirationProcessor';
import { SchedulingRecurrenceDateService } from './application/services/SchedulingRecurrenceDateService';
import { ProcessSchedulingRecurringReservationUseCase } from './application/use-cases/ProcessSchedulingRecurringReservationUseCase';
import { CreateSchedulingRecurrenceUseCase } from './application/use-cases/CreateSchedulingRecurrenceUseCase';
import { ListSchedulingRecurrencesUseCase } from './application/use-cases/ListSchedulingRecurrencesUseCase';
import { CancelSchedulingRecurrenceUseCase } from './application/use-cases/CancelSchedulingRecurrenceUseCase';
import { DeleteSchedulingRecurrenceUseCase } from './application/use-cases/DeleteSchedulingRecurrenceUseCase';
import { SchedulingRecurringReservationDueHandler } from './application/handlers/SchedulingRecurringReservationDueHandler';
import { SchedulingRecurringReservationScheduler } from './application/schedulers/SchedulingRecurringReservationScheduler';
import { SCHEDULING_RECURRING_RESERVATION_REPOSITORY } from './domain/ports/ISchedulingRecurringReservationRepository';
import { PrismaSchedulingRecurringReservationRepository } from './infrastructure/persistence/PrismaSchedulingRecurringReservationRepository';
import { SchedulingReminderProcessor } from './infrastructure/queue/SchedulingReminderProcessor';
import { BullMQSchedulingReminderQueue } from './infrastructure/queue/BullMQSchedulingReminderQueue';
import { SCHEDULING_REMINDER_QUEUE } from './domain/ports/ISchedulingReminderQueue';
import { JoinSchedulingMeetingUseCase } from './application/use-cases/JoinSchedulingMeetingUseCase';

@Module({
  imports: [
    AuthModule,
    ContactModule,
    PaymentModule,
    MessagingModule,
    BullModule.registerQueue({
      name: 'scheduling-async-jobs',
    }),
    BullModule.registerQueue({
      name: 'scheduling-reminders',
    }),
  ],
  controllers: [SchedulingController, SchedulingGoogleCalendarController],
  providers: [
    CreateSchedulingProfessionalUseCase,
    ListSchedulingProfessionalsUseCase,
    CreateSchedulingCategoryUseCase,
    ListSchedulingCategoriesUseCase,
    AssignProfessionalCategoriesUseCase,
    ListCategoryProfessionalsUseCase,
    GetCategoryAvailabilityUseCase,
    SetProfessionalAvailabilityUseCase,
    GetProfessionalAvailabilityUseCase,
    ReserveProfessionalSlotUseCase,
    UpdateAvailabilitySlotUseCase,
    RescheduleSchedulingReservationUseCase,
    GenerateSchedulingPaymentLinkUseCase,
    GenerateSchedulingReportUseCase,
    ExpirePendingSchedulingReservationUseCase,
    SchedulingGoogleCalendarSchemaBootstrapService,
    GoogleCalendarOAuthService,
    GoogleCalendarOAuthStateService,
    SchedulingGoogleCalendarSyncService,
    StartGoogleCalendarConnectionUseCase,
    CompleteGoogleCalendarConnectionUseCase,
    GetGoogleCalendarConnectionStatusUseCase,
    DisconnectGoogleCalendarConnectionUseCase,
    ListGoogleCalendarCalendarsUseCase,
    SelectGoogleCalendarUseCase,
    SchedulingReportCsvBuilder,
    SchedulingAsyncJobsService,
    SchedulingRecurrenceDateService,
    SchedulingAsyncJobProcessor,
    SchedulingReservationExpirationProcessor,
    SchedulingReminderProcessor,
    ProcessSchedulingRecurringReservationUseCase,
    CreateSchedulingRecurrenceUseCase,
    ListSchedulingRecurrencesUseCase,
    CancelSchedulingRecurrenceUseCase,
    DeleteSchedulingRecurrenceUseCase,
    SchedulingRecurringReservationDueHandler,
    SchedulingRecurringReservationScheduler,
    JoinSchedulingMeetingUseCase,
    SchedulingPaymentEventHandler,
    {
      provide: SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
      useClass: PrismaSchedulingGoogleCalendarConnectionRepository,
    },
    {
      provide: SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY,
      useClass: PrismaSchedulingGoogleCalendarEventLinkRepository,
    },
    {
      provide: SCHEDULING_FACADE,
      useClass: SchedulingFacade,
    },
    RedisSchedulingStore,
    {
      provide: SCHEDULING_STORE,
      useExisting: RedisSchedulingStore,
    },
    {
      provide: AVAILABILITY_STORE,
      useExisting: RedisSchedulingStore,
    },
    {
      provide: RESERVATION_STORE,
      useExisting: RedisSchedulingStore,
    },
    {
      provide: PAYMENT_STATUS_STORE,
      useExisting: RedisSchedulingStore,
    },
    {
      provide: SCHEDULING_RESERVATION_EXPIRATION_QUEUE,
      useClass: BullMQSchedulingReservationExpirationQueue,
    },
    {
      provide: SCHEDULING_REMINDER_QUEUE,
      useClass: BullMQSchedulingReminderQueue,
    },
    {
      provide: SCHEDULING_RECURRING_RESERVATION_REPOSITORY,
      useClass: PrismaSchedulingRecurringReservationRepository,
    },
  ],
  exports: [
    CreateSchedulingProfessionalUseCase,
    ListSchedulingProfessionalsUseCase,
    CreateSchedulingCategoryUseCase,
    ListSchedulingCategoriesUseCase,
    AssignProfessionalCategoriesUseCase,
    ListCategoryProfessionalsUseCase,
    GetCategoryAvailabilityUseCase,
    SetProfessionalAvailabilityUseCase,
    GetProfessionalAvailabilityUseCase,
    ReserveProfessionalSlotUseCase,
    UpdateAvailabilitySlotUseCase,
    RescheduleSchedulingReservationUseCase,
    GenerateSchedulingPaymentLinkUseCase,
    GenerateSchedulingReportUseCase,
    ExpirePendingSchedulingReservationUseCase,
    SCHEDULING_FACADE,
  ],
})
export class SchedulingModule {
  constructor(
    private readonly _schedulingPaymentEventHandler: SchedulingPaymentEventHandler,
  ) {}
}
