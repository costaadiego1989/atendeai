export interface RecoveryMetrics {
  totalOpen: number;
  totalRecovered: number;
  conversionRate: number;
  topDebtors: Array<{ name: string; amount: number; daysOverdue: number }>;
  scheduledCollections: number;
  comparisonPrevious?: {
    totalRecovered: number;
    percentChange: number;
  };
}

export interface IRecoveryMetricsProvider {
  getMetrics(
    tenantId: string,
    period: string,
  ): Promise<RecoveryMetrics>;
}

export const RECOVERY_METRICS_PROVIDER = Symbol('RECOVERY_METRICS_PROVIDER');
