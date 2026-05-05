import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
} from '../../domain/ports/IInventoryRepository';

@Injectable()
export class ListInventoryConnectionsUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(tenantId: string) {
    return this.inventoryRepository.listConnections(tenantId);
  }
}
