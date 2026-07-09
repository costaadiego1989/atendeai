export interface CatalogMetrics {
  topProducts: Array<{ name: string; sold: number; revenue: number }>;
  lowStockItems: Array<{ name: string; currentStock: number; threshold: number }>;
  pendingOrders: number;
  averageOrderValue: number;
  totalProducts: number;
}

export interface ICatalogMetricsProvider {
  getMetrics(
    tenantId: string,
    period: string,
  ): Promise<CatalogMetrics>;
}

export const CATALOG_METRICS_PROVIDER = Symbol('CATALOG_METRICS_PROVIDER');
