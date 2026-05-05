import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_QUERY_PORT,
  ICatalogQueryPort,
} from '@modules/catalog/application/facades/CatalogFacade';
import {
  INVENTORY_QUERY_PORT,
  IInventoryQueryPort,
} from '@modules/inventory/application/facades/InventoryFacade';

export interface SearchCommerceCatalogInput {
  tenantId: string;
  query: string;
  limit?: number;
}

@Injectable()
export class SearchCommerceCatalogUseCase {
  constructor(
    @Inject(INVENTORY_QUERY_PORT)
    private readonly inventoryQueryPort: IInventoryQueryPort,
    @Inject(CATALOG_QUERY_PORT)
    private readonly catalogQueryPort: ICatalogQueryPort,
  ) {}

  async execute(input: SearchCommerceCatalogInput) {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 10);
    const inventoryItems = await this.inventoryQueryPort.listItems({
      tenantId: input.tenantId,
      query: input.query,
      availableOnly: true,
    });
    const catalogItems = await this.catalogQueryPort.searchItems({
      tenantId: input.tenantId,
      query: input.query,
      includeInactive: false,
    });

    const seenCatalogIds = new Set(
      inventoryItems
        .map((item) => item.catalogItemId)
        .filter((value): value is string => Boolean(value)),
    );

    const inventoryOptions = inventoryItems.map((item) => ({
      source: 'INVENTORY' as const,
      inventoryItemId: item.id,
      catalogItemId: item.catalogItemId ?? undefined,
      name: item.name,
      price: item.currentPrice != null ? Number(item.currentPrice) : null,
      currency: item.currency,
      availableQuantity: item.availableQuantity,
      availabilityStatus: item.availabilityStatus,
      categoryName: null,
      attributes: undefined,
      variants: undefined,
      optionGroups: undefined,
    }));

    const catalogOptions = catalogItems
      .filter((item) => !seenCatalogIds.has(item.id))
      .map((item) => ({
        source: 'CATALOG' as const,
        inventoryItemId: undefined,
        catalogItemId: item.id,
        name: item.name,
        price: item.basePrice != null ? Number(item.basePrice) : null,
        currency: item.currency,
        availableQuantity: null,
        availabilityStatus: null,
        categoryName: item.categoryName ?? null,
        attributes: item.attributes,
        variants: item.variants,
        optionGroups: item.optionGroups,
      }));

    return [...inventoryOptions, ...catalogOptions]
      .slice(0, limit)
      .map((option, index) => ({
        optionNumber: index + 1,
        ...option,
      }));
  }
}
