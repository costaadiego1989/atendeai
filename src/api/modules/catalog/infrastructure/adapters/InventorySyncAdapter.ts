import { Injectable } from '@nestjs/common';
import {
  IInventorySyncPort,
  SyncInventoryItemInput,
} from '../../application/ports/IInventorySyncPort';
import { SyncInventoryItemUseCase } from '../../../inventory/application/use-cases/SyncInventoryItemUseCase';

@Injectable()
export class InventorySyncAdapter implements IInventorySyncPort {
  constructor(
    private readonly syncInventoryItemUseCase: SyncInventoryItemUseCase,
  ) {}

  async syncItem(input: SyncInventoryItemInput): Promise<void> {
    await this.syncInventoryItemUseCase.execute({
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
