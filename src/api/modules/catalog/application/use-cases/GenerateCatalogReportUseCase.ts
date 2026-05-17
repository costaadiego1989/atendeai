import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogItemRecord,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';

export type GenerateCatalogReportInput = {
  tenantId: string;
  types?: Array<'SERVICE' | 'PRODUCT' | 'RENTAL'>;
  categoryIds?: string[];
  query?: string;
  includeInactive?: boolean;
};

export type GenerateCatalogReportOutput = {
  generatedAt: Date;
  summary: {
    totalItems: number;
    activeItems: number;
    inactiveItems: number;
    services: number;
    products: number;
    rentals: number;
    estimatedBaseValue: number;
  };
  items: CatalogItemRecord[];
};

@Injectable()
export class GenerateCatalogReportUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async execute(
    input: GenerateCatalogReportInput,
  ): Promise<GenerateCatalogReportOutput> {
    const items = await this.catalogRepository.listItems({
      tenantId: input.tenantId,
      query: input.query,
      includeInactive: input.includeInactive,
    });
    const typeFilters = new Set<'SERVICE' | 'PRODUCT' | 'RENTAL'>(
      (input.types ?? []).filter(Boolean) as Array<
        'SERVICE' | 'PRODUCT' | 'RENTAL'
      >,
    );
    const categoryFilters = new Set((input.categoryIds ?? []).filter(Boolean));
    const filteredItems = items.filter((item) => {
      const matchesType =
        typeFilters.size === 0 ||
        typeFilters.has(item.type as 'SERVICE' | 'PRODUCT' | 'RENTAL');
      const matchesCategory =
        categoryFilters.size === 0 ||
        (item.categoryId != null && categoryFilters.has(item.categoryId));
      return matchesType && matchesCategory;
    });

    return {
      generatedAt: new Date(),
      summary: {
        totalItems: filteredItems.length,
        activeItems: filteredItems.filter((item) => item.active).length,
        inactiveItems: filteredItems.filter((item) => !item.active).length,
        services: filteredItems.filter((item) => item.type === 'SERVICE')
          .length,
        products: filteredItems.filter((item) => item.type === 'PRODUCT')
          .length,
        rentals: filteredItems.filter((item) => item.type === 'RENTAL').length,
        estimatedBaseValue: filteredItems.reduce((total, item) => {
          const basePrice = item.basePrice == null ? 0 : Number(item.basePrice);
          return total + basePrice;
        }, 0),
      },
      items: filteredItems,
    };
  }
}
