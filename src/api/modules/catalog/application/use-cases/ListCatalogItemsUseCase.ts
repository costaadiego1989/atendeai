import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';

export interface ListCatalogItemsQuery {
  tenantId: string;
  type?: string;
  categoryId?: string;
  query?: string;
  includeInactive?: boolean;
}

@Injectable()
export class ListCatalogItemsUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async execute(query: ListCatalogItemsQuery) {
    return this.catalogRepository.listItems(query);
  }
}
