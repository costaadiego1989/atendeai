import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CatalogController } from './presentation/controllers/CatalogController';
import { CreateCatalogCategoryUseCase } from './application/use-cases/CreateCatalogCategoryUseCase';
import { ListCatalogCategoriesUseCase } from './application/use-cases/ListCatalogCategoriesUseCase';
import { CreateCatalogItemUseCase } from './application/use-cases/CreateCatalogItemUseCase';
import { ListCatalogItemsUseCase } from './application/use-cases/ListCatalogItemsUseCase';
import { DeactivateCatalogItemUseCase } from './application/use-cases/DeactivateCatalogItemUseCase';
import { UpdateCatalogCategoryUseCase } from './application/use-cases/UpdateCatalogCategoryUseCase';
import { DeactivateCatalogCategoryUseCase } from './application/use-cases/DeactivateCatalogCategoryUseCase';
import { UpdateCatalogItemUseCase } from './application/use-cases/UpdateCatalogItemUseCase';
import { EnqueueCatalogReportJobUseCase } from './application/use-cases/EnqueueCatalogReportJobUseCase';
import { EnqueueCatalogImportJobUseCase } from './application/use-cases/EnqueueCatalogImportJobUseCase';
import {
  CATALOG_QUERY_PORT,
  CatalogFacade,
} from './application/facades/CatalogFacade';
import { GenerateCatalogReportUseCase } from './application/use-cases/GenerateCatalogReportUseCase';
import { ImportCatalogItemsUseCase } from './application/use-cases/ImportCatalogItemsUseCase';
import { CatalogReportCsvBuilder } from './application/services/CatalogReportCsvBuilder';
import { CatalogAsyncJobsService } from './application/services/CatalogAsyncJobsService';
import { CatalogImportParser } from './application/services/CatalogImportParser';
import { CatalogAsyncJobProcessor } from './infrastructure/queue/CatalogAsyncJobProcessor';
import { CATALOG_REPOSITORY } from './domain/ports/ICatalogRepository';
import { PrismaCatalogRepository } from './infrastructure/persistence/repositories/PrismaCatalogRepository';
import { INVENTORY_SYNC_PORT } from './application/ports/IInventorySyncPort';
import {
  InventorySyncAdapter,
  SYNC_INVENTORY_ITEM_USE_CASE,
} from './infrastructure/adapters/InventorySyncAdapter';
import { SyncInventoryItemUseCase } from '../inventory/application/use-cases/SyncInventoryItemUseCase';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
    EventBusModule,
    BullModule.registerQueue({
      name: 'catalog-async-jobs',
    }),
  ],
  controllers: [CatalogController],
  providers: [
    CreateCatalogCategoryUseCase,
    ListCatalogCategoriesUseCase,
    CreateCatalogItemUseCase,
    ListCatalogItemsUseCase,
    DeactivateCatalogItemUseCase,
    UpdateCatalogCategoryUseCase,
    DeactivateCatalogCategoryUseCase,
    UpdateCatalogItemUseCase,
    GenerateCatalogReportUseCase,
    ImportCatalogItemsUseCase,
    EnqueueCatalogReportJobUseCase,
    EnqueueCatalogImportJobUseCase,
    CatalogReportCsvBuilder,
    CatalogImportParser,
    CatalogAsyncJobsService,
    CatalogAsyncJobProcessor,
    {
      provide: CATALOG_REPOSITORY,
      useClass: PrismaCatalogRepository,
    },
    {
      provide: CATALOG_QUERY_PORT,
      useClass: CatalogFacade,
    },
    {
      provide: SYNC_INVENTORY_ITEM_USE_CASE,
      useExisting: SyncInventoryItemUseCase,
    },
    {
      provide: INVENTORY_SYNC_PORT,
      useClass: InventorySyncAdapter,
    },
  ],
  exports: [
    CreateCatalogCategoryUseCase,
    ListCatalogCategoriesUseCase,
    CreateCatalogItemUseCase,
    ListCatalogItemsUseCase,
    DeactivateCatalogItemUseCase,
    UpdateCatalogCategoryUseCase,
    DeactivateCatalogCategoryUseCase,
    UpdateCatalogItemUseCase,
    GenerateCatalogReportUseCase,
    ImportCatalogItemsUseCase,
    CATALOG_QUERY_PORT,
  ],
})
export class CatalogModule {}
