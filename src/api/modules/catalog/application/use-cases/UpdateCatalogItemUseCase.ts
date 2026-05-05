import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CatalogItemNotFoundError } from '../../domain/errors/CatalogItemNotFoundError';
import { CatalogCategoryNotFoundError } from '../../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemUpdatedIntegrationEvent } from '../integration-events/CatalogIntegrationEvents';

export interface UpdateCatalogItemCommand {
  tenantId: string;
  itemId: string;
  categoryId?: string;
  type: string;
  name: string;
  description?: string;
  basePrice?: string;
  currency?: string;
  tags?: string[];
  externalReference?: string;
  imageUrl?: string;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

@Injectable()
export class UpdateCatalogItemUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: UpdateCatalogItemCommand) {
    const existingItem = await this.catalogRepository.findItemById(
      command.tenantId,
      command.itemId,
    );

    if (!existingItem) {
      throw new CatalogItemNotFoundError(command.itemId);
    }

    if (command.categoryId) {
      const category = await this.catalogRepository.findCategoryById(
        command.tenantId,
        command.categoryId,
      );

      if (!category || !category.active) {
        throw new CatalogCategoryNotFoundError(command.categoryId);
      }
    }

    const item = await this.catalogRepository.updateItem({
      tenantId: command.tenantId,
      itemId: command.itemId,
      categoryId: command.categoryId,
      type: command.type,
      name: command.name.trim(),
      description: command.description?.trim() || undefined,
      basePrice: command.basePrice,
      currency: command.currency,
      tags: command.tags || [],
      externalReference: command.externalReference,
      imageUrl: command.imageUrl,
      attributes: command.attributes,
      variants: command.variants,
      optionGroups: command.optionGroups,
    });

    await this.eventBus.publish(
      new CatalogItemUpdatedIntegrationEvent({
        itemId: item.id,
        tenantId: item.tenantId,
        name: item.name,
        basePrice: item.basePrice || null,
        active: item.active,
      }),
    );

    await this.catalogRepository.saveAuditLog({
      tenantId: item.tenantId,
      event: 'ITEM_UPDATED',
      entityId: item.id,
      entityType: 'ITEM',
      metadata: {
        name: item.name,
        active: item.active,
        attributes: item.attributes,
        variants: item.variants,
        optionGroups: item.optionGroups,
      },
    });

    return item;
  }
}
