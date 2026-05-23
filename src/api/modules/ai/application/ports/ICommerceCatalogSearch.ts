export interface CommerceCatalogSearchInput {
  tenantId: string;
  query: string;
  limit?: number;
}

export interface CommerceCatalogSearchOption {
  optionNumber: number;
  name: string;
  price: number | null;
  currency?: string | null;
  availableQuantity?: number | null;
  categoryName?: string | null;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

export interface ICommerceCatalogSearch {
  search(
    input: CommerceCatalogSearchInput,
  ): Promise<CommerceCatalogSearchOption[]>;
}

export const COMMERCE_CATALOG_SEARCH = Symbol('COMMERCE_CATALOG_SEARCH');
