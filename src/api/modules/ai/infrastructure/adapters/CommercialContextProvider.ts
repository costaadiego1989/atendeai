import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_QUERY_PORT,
  ICatalogQueryPort,
} from '@modules/catalog/application/facades/CatalogFacade';
import {
  IInventoryQueryPort,
  INVENTORY_QUERY_PORT,
} from '@modules/inventory/application/facades/InventoryFacade';
import { CatalogItemRecord } from '@modules/catalog/domain/ports/ICatalogRepository';
import { InventoryItemRecord } from '@modules/inventory/domain/ports/IInventoryRepository';
import { ICommercialContextProvider } from '../../application/ports/ICommercialContextProvider';

type ScoredMatch<T> = {
  item: T;
  score: number;
};

@Injectable()
export class CommercialContextProvider implements ICommercialContextProvider {
  constructor(
    @Inject(INVENTORY_QUERY_PORT)
    private readonly inventoryQueryPort: IInventoryQueryPort,
    @Inject(CATALOG_QUERY_PORT)
    private readonly catalogQueryPort: ICatalogQueryPort,
  ) { }

  async findRelevantOffer(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null> {
    const inventoryItems = await this.inventoryQueryPort.listItems({ tenantId });
    const matchingInventory = this.findBestInventoryMatch(
      inventoryItems,
      userMessage,
    );

    if (matchingInventory) {
      return this.buildInventoryContext(matchingInventory);
    }

    const catalogItems = await this.catalogQueryPort.searchItems({
      tenantId,
      includeInactive: false,
    });
    const matchingCatalog = this.findBestCatalogMatch(catalogItems, userMessage);

    if (matchingCatalog) {
      return this.buildCatalogContext(matchingCatalog);
    }

    return null;
  }

  private findBestInventoryMatch(
    items: InventoryItemRecord[],
    userMessage: string,
  ): InventoryItemRecord | null {
    return this.findBestMatch(
      items,
      userMessage,
      (item) => `${item.name} ${item.sku} ${item.externalReference || ''}`,
    );
  }

  private findBestCatalogMatch(
    items: CatalogItemRecord[],
    userMessage: string,
  ): CatalogItemRecord | null {
    return this.findBestMatch(
      items,
      userMessage,
      (item) =>
        `${item.name} ${item.categoryName || ''} ${(item.tags || []).join(' ')}`,
    );
  }

  private findBestMatch<T>(
    items: T[],
    userMessage: string,
    textSelector: (item: T) => string,
  ): T | null {
    const normalizedMessage = this.normalize(userMessage);
    const messageTokens = this.extractTokens(normalizedMessage);

    const scoredMatches = items
      .map((item) => {
        const haystack = this.normalize(textSelector(item));
        const score = messageTokens.reduce((total, token) => {
          return total + (haystack.includes(token) ? 1 : 0);
        }, 0);

        return { item, score };
      })
      .filter((entry): entry is ScoredMatch<T> => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return scoredMatches[0]?.item || null;
  }

  private buildInventoryContext(item: InventoryItemRecord): string {
    return [
      'Inventory context:',
      `- Item: ${item.name}`,
      `- SKU: ${item.sku}`,
      `- Availability status: ${item.availabilityStatus}`,
      `- Available quantity: ${item.availableQuantity}`,
      `- Current price: ${item.currency} ${item.currentPrice || 'n/a'}`,
      `- Source: ${item.source}`,
    ].join('\n');
  }

  private buildCatalogContext(item: CatalogItemRecord): string {
    return [
      'Catalog context:',
      `- Item: ${item.name}`,
      `- Type: ${item.type}`,
      `- Category: ${item.categoryName || 'uncategorized'}`,
      `- Base price: ${item.currency} ${item.basePrice || 'n/a'}`,
      `- Tags: ${(item.tags || []).join(', ') || 'n/a'}`,
    ].join('\n');
  }

  private extractTokens(value: string): string[] {
    const stopWords = new Set([
      'quanto',
      'custa',
      'esta',
      'tem',
      'do',
      'da',
      'de',
      'o',
      'a',
      'os',
      'as',
      'um',
      'uma',
      'por',
      'favor',
      'quero',
      'preciso',
      'saber',
      'valor',
      'preço',
    ]);

    return value
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopWords.has(token));
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
