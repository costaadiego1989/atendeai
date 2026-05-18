import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { billingService } from '@/modules/billing/services/billing-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

interface ChangePlanParams {
  targetPlan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA';
  billingCycle?: 'MONTHLY' | 'YEARLY';
}

interface UseChangeBillingPlanViewModelOptions {
  onCheckoutRequired?: (result: {
    tenantId: string;
    plan: string;
    currentPlan: string;
    targetPlan: string;
    status: string;
    mode: 'NO_CHANGE' | 'CHECKOUT_REQUIRED' | 'DOWNGRADE_SCHEDULED';
    checkoutUrl?: string;
    effectiveAt?: string;
  }) => void;
}

export function useChangeBillingPlanViewModel(
  tenantId?: string,
  options?: UseChangeBillingPlanViewModelOptions,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ChangePlanParams | 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA') => {
      const resolved = typeof params === 'string'
        ? { targetPlan: params, billingCycle: undefined }
        : params;
      return billingService.changePlan(
        tenantId as string,
        resolved.targetPlan,
        resolved.billingCycle,
      );
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['billing-usage', tenantId] });

      if (result.mode === 'CHECKOUT_REQUIRED' && result.checkoutUrl) {
        toast({
          title: 'Redirecionando para cobrança',
          description: `Vamos abrir o checkout do Asaas em uma nova aba para concluir o upgrade para ${result.targetPlan}.`,
        });
        options?.onCheckoutRequired?.(result);
        return;
      }

      if (result.mode === 'DOWNGRADE_SCHEDULED') {
        toast({
          title: 'Downgrade agendado',
          description: result.effectiveAt
            ? `O plano ${result.targetPlan} será aplicado no próximo ciclo, em ${new Date(result.effectiveAt).toLocaleDateString('pt-BR')}.`
            : `O plano ${result.targetPlan} foi agendado para o próximo ciclo.`,
        });
        return;
      }

      toast({
        title: 'Plano mantido',
        description: `A assinatura permanece no plano ${result.plan}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao alterar plano',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível alterar o plano agora.',
        }),
        variant: 'destructive',
      });
    },
  });
}
