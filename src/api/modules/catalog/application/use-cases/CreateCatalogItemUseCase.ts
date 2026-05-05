import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CatalogCategoryNotFoundError } from '../../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemCreatedIntegrationEvent } from '../integration-events/CatalogIntegrationEvents';
import { SyncInventoryItemUseCase } from '../../../inventory/application/use-cases/SyncInventoryItemUseCase';

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
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

@Injectable()
export class CreateCatalogItemUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly syncInventoryItemUseCase: SyncInventoryItemUseCase,
  ) { }

  async execute(command: CreateCatalogItemCommand) {
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

  private async syncInventoryForManualCatalogItem(item: {
    id: string;
    tenantId: string;
    type: string;
    name: string;
    externalReference?: string | null;
    basePrice?: string | null;
    currency: string;
    variants?: Array<Record<string, unknown>>;
  }, initialStock?: number) {
    if (item.type === 'SERVICE') {
      return;
    }

    const variants = item.variants ?? [];

    if (variants.length === 0) {
      const sku = this.resolveSku(item.externalReference ?? undefined, item.name);
      if (!sku) return;

      await this.syncInventoryItemUseCase.execute({
        tenantId: item.tenantId,
        catalogItemId: item.id,
        sku,
        externalReference: item.externalReference ?? undefined,
        name: item.name,
        availableQuantity: this.parseQuantity(initialStock),
        availabilityStatus: this.parseQuantity(initialStock) > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        currentPrice: item.basePrice ?? undefined,
        currency: item.currency,
        source: 'MANUAL_SNAPSHOT',
      });
      return;
    }

    for (const [index, variant] of variants.entries()) {
      const variantName =
        this.stringifyValue(variant.name) || `${item.name} - Variação ${index + 1}`;
      const reference =
        this.stringifyValue(variant.reference) || this.stringifyValue(variant.sku);
      const externalReference = reference || item.externalReference || undefined;
      const sku = this.resolveSku(externalReference, variantName);

      if (!sku) continue;

      const availableQuantity = this.parseQuantity(variant.stock);
      await this.syncInventoryItemUseCase.execute({
        tenantId: item.tenantId,
        catalogItemId: item.id,
        sku,
        externalReference,
        name: `${item.name} - ${variantName}`,
        availableQuantity,
        availabilityStatus: availableQuantity > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        currentPrice: this.stringifyValue(variant.price) || item.basePrice || undefined,
        currency: item.currency,
        source: 'MANUAL_SNAPSHOT',
      });
    }
  }

  private resolveSku(reference: string | undefined, name: string): string | undefined {
    const candidate = reference?.trim();
    if (candidate) {
      return candidate.toUpperCase();
    }

    const normalized = name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();

    return normalized || undefined;
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
