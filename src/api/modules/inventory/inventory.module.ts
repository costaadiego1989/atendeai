import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './presentation/controllers/InventoryController';
import { SyncInventoryItemUseCase } from './application/use-cases/SyncInventoryItemUseCase';
import { ListInventoryItemsUseCase } from './application/use-cases/ListInventoryItemsUseCase';
import { CreateInventoryConnectionUseCase } from './application/use-cases/CreateInventoryConnectionUseCase';
import { ListInventoryConnectionsUseCase } from './application/use-cases/ListInventoryConnectionsUseCase';
import { SyncInventoryConnectionUseCase } from './application/use-cases/SyncInventoryConnectionUseCase';
import { INVENTORY_REPOSITORY } from './domain/ports/IInventoryRepository';
import { PrismaInventoryRepository } from './infrastructure/persistence/repositories/PrismaInventoryRepository';
import { INVENTORY_PROVIDER_FACTORY } from './application/ports/IInventoryProvider';
import { InventoryProviderFactory } from './application/providers/InventoryProviderFactory';
import { InventorySyncWorker } from './application/workers/InventorySyncWorker';
import {
  INVENTORY_QUERY_PORT,
  InventoryFacade,
} from './application/facades/InventoryFacade';
import { GenerateInventoryReportUseCase } from './application/use-cases/GenerateInventoryReportUseCase';
import { InventoryReportCsvBuilder } from './application/services/InventoryReportCsvBuilder';
import { InventoryAsyncJobsService } from './application/services/InventoryAsyncJobsService';
import { InventoryAsyncJobProcessor } from './infrastructure/queue/InventoryAsyncJobProcessor';
import { INVENTORY_CREDENTIAL_CIPHER } from './application/ports/ICredentialCipher';
import { AesGcmCredentialCipher } from './infrastructure/security/AesGcmCredentialCipher';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'inventory-async-jobs',
    }),
  ],
  controllers: [InventoryController],
  providers: [
    SyncInventoryItemUseCase,
    ListInventoryItemsUseCase,
    CreateInventoryConnectionUseCase,
    ListInventoryConnectionsUseCase,
    GenerateInventoryReportUseCase,
    SyncInventoryConnectionUseCase,
    InventorySyncWorker,
    InventoryReportCsvBuilder,
    InventoryAsyncJobsService,
    InventoryAsyncJobProcessor,
    {
      provide: INVENTORY_CREDENTIAL_CIPHER,
      useClass: AesGcmCredentialCipher,
    },
    {
      provide: INVENTORY_REPOSITORY,
      useClass: PrismaInventoryRepository,
    },
    {
      provide: INVENTORY_PROVIDER_FACTORY,
      useClass: InventoryProviderFactory,
    },
    {
      provide: INVENTORY_QUERY_PORT,
      useClass: InventoryFacade,
    },
  ],
  exports: [
    SyncInventoryItemUseCase,
    ListInventoryItemsUseCase,
    CreateInventoryConnectionUseCase,
    ListInventoryConnectionsUseCase,
    GenerateInventoryReportUseCase,
    SyncInventoryConnectionUseCase,
    INVENTORY_QUERY_PORT,
  ],
})
export class InventoryModule {}
