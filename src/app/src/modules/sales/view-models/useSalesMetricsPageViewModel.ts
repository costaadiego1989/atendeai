import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/modules/dashboard/services/dashboard-service';
import { salesPaymentLinksService } from '@/modules/sales/services/sales-payment-links-service';
import { recoveryService } from '@/modules/recovery/services/RecoveryService';
import { buildCommercialRevenueSnapshot } from '@/shared/commercial/commercial-metrics';
import { useAuthStore } from '@/shared/stores/auth-store';

type MetricsRange = '7d' | '30d' | '90d';

export interface SalesFunnelStep {
  id: string;
  label: string;
  count: number;
  helper: string;
  amount?: number;
}

export function useSalesMetricsPageViewModel() {
  const [range, setRange] = useState<MetricsRange>('30d');
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics', 'sales', tenant?.id, range, activeBranchId ?? 'tenant'],
    enabled: Boolean(tenant?.id),
    queryFn: () => dashboardService.getMetrics(tenant!.id, range, activeBranchId),
  });

  const recentChargesQuery = useQuery({
    queryKey: ['sales-metrics-recent-links', activeBranchId ?? 'tenant'],
    queryFn: () =>
      salesPaymentLinksService.listPaymentLinks({
        page: 1,
        pageSize: 6,
        branchId: activeBranchId,
      }),
  });

  const recoveryCasesQuery = useQuery({
    queryKey: ['sales-metrics-recovery-cases', tenant?.id, activeBranchId ?? 'tenant'],
    enabled: Boolean(tenant?.id),
    queryFn: () => recoveryService.listCases(tenant!.id, { branchId: activeBranchId ?? undefined }),
  });

  const metrics = metricsQuery.data?.salesMetrics.metrics ?? [];
  const summary = metricsQuery.data?.salesMetrics.summary ?? {
    totalMessages: 0,
    totalIntents: 0,
    totalLinks: 0,
    totalRevenue: 0,
  };
  const paymentSummary = metricsQuery.data?.paymentSummary ?? recentChargesQuery.data?.summary ?? {
    totalLinks: 0,
    activeLinks: 0,
    pausedLinks: 0,
    paidLinks: 0,
    expiredLinks: 0,
    estimatedRevenue: 0,
    paidRevenue: 0,
  };
  const recentCharges = recentChargesQuery.data?.items ?? [];
  const recoveryCases = recoveryCasesQuery.data ?? [];
  const commercialRevenue = buildCommercialRevenueSnapshot(paymentSummary, recoveryCases);

  const chartData = useMemo(
    () =>
      metrics.map((item) => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        receita: item.estimatedRevenue,
        intents: item.purchaseIntents,
        links: item.paymentLinksGenerated,
        mensagens: item.totalMessages,
      })),
    [metrics],
  );

  const intentRate =
    summary.totalMessages > 0
      ? (summary.totalIntents / summary.totalMessages) * 100
      : 0;
  const checkoutRate =
    summary.totalIntents > 0
      ? (summary.totalLinks / summary.totalIntents) * 100
      : 0;
  const averageTicket =
    summary.totalLinks > 0 ? summary.totalRevenue / summary.totalLinks : 0;
  const paidShare =
    paymentSummary.estimatedRevenue > 0
      ? (paymentSummary.paidRevenue / paymentSummary.estimatedRevenue) * 100
      : 0;
  const newSaleShare =
    paymentSummary.estimatedRevenue > 0
      ? (commercialRevenue.newSaleRevenue / paymentSummary.estimatedRevenue) * 100
      : 0;

  const bestDay = useMemo(() => {
    if (!metrics.length) return null;
    return metrics.reduce((best, current) =>
      current.estimatedRevenue > best.estimatedRevenue ? current : best,
    );
  }, [metrics]);

  const statusCards = [
    {
      label: 'Pagas',
      value: paymentSummary.paidLinks,
      tone: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Ativas',
      value: paymentSummary.activeLinks,
      tone: 'text-sky-700',
      bg: 'bg-sky-50 border-sky-200',
    },
    {
      label: 'Pausadas',
      value: paymentSummary.pausedLinks,
      tone: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
    },
    {
      label: 'Expiradas',
      value: paymentSummary.expiredLinks,
      tone: 'text-slate-700',
      bg: 'bg-slate-50 border-slate-200',
    },
  ] as const;
  const salesFunnel: SalesFunnelStep[] = [
    {
      id: 'messages',
      label: 'Mensagens comerciais',
      count: summary.totalMessages,
      helper: 'Entrada total do radar comercial no periodo.',
    },
    {
      id: 'intents',
      label: 'Intencoes de compra',
      count: summary.totalIntents,
      helper: `${intentRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da base evoluiu para oportunidade.`,
    },
    {
      id: 'checkouts',
      label: 'Checkouts emitidos',
      count: summary.totalLinks,
      helper: `${checkoutRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das intencoes viraram Cobrança.`,
      amount: summary.totalRevenue,
    },
    {
      id: 'paid',
      label: 'Pagos',
      count: paymentSummary.paidLinks,
      helper: `${paidShare.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da receita ja foi capturada.`,
      amount: commercialRevenue.newSaleRevenue,
    },
  ];

  return {
    range,
    setRange,
    metricsQuery,
    recentChargesQuery,
    recoveryCasesQuery,
    summary,
    paymentSummary,
    commercialRevenue,
    recentCharges,
    chartData,
    intentRate,
    checkoutRate,
    averageTicket,
    paidShare,
    newSaleShare,
    bestDay,
    statusCards,
    salesFunnel,
    rangeLabel:
      range === '7d'
        ? 'ultimos 7 dias'
        : range === '30d'
          ? 'ultimos 30 dias'
          : 'ultimos 90 dias',
  };
}

export type SalesMetricsPageViewModel = ReturnType<
  typeof useSalesMetricsPageViewModel
>;
