import { useQuery } from '@tanstack/react-query';
import { billingService } from '@/modules/billing/services/billing-service';

export function useBillingPlansQuery(tenantId?: string) {
  return useQuery({
    queryKey: ['billing-plans', tenantId],
    queryFn: () => billingService.listPlans(tenantId as string),
    enabled: Boolean(tenantId),
  });
}
