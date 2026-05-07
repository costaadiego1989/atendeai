import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { CreateProposalService } from './application/services/implementations/CreateProposalService';
import { UpdateProposalService } from './application/services/implementations/UpdateProposalService';
import { DeleteProposalService } from './application/services/implementations/DeleteProposalService';
import { GetProposalService } from './application/services/implementations/GetProposalService';
import { ListProposalsService } from './application/services/implementations/ListProposalsService';
import { ScheduleProposalDeliveryService } from './application/services/implementations/ScheduleProposalDeliveryService';
import { SendProposalToConversationService } from './application/services/implementations/SendProposalToConversationService';
import { CreateProposalUseCase } from './application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from './application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from './application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from './application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from './application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from './application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from './application/use-cases/ScheduleProposalDeliveryUseCase';
import { SendProposalToConversationUseCase } from './application/use-cases/SendProposalToConversationUseCase';
import { ProposalController } from './presentation/controllers/ProposalController';
import { PublicProposalController } from './presentation/controllers/PublicProposalController';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '@shared/infrastructure/storage/StorageModule';
import { FILE_STORAGE_SERVICE, FileStorageService } from '@shared/domain/services/FileStorageService';
import { MessagingModule } from '../messaging/messaging.module';
import { MESSAGING_FACADE } from '@modules/messaging/application/facades/MessagingFacade';
import { ProposalAsyncJobProcessor } from './infrastructure/queue/ProposalAsyncJobProcessor';
import { PrismaProposalRepository } from './infrastructure/persistence/repositories/PrismaProposalRepository';
import { ProposalPublicLinkService } from './application/services/implementations/ProposalPublicLinkService';
import { PublicProposalService } from './application/services/implementations/PublicProposalService';
import { ContactModule } from '../contact/contact.module';
import { SalesModule } from '../sales/sales.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'proposal-delivery',
    }),
    StorageModule,
    MessagingModule,
    ContactModule,
    SalesModule,
    TenantModule,
  ],
  controllers: [ProposalController, PublicProposalController],
  providers: [
    PrismaService,
    ProposalAsyncJobProcessor,
    ProposalPublicLinkService,
    PublicProposalService,
    {
      provide: 'IProposalRepository',
      useClass: PrismaProposalRepository,
    },
    // Granular Services
    {
      provide: CreateProposalService,
      useFactory: (repo: PrismaProposalRepository) => new CreateProposalService(repo),
      inject: ['IProposalRepository'],
    },
    {
      provide: UpdateProposalService,
      useFactory: (repo: PrismaProposalRepository) => new UpdateProposalService(repo),
      inject: ['IProposalRepository'],
    },
    {
      provide: DeleteProposalService,
      useFactory: (repo: PrismaProposalRepository) => new DeleteProposalService(repo),
      inject: ['IProposalRepository'],
    },
    {
      provide: GetProposalService,
      useFactory: (repo: PrismaProposalRepository) => new GetProposalService(repo),
      inject: ['IProposalRepository'],
    },
    {
      provide: ListProposalsService,
      useFactory: (repo: PrismaProposalRepository) => new ListProposalsService(repo),
      inject: ['IProposalRepository'],
    },
    {
      provide: ScheduleProposalDeliveryService,
      useFactory: (repo: PrismaProposalRepository, queue: Queue) => 
        new ScheduleProposalDeliveryService(repo, queue),
      inject: ['IProposalRepository', 'BullQueue_proposal-delivery'],
    },
    {
      provide: SendProposalToConversationService,
      useFactory: (
        repo: PrismaProposalRepository,
        proposalPublicLinkService: ProposalPublicLinkService,
        messagingFacade: any,
      ) => new SendProposalToConversationService(repo, proposalPublicLinkService, messagingFacade),
      inject: ['IProposalRepository', ProposalPublicLinkService, MESSAGING_FACADE],
    },
    // Use Cases
    {
      provide: CreateProposalUseCase,
      useFactory: (service: CreateProposalService) => new CreateProposalUseCase(service),
      inject: [CreateProposalService],
    },
    {
      provide: UpdateProposalUseCase,
      useFactory: (service: UpdateProposalService) => new UpdateProposalUseCase(service),
      inject: [UpdateProposalService],
    },
    {
      provide: DeleteProposalUseCase,
      useFactory: (service: DeleteProposalService) => new DeleteProposalUseCase(service),
      inject: [DeleteProposalService],
    },
    {
      provide: GetProposalUseCase,
      useFactory: (service: GetProposalService) => new GetProposalUseCase(service),
      inject: [GetProposalService],
    },
    {
      provide: ListProposalsUseCase,
      useFactory: (service: ListProposalsService) => new ListProposalsUseCase(service),
      inject: [ListProposalsService],
    },
    {
      provide: GenerateProposalPdfUseCase,
      useFactory: (repo: PrismaProposalRepository, storage: FileStorageService) => 
        new GenerateProposalPdfUseCase(repo, storage),
      inject: ['IProposalRepository', FILE_STORAGE_SERVICE],
    },
    {
      provide: ScheduleProposalDeliveryUseCase,
      useFactory: (service: ScheduleProposalDeliveryService) => new ScheduleProposalDeliveryUseCase(service),
      inject: [ScheduleProposalDeliveryService],
    },
    {
      provide: SendProposalToConversationUseCase,
      useFactory: (service: SendProposalToConversationService) => new SendProposalToConversationUseCase(service),
      inject: [SendProposalToConversationService],
    },
  ],
  exports: [CreateProposalUseCase, UpdateProposalUseCase, DeleteProposalUseCase, GetProposalUseCase, ListProposalsUseCase, GenerateProposalPdfUseCase, ScheduleProposalDeliveryUseCase, SendProposalToConversationUseCase],
})
export class ProposalModule { }
