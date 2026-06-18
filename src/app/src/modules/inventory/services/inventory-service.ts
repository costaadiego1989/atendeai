import { apiClient } from '@/shared/api/client';
import { authenticatedDownload } from '@/shared/lib/file-download';
import type {
  InventoryAsyncJob,
  InventoryConnection,
  InventoryConnectionSourceType,
  InventoryItemRecord,
} from '@/shared/types';

interface InventoryItemApiResponse {
  id: string;
  catalogItemId?: string | null;
  sku: string;
  externalReference?: string | null;
  name: string;
  availableQuantity: number;
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice?: string | number | null;
  currency: string;
  source:
    | 'MANUAL_SNAPSHOT'
    | 'CSV_IMPORT'
    | 'IMPORT_SNAPSHOT'
    | 'ERP_SYNC'
    | 'PDV_SYNC'
    | 'ECOMMERCE_SYNC';
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryConnectionApiResponse {
  id: string;
  sourceType: InventoryConnectionSourceType | string;
  providerName: string;
  status: 'ACTIVE' | 'PENDING' | 'FAILED';
  config?: Record<string, unknown>;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncInventoryItemInput {
  catalogItemId?: string;
  sku: string;
  externalReference?: string;
  name: string;
  availableQuantity: number;
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice?: string;
  currency?: string;
  source?:
    | 'MANUAL_SNAPSHOT'
    | 'CSV_IMPORT'
    | 'IMPORT_SNAPSHOT'
    | 'ERP_SYNC'
    | 'PDV_SYNC'
    | 'ECOMMERCE_SYNC';
}

export interface CreateInventoryConnectionInput {
  sourceType: InventoryConnectionSourceType | string;
  providerName: string;
  config?: Record<string, unknown>;
}

export interface GenerateInventoryReportInput {
  query?: string;
  availableOnly?: boolean;
  statuses?: Array<'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'>;
}

export interface InventorySyncReportSummary {
  totalItems: number;
  totalQuantity: number;
  availableItems: number;
  lowStockItems: number;
  unavailableItems: number;
  reservedItems: number;
  estimatedInventoryValue?: number;
}

export interface InventorySyncReportResponse {
  generatedAt: string;
  summary: InventorySyncReportSummary;
  items: unknown[];
}

function asInventoryJobsArray(
  response: InventoryAsyncJob[] | { data?: InventoryAsyncJob[] } | null | undefined,
): InventoryAsyncJob[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return [];
}

function mapItem(input: InventoryItemApiResponse): InventoryItemRecord {
  return {
    id: input.id,
    catalogItemId: input.catalogItemId ?? undefined,
    sku: input.sku,
    externalReference: input.externalReference ?? undefined,
    name: input.name,
    availableQuantity: input.availableQuantity,
    availabilityStatus: input.availabilityStatus,
    currentPrice: input.currentPrice == null ? undefined : Number(input.currentPrice),
    currency: input.currency,
    source: input.source === 'IMPORT_SNAPSHOT' ? 'CSV_IMPORT' : input.source,
    lastSyncedAt: new Date(input.lastSyncedAt).toISOString(),
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.updatedAt).toISOString(),
  };
}

function mapConnection(input: InventoryConnectionApiResponse): InventoryConnection {
  return {
    id: input.id,
    sourceType: input.sourceType,
    providerName: input.providerName,
    status: input.status,
    configSummary: input.config
      ? Object.entries(input.config)
          .slice(0, 2)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(' | ')
      : undefined,
    lastSyncedAt: input.lastSyncedAt ? new Date(input.lastSyncedAt).toISOString() : undefined,
  };
}

export const inventoryService = {
  async listItems(
    tenantId: string,
    filters?: { query?: string; availableOnly?: boolean },
  ): Promise<InventoryItemRecord[]> {
    const params: Record<string, string | number | undefined> = {};
    if (filters?.query) {
      params.query = filters.query;
    }
    if (filters?.availableOnly !== undefined) {
      params.availableOnly = filters.availableOnly ? 'true' : 'false';
    }

    const response = await apiClient.get<InventoryItemApiResponse[]>(
      `/tenants/${tenantId}/inventory/items`,
      Object.keys(params).length > 0 ? params : undefined,
    );
    return response.map(mapItem);
  },

  async syncItem(
    tenantId: string,
    input: SyncInventoryItemInput,
  ): Promise<InventoryItemRecord> {
    const response = await apiClient.post<InventoryItemApiResponse>(
      `/tenants/${tenantId}/inventory/items/sync`,
      input,
    );
    return mapItem(response);
  },

  async listConnections(tenantId: string): Promise<InventoryConnection[]> {
    const response = await apiClient.get<InventoryConnectionApiResponse[]>(
      `/tenants/${tenantId}/inventory/connections`,
    );
    return response.map(mapConnection);
  },

  async createConnection(
    tenantId: string,
    input: CreateInventoryConnectionInput,
  ): Promise<InventoryConnection> {
    const response = await apiClient.post<InventoryConnectionApiResponse>(
      `/tenants/${tenantId}/inventory/connections`,
      input,
    );
    return mapConnection(response);
  },

  async syncConnectionNow(tenantId: string, connectionId: string): Promise<void> {
    await apiClient.post<void>(
      `/tenants/${tenantId}/inventory/connections/${connectionId}/sync`,
      {},
    );
  },

  async startReportJob(
    tenantId: string,
    input: GenerateInventoryReportInput,
  ): Promise<InventoryAsyncJob> {
    return apiClient.post<InventoryAsyncJob>(`/tenants/${tenantId}/inventory/report-jobs`, input);
  },

  async generateReportSync(
    tenantId: string,
    input: GenerateInventoryReportInput,
  ): Promise<InventorySyncReportResponse> {
    return apiClient.post<InventorySyncReportResponse>(
      `/tenants/${tenantId}/inventory/reports`,
      input,
    );
  },

  async getAsyncJob(tenantId: string, jobId: string): Promise<InventoryAsyncJob> {
    return apiClient.get<InventoryAsyncJob>(`/tenants/${tenantId}/inventory/jobs/${jobId}`);
  },

  async listAsyncJobs(tenantId: string): Promise<InventoryAsyncJob[]> {
    const response = await apiClient.get<
      InventoryAsyncJob[] | { data?: InventoryAsyncJob[] }
    >(`/tenants/${tenantId}/inventory/jobs`);
    return asInventoryJobsArray(response);
  },

  async downloadAsyncJobFile(
    tenantId: string,
    jobId: string,
    fallbackFileName?: string,
  ): Promise<void> {
    return authenticatedDownload(
      `/tenants/${tenantId}/inventory/jobs/${jobId}/download`,
      fallbackFileName ?? `estoque-${jobId}.csv`,
    );
  },
};
