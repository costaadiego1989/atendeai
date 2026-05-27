import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
} from '../../domain/ports/IInventoryRepository';
import { SyncInventoryItemUseCase } from './SyncInventoryItemUseCase';
import {
  IInventoryProviderFactory,
  INVENTORY_PROVIDER_FACTORY,
} from '../ports/IInventoryProvider';
import { InventoryConnectionNotFoundError } from '../../domain/errors/InventoryConnectionNotFoundError';

export interface SyncInventoryConnectionCommand {
  tenantId: string;
  connectionId: string;
}

@Injectable()
export class SyncInventoryConnectionUseCase {
  private readonly logger = new Logger(SyncInventoryConnectionUseCase.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    @Inject(INVENTORY_PROVIDER_FACTORY)
    private readonly providerFactory: IInventoryProviderFactory,
    private readonly syncInventoryItemUseCase: SyncInventoryItemUseCase,
  ) {}

  async execute(command: SyncInventoryConnectionCommand): Promise<void> {
    const connection = await this.inventoryRepository.getConnection(
      command.tenantId,
      command.connectionId,
    );

    if (!connection) {
      throw new InventoryConnectionNotFoundError(command.connectionId);
    }

    this.logger.log(
      `Starting sync for connection ${connection.id} (${connection.providerName})`,
    );

    try {
      const provider = this.providerFactory.getProvider(connection.sourceType);
      const stockGenerator = provider.fetchStock(
        connection.config,
        connection.lastSyncedAt || undefined,
      );

      let totalSynced = 0;

      for await (const snapshots of stockGenerator) {
        for (const snapshot of snapshots) {
          try {
            await this.syncInventoryItemUseCase.execute({
              tenantId: connection.tenantId,
              sku: snapshot.sku,
              externalReference: snapshot.externalReference,
              name: snapshot.name,
              availableQuantity: snapshot.availableQuantity,
              availabilityStatus: snapshot.availabilityStatus,
              currentPrice: snapshot.currentPrice,
              currency: snapshot.currency,
              source: connection.sourceType,
            });
            totalSynced++;
          } catch (itemErr: any) {
            this.logger.warn(
              `Failed to sync item ${snapshot.sku} on connection ${connection.id}: ${itemErr.message}`,
            );
          }
        }
      }

      await this.inventoryRepository.markConnectionSyncedAt(
        connection.tenantId,
        connection.id,
        new Date(),
      );

      this.logger.log(
        `Finished sync for connection ${connection.id}. Total items synced: ${totalSynced}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error syncing connection ${connection.id}: ${error.message}`,
      );
      throw error;
    }
  }
}
