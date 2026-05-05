import { apiClient } from '@/shared/api/client';
import type { SalesMetricsSnapshot } from './sales-types';

export const salesMetricsService = {
  getMetrics(
    startDate: string,
    endDate: string,
    branchId?: string | null,
  ): Promise<SalesMetricsSnapshot> {
    return apiClient.get('/sales/metrics', {
      startDate,
      endDate,
      branchId: branchId ?? undefined,
    });
  },
};
