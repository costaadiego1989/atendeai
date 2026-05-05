import { useQuery } from '@tanstack/react-query';
import { billingService } from '@/modules/billing/services/billing-service';

export function usePublicBillingPlansQuery() {
  return useQuery({
    queryKey: ['public-billing-plans'],
    queryFn: () => billingService.listPublicPlans(),
    staleTime: 1000 * 60 * 30,
  });
}
