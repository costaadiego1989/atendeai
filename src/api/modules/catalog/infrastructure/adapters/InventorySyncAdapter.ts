import { Inject, Injectable } from '@nestjs/common';
import {
  IInventorySyncPort,
  SyncInventoryItemInput,
} from '../../application/ports/IInventorySyncPort';

/**
 * Token referencing the SyncInventoryItemUseCase exported by InventoryModule.
 * Using a string token avoids importing inventory internals directly.
 */
export const SYNC_INVENTORY_ITEM_USE_CASE = 'SyncInventoryItemUseCase';

/** Minimal contract expected from the injected inventory sync service. */
interface IInventorySyncExecutor {
  execute(command: SyncInventoryItemInput): Promise<unknown>;
}

@Injectable()
export class InventorySyncAdapter implements IInventorySyncPort {
  constructor(
    @Inject(SYNC_INVENTORY_ITEM_USE_CASE)
    private readonly syncExecutor: IInventorySyncExecutor,
  ) {}

  async syncItem(input: SyncInventoryItemInput): Promise<void> {
    await this.syncExecutor.execute({
      tenantId: input.tenantId,
      catalogItemId: input.catalogItemId,
      sku: input.sku,
      externalReference: input.externalReference,
      name: input.name,
      availableQuantity: input.availableQuantity,
      availabilityStatus: input.availabilityStatus,
      currentPrice: input.currentPrice,
      currency: input.currency,
      source: input.source,
    });
  }
}
