import { useQuery } from '@tanstack/react-query';
import { billingService } from '@/modules/billing/services/billing-service';

export function useBillingUsageQuery(tenantId?: string) {
  return useQuery({
    queryKey: ['billing-usage', tenantId],
    queryFn: () => billingService.getUsage(tenantId as string),
    enabled: Boolean(tenantId),
  });
}
