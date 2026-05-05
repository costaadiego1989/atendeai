import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogCategoryRecord,
  CatalogItemRecord,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';

export interface CatalogSearchInput {
  tenantId: string;
  type?: string;
  categoryId?: string;
  query?: string;
  includeInactive?: boolean;
}

export interface ICatalogQueryPort {
  listCategories(tenantId: string): Promise<CatalogCategoryRecord[]>;
  searchItems(input: CatalogSearchInput): Promise<CatalogItemRecord[]>;
}

export const CATALOG_QUERY_PORT = 'CATALOG_QUERY_PORT';

@Injectable()
export class CatalogFacade implements ICatalogQueryPort {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async listCategories(tenantId: string): Promise<CatalogCategoryRecord[]> {
    return this.catalogRepository.listCategories(tenantId);
  }

  async searchItems(input: CatalogSearchInput): Promise<CatalogItemRecord[]> {
    return this.catalogRepository.listItems(input);
  }
}
