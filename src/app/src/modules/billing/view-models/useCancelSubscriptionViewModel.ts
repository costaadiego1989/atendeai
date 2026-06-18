import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { billingService } from '@/modules/billing/services/billing-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

export function useCancelSubscriptionViewModel(tenantId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => billingService.cancelSubscription(tenantId as string),
    onSuccess: () => {
      // Invalidate both caches so they re-fetch the actual post-cancellation
      // plan from the server instead of assuming it always becomes 'ESSENCIAL'.
      void queryClient.invalidateQueries({ queryKey: ['billing-usage', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      toast({
        title: 'Assinatura cancelada',
        description: 'A assinatura recorrente foi cancelada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao cancelar assinatura',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível cancelar a assinatura agora.',
        }),
        variant: 'destructive',
      });
    },
  });
}
