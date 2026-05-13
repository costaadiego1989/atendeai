import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { billingService } from '@/modules/billing/services/billing-service';

const CHECKOUT_POLL_INTERVAL_MS = 4000;
const CHECKOUT_POLL_MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useAddonPackageViewModel(tenantId?: string) {
  const queryClient = useQueryClient();
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const pollStartRef = useRef<number>(0);

  const infoQuery = useQuery({
    queryKey: ['billing-addon-package', tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => billingService.getAddonPackageInfo(tenantId!),
    staleTime: 1000 * 60 * 5,
    // Poll faster while awaiting payment confirmation
    refetchInterval: awaitingPayment ? CHECKOUT_POLL_INTERVAL_MS : false,
  });

  // Detect payment confirmation: when addon becomes active after purchase
  useEffect(() => {
    if (!awaitingPayment) return;

    if (infoQuery.data?.active) {
      setAwaitingPayment(false);
      toast({
        title: 'Pagamento confirmado',
        description: 'O pacote adicional foi ativado. Suas quotas já estão atualizadas.',
      });
      void queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-subscription-catalog'] });
      return;
    }

    // Stop polling after max duration
    if (Date.now() - pollStartRef.current > CHECKOUT_POLL_MAX_DURATION_MS) {
      setAwaitingPayment(false);
    }
  }, [awaitingPayment, infoQuery.data?.active, queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: () => billingService.purchaseAddonPackage(tenantId!),
    onSuccess: (result) => {
      if (result.mode === 'CHECKOUT_REQUIRED' && result.checkoutUrl) {
        const opened = window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.assign(result.checkoutUrl);
        }
        toast({
          title: 'Checkout aberto',
          description:
            'A cobrança do pacote adicional foi aberta em outra aba. Após o pagamento, as quotas serão atualizadas.',
        });

        // Start polling for payment confirmation
        pollStartRef.current = Date.now();
        setAwaitingPayment(true);
      }

      void queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-addon-package'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-subscription-catalog'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao contratar pacote',
        description: 'Não foi possível iniciar a contratação do pacote adicional. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelAddonPackage(tenantId!),
    onSuccess: () => {
      toast({
        title: 'Pacote cancelado',
        description: 'O pacote adicional foi cancelado e as quotas voltaram ao valor base.',
      });

      void queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-addon-package'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-subscription-catalog'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao cancelar pacote',
        description: 'Não foi possível cancelar o pacote adicional. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  return {
    info: infoQuery.data ?? null,
    isLoading: infoQuery.isLoading,
    isAvailable: infoQuery.data?.available ?? false,
    isActive: infoQuery.data?.active ?? false,
    awaitingPayment,
    packageDetails: infoQuery.data?.package ?? null,
    purchase: purchaseMutation.mutate,
    cancel: cancelMutation.mutate,
    isPurchasing: purchaseMutation.isPending,
    isCanceling: cancelMutation.isPending,
  };
}
