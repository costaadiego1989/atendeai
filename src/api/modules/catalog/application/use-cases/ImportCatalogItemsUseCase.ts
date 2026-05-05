import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogCategoryRecord,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { CatalogImportParser } from '../services/CatalogImportParser';
import { CreateCatalogCategoryUseCase } from './CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from './CreateCatalogItemUseCase';
import { UpdateCatalogItemUseCase } from './UpdateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '../../../inventory/application/use-cases/SyncInventoryItemUseCase';

export interface ImportCatalogItemsInput {
  tenantId: string;
  rawText: string;
  defaultType?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  defaultCategoryName?: string;
  defaultSource?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  defaultTags?: string[];
  syncInventory?: boolean;
}

export interface ImportCatalogItemsOutputItem {
  lineNumber: number;
  status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  name: string;
  type?: string;
  categoryName?: string;
  inventorySynced?: boolean;
  reason?: string;
}

export interface ImportCatalogItemsOutput {
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  inventorySynced: number;
  items: ImportCatalogItemsOutputItem[];
}

@Injectable()
export class ImportCatalogItemsUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    private readonly catalogImportParser: CatalogImportParser,
    private readonly createCatalogCategoryUseCase: CreateCatalogCategoryUseCase,
    private readonly createCatalogItemUseCase: CreateCatalogItemUseCase,
    private readonly updateCatalogItemUseCase: UpdateCatalogItemUseCase,
    private readonly syncInventoryItemUseCase: SyncInventoryItemUseCase,
  ) {}

  async execute(input: ImportCatalogItemsInput): Promise<ImportCatalogItemsOutput> {
    const rows = this.catalogImportParser.parseRows(input.rawText, {
      defaultType: input.defaultType,
      defaultCategoryName: input.defaultCategoryName,
      defaultSource: input.defaultSource,
      defaultTags: input.defaultTags ?? [],
    });
    const items: ImportCatalogItemsOutputItem[] = [];
    const categoryCache = new Map<string, CatalogCategoryRecord>();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let inventorySynced = 0;

    const existingCategories = await this.catalogRepository.listCategories(input.tenantId);
    existingCategories.forEach((category) => {
      categoryCache.set(this.normalizeKey(category.name), category);
    });

    for (const row of rows) {
      try {
        if (!row.name.trim()) {
          skipped += 1;
          items.push({
            lineNumber: row.lineNumber,
            status: 'SKIPPED',
            name: row.name,
            type: row.type,
            reason: 'Nome ausente ou invalido.',
          });
          continue;
        }

        const itemType = row.type ?? input.defaultType ?? 'PRODUCT';
        const category = await this.resolveCategory(
          input.tenantId,
          row.categoryName ?? input.defaultCategoryName,
          categoryCache,
        );
        const existingItem = await this.findExistingItem(
          input.tenantId,
          row.externalReference,
          itemType,
          row.name,
        );

        const mergedTags = existingItem
          ? [...new Set([...(existingItem.tags ?? []), ...row.tags])]
          : row.tags;

        const item = existingItem
          ? await this.updateCatalogItemUseCase.execute({
              tenantId: input.tenantId,
              itemId: existingItem.id,
              categoryId: category?.id ?? existingItem.categoryId ?? undefined,
              type: itemType,
              name: row.name,
              description: row.description ?? existingItem.description ?? undefined,
              basePrice: row.basePrice ?? existingItem.basePrice ?? undefined,
              currency: row.currency ?? existingItem.currency,
              tags: mergedTags,
              externalReference: row.externalReference ?? existingItem.externalReference ?? undefined,
              imageUrl: row.imageUrl ?? existingItem.imageUrl ?? undefined,
            })
          : await this.createCatalogItemUseCase.execute({
              tenantId: input.tenantId,
              categoryId: category?.id,
              type: itemType,
              name: row.name,
              description: row.description,
              basePrice: row.basePrice,
              currency: row.currency,
              tags: mergedTags,
              source: row.source ?? input.defaultSource ?? 'IMPORT',
              externalReference: row.externalReference,
              imageUrl: row.imageUrl,
            });

        const inventoryWasSynced = await this.syncInventoryIfNeeded(
          input,
          row,
          item.id,
          item.name,
          row.externalReference ?? item.externalReference ?? undefined,
          item.basePrice ?? row.basePrice,
          itemType,
        );

        if (inventoryWasSynced) {
          inventorySynced += 1;
        }

        if (existingItem) {
          updated += 1;
        } else {
          created += 1;
        }

        items.push({
          lineNumber: row.lineNumber,
          status: existingItem ? 'UPDATED' : 'CREATED',
          name: item.name,
          type: item.type,
          categoryName: category?.name,
          inventorySynced: inventoryWasSynced,
        });
      } catch (error) {
        failed += 1;
        items.push({
          lineNumber: row.lineNumber,
          status: 'FAILED',
          name: row.name,
          type: row.type,
          categoryName: row.categoryName,
          reason: error instanceof Error ? error.message : 'Falha ao importar a linha.',
        });
      }
    }

    return {
      totalRows: rows.length,
      processed: created + updated,
      created,
      updated,
      skipped,
      failed,
      inventorySynced,
      items,
    };
  }

  private async resolveCategory(
    tenantId: string,
    categoryName: string | undefined,
    categoryCache: Map<string, CatalogCategoryRecord>,
  ): Promise<CatalogCategoryRecord | null> {
    if (!categoryName?.trim()) {
      return null;
    }

    const key = this.normalizeKey(categoryName);
    const cached = categoryCache.get(key);
    if (cached) {
      return cached;
    }

    const category = await this.createCatalogCategoryUseCase.execute({
      tenantId,
      name: categoryName,
    });
    categoryCache.set(key, category);
    return category;
  }

  private async findExistingItem(
    tenantId: string,
    externalReference: string | undefined,
    type: string,
    name: string,
  ) {
    if (externalReference?.trim()) {
      const byReference = await this.catalogRepository.findItemByExternalReference(
        tenantId,
        externalReference.trim(),
      );

      if (byReference) {
        return byReference;
      }
    }

    return this.catalogRepository.findItemByNameAndType(tenantId, type, name.trim());
  }

  private async syncInventoryIfNeeded(
    input: ImportCatalogItemsInput,
    row: {
      sku?: string;
      availableQuantity?: number;
      availabilityStatus?: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
      currentPrice?: string;
      hasInventoryData: boolean;
    },
    catalogItemId: string,
    itemName: string,
    externalReference: string | undefined,
    basePrice: string | undefined | null,
    type: string,
  ): Promise<boolean> {
    if (!input.syncInventory || type === 'SERVICE') {
      return false;
    }

    const sku = this.resolveSku(row.sku, externalReference, itemName);
    if (!sku) {
      return false;
    }

    const availableQuantity = row.availableQuantity ?? 0;
    const availabilityStatus =
      row.availabilityStatus ?? (availableQuantity > 0 ? 'AVAILABLE' : 'UNAVAILABLE');

    await this.syncInventoryItemUseCase.execute({
      tenantId: input.tenantId,
      catalogItemId,
      sku,
      externalReference,
      name: itemName,
      availableQuantity,
      availabilityStatus,
      currentPrice: row.currentPrice ?? basePrice ?? undefined,
      source: 'IMPORT_SNAPSHOT',
    });

    return true;
  }

  private resolveSku(
    sku: string | undefined,
    externalReference: string | undefined,
    name: string,
  ): string | undefined {
    const candidate = sku?.trim() || externalReference?.trim();
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

  private normalizeKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
