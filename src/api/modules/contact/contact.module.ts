import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaContactRepository } from './infrastructure/persistence/repositories/PrismaContactRepository';
import { CONTACT_REPOSITORY } from '@modules/contact/domain/repositories/IContactRepository';
import { CreateContactUseCase } from './application/use-cases/CreateContactUseCase';
import { ICreateContactUseCase } from './application/use-cases/interfaces/ICreateContactUseCase';
import { ChangeContactStageUseCase } from './application/use-cases/ChangeContactStageUseCase';
import { IChangeContactStageUseCase } from './application/use-cases/interfaces/IChangeContactStageUseCase';
import { ListContactsUseCase } from './application/use-cases/ListContactsUseCase';
import { IListContactsUseCase } from './application/use-cases/interfaces/IListContactsUseCase';
import { IdentifyContactUseCase } from './application/use-cases/IdentifyContactUseCase';
import { IDENTIFY_CONTACT_USE_CASE } from './application/use-cases/interfaces/IIdentifyContactUseCase';
import { GetContactUseCase } from './application/use-cases/GetContactUseCase';
import { IGetContactUseCase } from './application/use-cases/interfaces/IGetContactUseCase';
import { UpdateContactUseCase } from './application/use-cases/UpdateContactUseCase';
import { IUpdateContactUseCase } from './application/use-cases/interfaces/IUpdateContactUseCase';
import { DeleteContactUseCase } from './application/use-cases/DeleteContactUseCase';
import { IDeleteContactUseCase } from './application/use-cases/interfaces/IDeleteContactUseCase';
import { IGetContactTimelineUseCase } from './application/use-cases/interfaces/IGetContactTimelineUseCase';
import { GetContactTimelineUseCase } from './application/use-cases/GetContactTimelineUseCase';
import { IImportContactsListUseCase } from './application/use-cases/interfaces/IImportContactsListUseCase';
import { ImportContactsListUseCase } from './application/use-cases/ImportContactsListUseCase';
import { IGenerateContactsReportUseCase } from './application/use-cases/interfaces/IGenerateContactsReportUseCase';
import { GenerateContactsReportUseCase } from './application/use-cases/GenerateContactsReportUseCase';
import {
  ContactFacade,
  CONTACT_FACADE,
} from './application/facades/ContactFacade';
import { ContactController } from './presentation/controllers/ContactController';
import { AuthModule } from '../auth/auth.module';
import { CONTACT_TIMELINE_REPOSITORY } from './application/ports/IContactTimelineRepository';
import { PrismaContactTimelineRepository } from './infrastructure/persistence/repositories/PrismaContactTimelineRepository';
import { ContactAsyncJobsService } from './infrastructure/persistence/repositories/ContactAsyncJobsService';
import { ContactDomainEventPublisher } from './application/services/ContactDomainEventPublisher';
import { ContactImportParser } from './application/services/ContactImportParser';
import { ContactReportCsvBuilder } from './application/services/ContactReportCsvBuilder';
import { ContactAsyncJobProcessor } from './infrastructure/queue/ContactAsyncJobProcessor';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'contact-async-jobs',
    }),
  ],
  controllers: [ContactController],
  providers: [
    {
      provide: CONTACT_REPOSITORY,
      useClass: PrismaContactRepository,
    },
    {
      provide: ICreateContactUseCase,
      useClass: CreateContactUseCase,
    },
    {
      provide: IChangeContactStageUseCase,
      useClass: ChangeContactStageUseCase,
    },
    {
      provide: IListContactsUseCase,
      useClass: ListContactsUseCase,
    },
    {
      provide: IDENTIFY_CONTACT_USE_CASE,
      useClass: IdentifyContactUseCase,
    },
    {
      provide: IGetContactUseCase,
      useClass: GetContactUseCase,
    },
    {
      provide: IUpdateContactUseCase,
      useClass: UpdateContactUseCase,
    },
    {
      provide: IDeleteContactUseCase,
      useClass: DeleteContactUseCase,
    },
    {
      provide: CONTACT_TIMELINE_REPOSITORY,
      useClass: PrismaContactTimelineRepository,
    },
    {
      provide: IGetContactTimelineUseCase,
      useClass: GetContactTimelineUseCase,
    },
    {
      provide: IImportContactsListUseCase,
      useClass: ImportContactsListUseCase,
    },
    {
      provide: IGenerateContactsReportUseCase,
      useClass: GenerateContactsReportUseCase,
    },
    {
      provide: CONTACT_FACADE,
      useClass: ContactFacade,
    },
    ContactImportParser,
    ContactReportCsvBuilder,
    ContactAsyncJobsService,
    ContactAsyncJobProcessor,
    ContactDomainEventPublisher,
  ],
  exports: [
    CONTACT_REPOSITORY,
    CONTACT_FACADE,
    IGetContactUseCase,
    IUpdateContactUseCase,
    IDeleteContactUseCase,
  ],
})
export class ContactModule {}
