import { apiClient } from '@/shared/api/client';
import { authenticatedDownload } from '@/shared/lib/file-download';
import type { CatalogAsyncJob, CatalogCategory, CatalogItem } from '@/shared/types';

interface CatalogCategoryApiResponse {
  id: string;
  name: string;
  description?: string | null;
  parentCategoryId?: string | null;
  parentCategoryName?: string | null;
  path?: string[];
  level?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CatalogItemApiResponse {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryPath?: string[];
  type: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  name: string;
  description?: string | null;
  basePrice?: string | number | null;
  currency: string;
  tags: string[];
  active: boolean;
  source: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  externalReference?: string | null;
  imageUrl?: string | null;
  weightGrams?: number | null;
  heightCm?: number | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  attributes?: Record<string, unknown> | null;
  variants?: Array<Record<string, unknown>> | null;
  optionGroups?: Array<Record<string, unknown>> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogCategoryInput {
  name: string;
  description?: string;
  parentCategoryId?: string;
}

export interface UpdateCatalogCategoryInput {
  name: string;
  description?: string;
  parentCategoryId?: string;
}

export interface CreateCatalogItemInput {
  categoryId?: string;
  type: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  name: string;
  description?: string;
  basePrice?: string;
  currency?: string;
  tags?: string[];
  source?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
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

export interface UpdateCatalogItemInput {
  categoryId?: string;
  type: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  name: string;
  description?: string;
  basePrice?: string;
  currency?: string;
  tags?: string[];
  externalReference?: string;
  imageUrl?: string;
  weightGrams?: number | null;
  heightCm?: number | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

export interface GenerateCatalogReportInput {
  types?: Array<'SERVICE' | 'PRODUCT' | 'RENTAL'>;
  categoryIds?: string[];
  query?: string;
  includeInactive?: boolean;
}

export interface CatalogSyncReportSummary {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  services: number;
  products: number;
  rentals: number;
  estimatedBaseValue: number;
}

export interface CatalogSyncReportResponse {
  generatedAt: string;
  summary: CatalogSyncReportSummary;
  items: unknown[];
}

export interface ImportCatalogItemsInput {
  rawText: string;
  defaultType?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  defaultCategoryName?: string;
  defaultSource?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  defaultTags?: string[];
  syncInventory?: boolean;
}

export interface CatalogSelectOption {
  value: string;
  label: string;
}

function mapCategory(input: CatalogCategoryApiResponse): CatalogCategory {
  return {
    id: input.id,
    name: input.name,
    description: input.description ?? undefined,
    parentCategoryId: input.parentCategoryId ?? undefined,
    parentCategoryName: input.parentCategoryName ?? undefined,
    path: input.path ?? [input.name],
    level: input.level ?? 0,
    active: input.active,
    source: 'MANUAL',
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.updatedAt).toISOString(),
  };
}

function mapItem(input: CatalogItemApiResponse): CatalogItem {
  return {
    id: input.id,
    categoryId: input.categoryId ?? undefined,
    categoryName: input.categoryName ?? undefined,
    categoryPath: input.categoryPath ?? undefined,
    type: input.type,
    name: input.name,
    description: input.description ?? undefined,
    basePrice:
      input.basePrice == null ? undefined : Number(input.basePrice),
    currency: input.currency,
    tags: input.tags,
    active: input.active,
    source: input.source,
    externalReference: input.externalReference ?? undefined,
    imageUrl: input.imageUrl ?? undefined,
    weightGrams: input.weightGrams ?? null,
    heightCm: input.heightCm ?? null,
    widthCm: input.widthCm ?? null,
    lengthCm: input.lengthCm ?? null,
    attributes: input.attributes ?? {},
    variants: input.variants ?? [],
    optionGroups: input.optionGroups ?? [],
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.updatedAt).toISOString(),
  };
}

export const catalogService = {
  async listCategories(tenantId: string): Promise<CatalogCategory[]> {
    const response = await apiClient.get<CatalogCategoryApiResponse[]>(
      `/tenants/${tenantId}/catalog/categories`,
    );
    return response.map(mapCategory);
  },

  async createCategory(
    tenantId: string,
    input: CreateCatalogCategoryInput,
  ): Promise<CatalogCategory> {
    const response = await apiClient.post<CatalogCategoryApiResponse>(
      `/tenants/${tenantId}/catalog/categories`,
      input,
    );
    return mapCategory(response);
  },

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateCatalogCategoryInput,
  ): Promise<CatalogCategory> {
    const response = await apiClient.put<CatalogCategoryApiResponse>(
      `/tenants/${tenantId}/catalog/categories/${categoryId}`,
      input,
    );
    return mapCategory(response);
  },

  async deleteCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<CatalogCategory> {
    const response = await apiClient.delete<CatalogCategoryApiResponse>(
      `/tenants/${tenantId}/catalog/categories/${categoryId}`,
    );
    return mapCategory(response);
  },

  async listItems(
    tenantId: string,
    filters?: {
      type?: string;
      categoryId?: string;
      query?: string;
      includeInactive?: boolean;
    },
  ): Promise<CatalogItem[]> {
    const response = await apiClient.get<CatalogItemApiResponse[]>(
      `/tenants/${tenantId}/catalog/items`,
      {
        ...filters,
        includeInactive: filters?.includeInactive ? 'true' : undefined,
      } as Record<string, string | number>,
    );
    return response.map(mapItem);
  },

  async listItemOptions(tenantId: string): Promise<CatalogSelectOption[]> {
    const items = await this.listItems(tenantId, { includeInactive: false });
    return items
      .filter((item) => Boolean(item.id))
      .map((item) => ({
        value: item.id!,
        label: item.categoryName ? `${item.name} - ${item.categoryName}` : item.name,
      }));
  },

  async listCategoryOptions(tenantId: string): Promise<CatalogSelectOption[]> {
    const categories = await this.listCategories(tenantId);
    return categories
      .filter((category) => category.active)
      .map((category) => ({
        value: category.id,
        label: Array.isArray(category.path) && category.path.length > 0
          ? category.path.join(' / ')
          : category.name,
      }));
  },

  async createItem(
    tenantId: string,
    input: CreateCatalogItemInput,
  ): Promise<CatalogItem> {
    const response = await apiClient.post<CatalogItemApiResponse>(
      `/tenants/${tenantId}/catalog/items`,
      input,
    );
    return mapItem(response);
  },

  async updateItem(
    tenantId: string,
    itemId: string,
    input: UpdateCatalogItemInput,
  ): Promise<CatalogItem> {
    const response = await apiClient.put<CatalogItemApiResponse>(
      `/tenants/${tenantId}/catalog/items/${itemId}`,
      input,
    );
    return mapItem(response);
  },

  async deactivateItem(tenantId: string, itemId: string): Promise<CatalogItem> {
    const response = await apiClient.post<CatalogItemApiResponse>(
      `/tenants/${tenantId}/catalog/items/${itemId}/deactivate`,
    );
    return mapItem(response);
  },

  async deleteItem(tenantId: string, itemId: string): Promise<CatalogItem> {
    const response = await apiClient.delete<CatalogItemApiResponse>(
      `/tenants/${tenantId}/catalog/items/${itemId}`,
    );
    return mapItem(response);
  },

  async uploadImage(
    tenantId: string,
    file: File,
  ): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post<{ imageUrl: string }>(
      `/tenants/${tenantId}/catalog/upload`,
      formData
    );
  },

  async startReportJob(
    tenantId: string,
    input: GenerateCatalogReportInput,
  ): Promise<CatalogAsyncJob> {
    return apiClient.post<CatalogAsyncJob>(`/tenants/${tenantId}/catalog/report-jobs`, input);
  },

  async generateReportSync(
    tenantId: string,
    input: GenerateCatalogReportInput,
  ): Promise<CatalogSyncReportResponse> {
    return apiClient.post<CatalogSyncReportResponse>(
      `/tenants/${tenantId}/catalog/reports`,
      input,
    );
  },

  async getAsyncJob(tenantId: string, jobId: string): Promise<CatalogAsyncJob> {
    return apiClient.get<CatalogAsyncJob>(`/tenants/${tenantId}/catalog/jobs/${jobId}`);
  },

  async startImportJob(
    tenantId: string,
    input: ImportCatalogItemsInput,
  ): Promise<CatalogAsyncJob> {
    return apiClient.post<CatalogAsyncJob>(`/tenants/${tenantId}/catalog/import-jobs`, input);
  },

  async listAsyncJobs(tenantId: string): Promise<CatalogAsyncJob[]> {
    return apiClient.get<CatalogAsyncJob[]>(`/tenants/${tenantId}/catalog/jobs`);
  },

  async downloadAsyncJobFile(
    tenantId: string,
    jobId: string,
    fallbackFileName?: string,
  ): Promise<void> {
    return authenticatedDownload(
      `/tenants/${tenantId}/catalog/jobs/${jobId}/download`,
      fallbackFileName ?? `catalogo-${jobId}.csv`,
    );
  },
};
