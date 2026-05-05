import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CatalogItemNotFoundError } from '../../domain/errors/CatalogItemNotFoundError';
import { CatalogItemDeactivatedIntegrationEvent } from '../integration-events/CatalogIntegrationEvents';

export interface DeactivateCatalogItemCommand {
  tenantId: string;
  itemId: string;
}

@Injectable()
export class DeactivateCatalogItemUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: DeactivateCatalogItemCommand) {
    const item = await this.catalogRepository.findItemById(
      command.tenantId,
      command.itemId,
    );

    if (!item) {
      throw new CatalogItemNotFoundError(command.itemId);
    }

    const updatedItem = await this.catalogRepository.deactivateItem(
      command.tenantId,
      command.itemId,
    );

    await this.eventBus.publish(
      new CatalogItemDeactivatedIntegrationEvent({
        itemId: item.id,
        tenantId: item.tenantId,
      }),
    );

    await this.catalogRepository.saveAuditLog({
      tenantId: item.tenantId,
      event: 'ITEM_DEACTIVATED',
      entityId: item.id,
      entityType: 'ITEM',
    });

    return updatedItem;
  }
}
