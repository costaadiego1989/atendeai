import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { useBillingUsageQuery } from '@/modules/billing/view-models/useBillingUsageQuery';
import { useBillingPlansQuery } from '@/modules/billing/view-models/useBillingPlansQuery';
import { billingService } from '@/modules/billing/services/billing-service';
import { useChangeBillingPlanViewModel } from '@/modules/billing/view-models/useChangeBillingPlanViewModel';
import { useCancelSubscriptionViewModel } from '@/modules/billing/view-models/useCancelSubscriptionViewModel';
import type { BillingPlan } from '@/shared/types';
import type {
  BillingAdvisorAnswers,
  BillingAdvisorField,
} from '@/modules/billing/view-models/billing-commercial-helpers';
import {
  buildBillingAdvisorQuestions,
  buildBillingRecommendation,
  buildDefaultAdvisorAnswers,
} from '@/modules/billing/view-models/billing-commercial-helpers';
import type { BillingCycle } from '@/modules/billing/view-models/billing-pricing-helpers';

export function useBillingPageViewModel() {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [pendingCheckoutPlanCode, setPendingCheckoutPlanCode] = useState<string | null>(null);
  const [waitingCheckoutOpen, setWaitingCheckoutOpen] = useState(false);
  const [advisorAnswers, setAdvisorAnswers] = useState<BillingAdvisorAnswers | null>(null);
  const checkoutWindowRef = useRef<Window | null>(null);
  const checkoutToastShownRef = useRef(false);
  const popupBlockedRef = useRef(false);
  const { tenant, updateTenant } = useAuthStore();

  const usageQuery = useBillingUsageQuery(tenant?.id);
  const plansQuery = useBillingPlansQuery(tenant?.id);

  const subscriptionCatalogQuery = useQuery({
    queryKey: ['billing-subscription-catalog', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => billingService.getSubscriptionCatalog(tenant!.id),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  useEffect(() => {
    setAdvisorAnswers(null);
  }, [tenant?.id]);

  useEffect(() => {
    if (!plansQuery.data?.length) {
      return;
    }

    setAdvisorAnswers((current) =>
      current ??
      buildDefaultAdvisorAnswers(
        plansQuery.data,
        usageQuery.data,
        subscriptionCatalogQuery.data,
      ),
    );
  }, [plansQuery.data, subscriptionCatalogQuery.data, usageQuery.data]);

  const effectiveAdvisorAnswers = useMemo(() => {
    if (!plansQuery.data?.length) {
      return null;
    }

    return (
      advisorAnswers ??
      buildDefaultAdvisorAnswers(
        plansQuery.data,
        usageQuery.data,
        subscriptionCatalogQuery.data,
      )
    );
  }, [advisorAnswers, plansQuery.data, subscriptionCatalogQuery.data, usageQuery.data]);

  const updateAdvisorAnswer = <K extends keyof BillingAdvisorAnswers>(
    key: K,
    value: BillingAdvisorAnswers[K],
  ) => {
    setAdvisorAnswers((current) => ({
      ...(current ??
        effectiveAdvisorAnswers ?? {
          conversationsBand: 'LOW',
          contactsBand: 'LOW',
          operationMode: 'LEAN',
        }),
      [key]: value,
    }));
  };

  const setConversationsBand = (value: BillingAdvisorAnswers['conversationsBand']) => {
    updateAdvisorAnswer('conversationsBand', value);
  };

  const setContactsBand = (value: BillingAdvisorAnswers['contactsBand']) => {
    updateAdvisorAnswer('contactsBand', value);
  };

  const setOperationMode = (value: BillingAdvisorAnswers['operationMode']) => {
    updateAdvisorAnswer('operationMode', value);
  };

  const resetAdvisorAnswers = () => {
    if (!plansQuery.data?.length) {
      return;
    }

    setAdvisorAnswers(
      buildDefaultAdvisorAnswers(
        plansQuery.data,
        usageQuery.data,
        subscriptionCatalogQuery.data,
      ),
    );
  };

  const openPlansComparison = () => {
    const plansSection = document.getElementById('plans-comparison');
    plansSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const openRecommendedPlan = () => {
    if (!derivedRecommendation?.recommendedPlan) {
      openPlansComparison();
      return;
    }

    setSelectedPlan(derivedRecommendation.recommendedPlan);
    openPlansComparison();
  };

  const derivedRecommendation = useMemo(() => {
    if (!plansQuery.data?.length || !effectiveAdvisorAnswers) {
      return null;
    }

    return buildBillingRecommendation(
      plansQuery.data,
      subscriptionCatalogQuery.data,
      effectiveAdvisorAnswers,
    );
  }, [effectiveAdvisorAnswers, plansQuery.data, subscriptionCatalogQuery.data]);

  const advisorQuestions = useMemo(
    () =>
      effectiveAdvisorAnswers
        ? buildBillingAdvisorQuestions(effectiveAdvisorAnswers)
        : [],
    [effectiveAdvisorAnswers],
  );

  const addonSummary = useMemo(() => {
    const subscribedAddons =
      subscriptionCatalogQuery.data?.availableAddons.filter((addon) => addon.subscribed) ?? [];
    const includedAddons =
      subscriptionCatalogQuery.data?.availableAddons.filter((addon) => addon.includedInPlan) ?? [];

    return {
      subscribedAddons,
      includedAddons,
      activeAddonInvestment:
        subscriptionCatalogQuery.data?.subscription.pricing.addonsMonthlyPrice ?? 0,
    };
  }, [subscriptionCatalogQuery.data]);

  const changePlanMutation = useChangeBillingPlanViewModel(tenant?.id, {
    onCheckoutRequired: (result) => {
      if (result.checkoutUrl) {
        if (checkoutWindowRef.current && !checkoutWindowRef.current.closed) {
          checkoutWindowRef.current.location.href = result.checkoutUrl;
        } else {
          const opened = window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer');
          if (!opened) {
            // fallback para não "parecer que não funciona" quando o browser bloqueia pop-up
            window.location.assign(result.checkoutUrl);
          }
        }
      }
      setPendingCheckoutPlanCode(result.targetPlan);
      setWaitingCheckoutOpen(true);
      if (!checkoutToastShownRef.current) {
        toast({
          title: 'Checkout aberto',
          description:
            'A cobrança foi aberta em outra aba. Assim que o pagamento for confirmado, o plano será atualizado aqui.',
        });
        checkoutToastShownRef.current = true;
      }
    },
  });
  const cancelSubscriptionMutation = useCancelSubscriptionViewModel(tenant?.id);

  useEffect(() => {
    if (!waitingCheckoutOpen || !pendingCheckoutPlanCode || !tenant?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      void usageQuery.refetch();
      void plansQuery.refetch();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [
    pendingCheckoutPlanCode,
    plansQuery,
    tenant?.id,
    usageQuery,
    waitingCheckoutOpen,
  ]);

  useEffect(() => {
    if (!pendingCheckoutPlanCode || !usageQuery.data) {
      return;
    }

    if (usageQuery.data.plan !== pendingCheckoutPlanCode) {
      return;
    }

    updateTenant({ plan: pendingCheckoutPlanCode });
    setWaitingCheckoutOpen(false);
    setPendingCheckoutPlanCode(null);
    checkoutToastShownRef.current = false;
    if (checkoutWindowRef.current && !checkoutWindowRef.current.closed) {
      checkoutWindowRef.current.close();
    }
    toast({
      title: 'Pagamento confirmado',
      description: `O plano da empresa foi atualizado para ${usageQuery.data.plan}.`,
    });
  }, [pendingCheckoutPlanCode, updateTenant, usageQuery.data]);

  const derived = useMemo(() => {
    if (!usageQuery.data || !plansQuery.data) {
      return null;
    }

    const usage = usageQuery.data;
    const billingPlans = plansQuery.data;
    const currentPlanDefinition = billingPlans.find((plan) => plan.code === usage.plan);
    const currentPlanRank = currentPlanDefinition?.sortOrder ?? 0;
    const selectedPlanRelation =
      selectedPlan && selectedPlan.sortOrder > currentPlanRank ? 'upgrade' : 'downgrade';

    const messagePercent =
      usage.messages.quota > 0 ? (usage.messages.used / usage.messages.quota) * 100 : 0;
    const aiPercent =
      usage.aiTokens.quota > 0 ? (usage.aiTokens.used / usage.aiTokens.quota) * 100 : 0;
    const contactsPercent =
      usage.contacts.quota > 0 ? (usage.contacts.used / usage.contacts.quota) * 100 : 0;

    const currentPlan = billingPlans.find((plan) => plan.code === usage.plan);
    const hasContractedPlan = usage.plan !== 'TRIAL' && tenant?.planStatus !== 'TRIALING';

    return {
      usage,
      billingPlans,
      currentPlanDefinition: currentPlan,
      currentPlanRank,
      selectedPlanRelation,
      messagePercent,
      aiPercent,
      contactsPercent,
      tenantNiche: subscriptionCatalogQuery.data?.niche ?? null,
      recommendedModules: derivedRecommendation?.primaryAddons ?? [],
      optionalModules: derivedRecommendation?.optionalAddons ?? [],
      recommendation: derivedRecommendation,
      advisorAnswers: effectiveAdvisorAnswers,
      advisorQuestions,
      currentAddonInvestment: addonSummary.activeAddonInvestment,
      subscribedAddons: addonSummary.subscribedAddons,
      includedAddons: addonSummary.includedAddons,
      subscriptionPricing: subscriptionCatalogQuery.data?.subscription.pricing ?? null,
      hasContractedPlan,
      shouldShowCommercialAdvisor: !hasContractedPlan,
    };
  }, [
    addonSummary.activeAddonInvestment,
    addonSummary.includedAddons,
    addonSummary.subscribedAddons,
    derivedRecommendation,
    effectiveAdvisorAnswers,
    advisorQuestions,
    plansQuery.data,
    selectedPlan,
    subscriptionCatalogQuery.data,
    usageQuery.data,
    tenant?.planStatus,
  ]);

  const isLoading =
    !tenant?.id ||
    (usageQuery.isLoading && !usageQuery.data) ||
    (plansQuery.isLoading && !plansQuery.data) ||
    (subscriptionCatalogQuery.isLoading && !subscriptionCatalogQuery.data);

  const hasError =
    usageQuery.isError ||
    plansQuery.isError ||
    !usageQuery.data ||
    !plansQuery.data ||
    !derived;

  const setAdvisorField = (field: BillingAdvisorField, value: string) => {
    if (!effectiveAdvisorAnswers) {
      return;
    }

    if (field === 'conversationsBand') {
      setConversationsBand(value as BillingAdvisorAnswers['conversationsBand']);
      return;
    }

    if (field === 'contactsBand') {
      setContactsBand(value as BillingAdvisorAnswers['contactsBand']);
      return;
    }

    setOperationMode(value as BillingAdvisorAnswers['operationMode']);
  };

  const exportUsageCsv = () => {
    if (!tenant?.id) {
      return;
    }

    billingService.downloadUsageExportCsv(tenant.id).then(() => {
      toast({
        title: 'Exportação concluída',
        description: 'O arquivo CSV foi baixado com sucesso.',
      });
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Não foi possível exportar o CSV.';
      toast({
        title: 'Falha na exportação',
        description: message,
        variant: 'destructive',
      });
    });
  };

  return {
    tenant,
    cancelOpen,
    setCancelOpen,
    waitingCheckoutOpen,
    setWaitingCheckoutOpen,
    pendingCheckoutPlanCode,
    selectedPlan,
    setSelectedPlan,
    usageQuery,
    plansQuery,
    subscriptionCatalogQuery,
    changePlanMutation,
    cancelSubscriptionMutation,
    isLoading,
    hasError,
    setConversationsBand,
    setContactsBand,
    setOperationMode,
    resetAdvisorAnswers,
    openPlansComparison,
    openRecommendedPlan,
    ...(derived ?? {}),
    confirmCancel() {
      cancelSubscriptionMutation.mutate();
      setCancelOpen(false);
    },
    setAdvisorField,
    exportUsageCsv,
    confirmSelectedPlan(billingCycle?: BillingCycle) {
      if (!selectedPlan) return;

      try {
        const relation = derived?.selectedPlanRelation ?? 'downgrade';

        if (relation === 'upgrade') {
          checkoutWindowRef.current = window.open('', '_blank');
          if (checkoutWindowRef.current) {
            checkoutWindowRef.current.document.write(
              '<p style="font-family: Arial, sans-serif; padding: 24px;">Abrindo checkout do Asaas...</p>',
            );
            popupBlockedRef.current = false;
          } else {
            popupBlockedRef.current = true;
            toast({
              title: 'Abrindo checkout',
              description:
                'Seu navegador bloqueou o pop-up. Vamos abrir o checkout nesta aba para concluir a assinatura.',
            });
          }
          toast({
            title: 'Contratação iniciada',
            description: `Estamos preparando o checkout para o plano ${selectedPlan.displayName}.`,
          });
        } else if (selectedPlan.code === usageQuery.data?.plan) {
          toast({
            title: 'Plano já ativo',
            description: `A assinatura já está no plano ${selectedPlan.displayName}.`,
          });
        } else {
          toast({
            title: 'Plano confirmado',
            description: `A alteração para ${selectedPlan.displayName} será aplicada no próximo ciclo.`,
          });
        }

        if (
          selectedPlan.code !== 'ESSENCIAL' &&
          selectedPlan.code !== 'PROFISSIONAL' &&
          selectedPlan.code !== 'ESCALA'
        ) {
          toast({
            title: 'Plano não elegível para alteração aqui',
            description: 'Este fluxo só aceita os planos Essencial, Profissional ou Escala.',
            variant: 'destructive',
          });
          return;
        }

        const apiCycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
        changePlanMutation.mutate({
          targetPlan: selectedPlan.code,
          billingCycle: apiCycle,
        });
        setSelectedPlan(null);
      } catch {
        toast({
          title: 'Falha ao confirmar plano',
          description: 'Não foi possível iniciar a alteração de plano.',
          variant: 'destructive',
        });
      }
    },
    async refreshBillingStatus() {
      const [usageResult] = await Promise.all([
        usageQuery.refetch(),
        plansQuery.refetch(),
      ]);

      if (
        pendingCheckoutPlanCode &&
        usageResult.data?.plan !== pendingCheckoutPlanCode
      ) {
        toast({
          title: 'Ainda aguardando webhook',
          description:
            'O pagamento pode ja ter sido feito, mas a confirmação do Asaas ainda não chegou ao sistema.',
        });
      }
    },
  };
}
