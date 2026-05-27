import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
  CatalogItemRecord,
} from '../../domain/ports/ICatalogRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { CatalogCategoryNotFoundError } from '../../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemCreatedIntegrationEvent } from '../integration-events/CatalogIntegrationEvents';
import {
  INVENTORY_SYNC_PORT,
  IInventorySyncPort,
} from '../ports/IInventorySyncPort';
import { SkuResolver } from '../../domain/services/SkuResolver';

export interface CreateCatalogItemCommand {
  tenantId: string;
  categoryId?: string;
  type: string;
  name: string;
  description?: string;
  basePrice?: string;
  currency?: string;
  tags?: string[];
  source?: string;
  externalReference?: string;
  imageUrl?: string;
  initialStock?: number;
  weightGrams?: number | null;
  heightCm?: number | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

@Injectable()
export class CreateCatalogItemUseCase implements IUseCase<
  CreateCatalogItemCommand,
  CatalogItemRecord
> {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(INVENTORY_SYNC_PORT)
    private readonly inventorySyncPort: IInventorySyncPort,
  ) {}

  async execute(command: CreateCatalogItemCommand): Promise<CatalogItemRecord> {
    if (command.categoryId) {
      const category = await this.catalogRepository.findCategoryById(
        command.tenantId,
        command.categoryId,
      );

      if (!category) {
        throw new CatalogCategoryNotFoundError(command.categoryId);
      }
    }

    const item = await this.catalogRepository.createItem({
      tenantId: command.tenantId,
      categoryId: command.categoryId,
      type: command.type,
      name: command.name.trim(),
      description: command.description?.trim() || undefined,
      basePrice: command.basePrice,
      currency: command.currency,
      tags: command.tags || [],
      source: command.source,
      externalReference: command.externalReference,
      imageUrl: command.imageUrl,
      weightGrams: command.weightGrams,
      heightCm: command.heightCm,
      widthCm: command.widthCm,
      lengthCm: command.lengthCm,
      attributes: command.attributes,
      variants: command.variants,
      optionGroups: command.optionGroups,
    });

    const itemCreatedEventPayload = {
      itemId: item.id,
      tenantId: item.tenantId,
      name: item.name,
      type: item.type,
      basePrice: item.basePrice || null,
    };

    await this.eventBus.publish(
      new CatalogItemCreatedIntegrationEvent(itemCreatedEventPayload),
    );

    await this.syncInventoryForManualCatalogItem(item, command.initialStock);

    await this.catalogRepository.saveAuditLog({
      tenantId: item.tenantId,
      event: 'ITEM_CREATED',
      entityId: item.id,
      entityType: 'ITEM',
      metadata: {
        name: item.name,
        type: item.type,
        basePrice: item.basePrice,
        attributes: item.attributes,
        variants: item.variants,
        optionGroups: item.optionGroups,
      },
    });

    return item;
  }

  private async syncInventoryForManualCatalogItem(
    item: {
      id: string;
      tenantId: string;
      type: string;
      name: string;
      externalReference?: string | null;
      basePrice?: string | null;
      currency: string;
      variants?: Array<Record<string, unknown>>;
    },
    initialStock?: number,
  ) {
    if (item.type === 'SERVICE') {
      return;
    }

    const variants = item.variants ?? [];

    if (variants.length === 0) {
      const sku = SkuResolver.resolve(item.name, {
        externalReference: item.externalReference ?? undefined,
      });
      if (!sku) return;

      await this.inventorySyncPort.syncItem({
        tenantId: item.tenantId,
        catalogItemId: item.id,
        sku,
        externalReference: item.externalReference ?? undefined,
        name: item.name,
        availableQuantity: this.parseQuantity(initialStock),
        availabilityStatus:
          this.parseQuantity(initialStock) > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        currentPrice: item.basePrice ?? undefined,
        currency: item.currency,
        source: 'MANUAL_SNAPSHOT',
      });
      return;
    }

    for (const [index, variant] of variants.entries()) {
      const variantName =
        this.stringifyValue(variant.name) ||
        `${item.name} - Variação ${index + 1}`;
      const reference =
        this.stringifyValue(variant.reference) ||
        this.stringifyValue(variant.sku);
      const externalReference =
        reference || item.externalReference || undefined;
      const sku = SkuResolver.resolve(variantName, {
        externalReference,
      });

      if (!sku) continue;

      const availableQuantity = this.parseQuantity(variant.stock);
      await this.inventorySyncPort.syncItem({
        tenantId: item.tenantId,
        catalogItemId: item.id,
        sku,
        externalReference,
        name: `${item.name} - ${variantName}`,
        availableQuantity,
        availabilityStatus: availableQuantity > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        currentPrice:
          this.stringifyValue(variant.price) || item.basePrice || undefined,
        currency: item.currency,
        source: 'MANUAL_SNAPSHOT',
      });
    }
  }

  private stringifyValue(value: unknown): string | undefined {
    if (value == null) return undefined;
    return String(value).trim() || undefined;
  }

  private parseQuantity(value: unknown): number {
    if (value == null || value === '') return 0;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }
}
