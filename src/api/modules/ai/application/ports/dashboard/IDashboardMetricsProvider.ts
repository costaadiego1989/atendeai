export interface RevenueMetrics {
  totalRevenue: number;
  count: number;
  averageTicket: number;
  comparisonPrevious?: {
    totalRevenue: number;
    count: number;
    percentChange: number;
  };
  breakdown?: Array<{ label: string; value: number; count: number }>;
}

export interface IDashboardMetricsProvider {
  getRevenue(
    tenantId: string,
    period: string,
    groupBy?: string,
  ): Promise<RevenueMetrics>;
}

export const DASHBOARD_METRICS_PROVIDER = Symbol('DASHBOARD_METRICS_PROVIDER');
