import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
} from '../../domain/ports/IInventoryRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { InventoryInvalidSkuError } from '../../domain/errors/InventoryInvalidSkuError';
import {
  InventoryItemSyncedIntegrationEvent,
  InventoryItemUnavailableIntegrationEvent,
  InventoryPriceChangedIntegrationEvent,
} from '../integration-events/InventoryIntegrationEvents';

export interface SyncInventoryItemCommand {
  tenantId: string;
  catalogItemId?: string;
  sku: string;
  externalReference?: string;
  name: string;
  availableQuantity: number;
  availabilityStatus: string;
  currentPrice?: string;
  currency?: string;
  source?: string;
}

@Injectable()
export class SyncInventoryItemUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: SyncInventoryItemCommand) {
    const sku = command.sku.trim();
    const name = command.name.trim();

    if (!sku) {
      throw new InventoryInvalidSkuError();
    }

    const previousItem = await this.inventoryRepository.findItemBySku(
      command.tenantId,
      sku,
    );

    const item = await this.inventoryRepository.syncItem({
      tenantId: command.tenantId,
      catalogItemId: command.catalogItemId,
      sku,
      externalReference: command.externalReference?.trim() || undefined,
      name,
      availableQuantity: Math.max(0, command.availableQuantity),
      availabilityStatus: command.availabilityStatus,
      currentPrice: command.currentPrice,
      currency: command.currency,
      source: command.source,
    });

    await this.eventBus.publish(
      new InventoryItemSyncedIntegrationEvent({
        itemId: item.id,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        availableQuantity: item.availableQuantity,
        availabilityStatus: item.availabilityStatus,
        currentPrice: item.currentPrice ?? null,
        source: item.source,
      }),
    );

    if (item.availabilityStatus === 'UNAVAILABLE') {
      await this.eventBus.publish(
        new InventoryItemUnavailableIntegrationEvent({
          itemId: item.id,
          tenantId: item.tenantId,
          sku: item.sku,
          name: item.name,
        }),
      );
    }

    const previousPrice = previousItem?.currentPrice ?? null;
    const newPrice = item.currentPrice ?? null;

    if (previousItem && previousPrice !== newPrice) {
      await this.eventBus.publish(
        new InventoryPriceChangedIntegrationEvent({
          itemId: item.id,
          tenantId: item.tenantId,
          sku: item.sku,
          previousPrice,
          newPrice,
        }),
      );
    }

    return item;
  }
}
