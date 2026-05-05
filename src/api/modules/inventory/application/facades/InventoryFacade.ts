import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
  InventoryItemRecord,
  ListInventoryItemsFilters,
} from '../../domain/ports/IInventoryRepository';

export interface IInventoryQueryPort {
  listItems(filters: ListInventoryItemsFilters): Promise<InventoryItemRecord[]>;
}

export const INVENTORY_QUERY_PORT = 'INVENTORY_QUERY_PORT';

@Injectable()
export class InventoryFacade implements IInventoryQueryPort {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async listItems(
    filters: ListInventoryItemsFilters,
  ): Promise<InventoryItemRecord[]> {
    return this.inventoryRepository.listItems(filters);
  }
}
