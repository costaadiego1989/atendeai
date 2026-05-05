import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
} from '../../domain/ports/IInventoryRepository';

export interface ListInventoryItemsQuery {
  tenantId: string;
  query?: string;
  availableOnly?: boolean;
}

@Injectable()
export class ListInventoryItemsUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(query: ListInventoryItemsQuery) {
    return this.inventoryRepository.listItems(query);
  }
}
