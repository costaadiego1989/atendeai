import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { billingService } from '@/modules/billing/services/billing-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';

export function useCancelSubscriptionViewModel(tenantId?: string) {
  const queryClient = useQueryClient();
  const { updateTenant } = useAuthStore();

  return useMutation({
    mutationFn: () => billingService.cancelSubscription(tenantId as string),
    onSuccess: () => {
      updateTenant({ plan: 'ESSENCIAL' });
      void queryClient.invalidateQueries({ queryKey: ['billing-usage', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      toast({
        title: 'Assinatura cancelada',
        description: 'A assinatura recorrente foi cancelada e o tenant voltou para o plano Essencial.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao cancelar assinatura',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel cancelar a assinatura agora.',
        }),
        variant: 'destructive',
      });
    },
  });
}
