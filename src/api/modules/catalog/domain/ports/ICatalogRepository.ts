export interface CatalogCategoryRecord {
  id: string;
  tenantId: string;
  parentCategoryId?: string | null;
  parentCategoryName?: string | null;
  path: string[];
  level: number;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItemRecord {
  id: string;
  tenantId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  type: string;
  name: string;
  description?: string | null;
  basePrice?: string | null;
  currency: string;
  tags: string[];
  active: boolean;
  source: string;
  externalReference?: string | null;
  imageUrl?: string | null;
  attributes: Record<string, unknown>;
  variants: Array<Record<string, unknown>>;
  optionGroups: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCatalogItemsFilters {
  tenantId: string;
  type?: string;
  categoryId?: string;
  query?: string;
  includeInactive?: boolean;
}

export interface CreateCatalogCategoryInput {
  tenantId: string;
  parentCategoryId?: string;
  name: string;
  description?: string;
}

export interface UpdateCatalogCategoryInput {
  tenantId: string;
  categoryId: string;
  parentCategoryId?: string | null;
  name: string;
  description?: string;
}

export interface CreateCatalogItemInput {
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
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

export interface UpdateCatalogItemInput {
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

export interface CatalogAuditLogInput {
  tenantId: string;
  userId?: string;
  userName?: string;
  event: string;
  entityId: string;
  entityType: 'ITEM' | 'CATEGORY';
  metadata?: any;
}

export interface ICatalogRepository {
  createCategory(
    input: CreateCatalogCategoryInput,
  ): Promise<CatalogCategoryRecord>;
  updateCategory(
    input: UpdateCatalogCategoryInput,
  ): Promise<CatalogCategoryRecord>;
  listCategories(tenantId: string): Promise<CatalogCategoryRecord[]>;
  findCategoryById(
    tenantId: string,
    categoryId: string,
  ): Promise<CatalogCategoryRecord | null>;
  deactivateCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<CatalogCategoryRecord>;
  hasActiveItemsInCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<boolean>;
  createItem(input: CreateCatalogItemInput): Promise<CatalogItemRecord>;
  updateItem(input: UpdateCatalogItemInput): Promise<CatalogItemRecord>;
  listItems(filters: ListCatalogItemsFilters): Promise<CatalogItemRecord[]>;
  findItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CatalogItemRecord | null>;
  findItemByExternalReference(
    tenantId: string,
    externalReference: string,
  ): Promise<CatalogItemRecord | null>;
  findItemByNameAndType(
    tenantId: string,
    type: string,
    name: string,
  ): Promise<CatalogItemRecord | null>;
  deactivateItem(tenantId: string, itemId: string): Promise<CatalogItemRecord>;
  saveAuditLog(input: CatalogAuditLogInput): Promise<void>;
}

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');
