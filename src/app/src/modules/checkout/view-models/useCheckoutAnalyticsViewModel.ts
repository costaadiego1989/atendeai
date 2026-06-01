import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { checkoutService } from '@/modules/checkout/services/checkout-service';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { CommerceOrderStatus, CommerceSessionItem } from '@/shared/types';
import type { CheckoutOrderListItem } from '@/modules/checkout/services/checkout-service';
import type { CheckoutPeriodRange } from './useCheckoutOrdersViewModel';

export type CheckoutReportStatusFilter = CommerceOrderStatus | 'ALL';

type CheckoutOrderWithItems = {
  items?: CommerceSessionItem[];
  sessionItems?: CommerceSessionItem[];
};

export type CheckoutKpiDeltas = {
  openCount?: number;
  awaitingPaymentCount?: number;
  waitingRevenue?: number;
  paidRevenue?: number;
};

export type DailyRevenuePoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
};

const CHECKOUT_REPORT_STATUS_OPTIONS: Array<{
  value: CheckoutReportStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'AWAITING_PAYMENT', label: 'Aguardando pagamento' },
  { value: 'PAID', label: 'Pedido pago' },
  { value: 'PREPARING', label: 'Em preparo' },
  { value: 'READY_FOR_PICKUP', label: 'Pronto/separado' },
  { value: 'OUT_FOR_DELIVERY', label: 'Enviado/entrega' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const dayLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

function computeDelta(current: number, previous: number): number | undefined {
  if (previous <= 0) {
    return current > 0 ? 100 : undefined;
  }
  return Math.round(((current - previous) / previous) * 100);
}

interface UseCheckoutAnalyticsViewModelArgs {
  allOrders: CheckoutOrderListItem[];
  ordersPeriodRange: CheckoutPeriodRange;
}

export function useCheckoutAnalyticsViewModel({
  allOrders,
  ordersPeriodRange,
}: UseCheckoutAnalyticsViewModelArgs) {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);

  const [reportsOpen, setReportsOpenState] = useState(false);
  const [reportFilters, setReportFilters] = useState(() => ({
    dateFrom: new Date(ordersPeriodRange.dateFrom).toISOString().slice(0, 10),
    dateTo: new Date(ordersPeriodRange.dateTo).toISOString().slice(0, 10),
    status: 'ALL' as CheckoutReportStatusFilter,
  }));

  useEffect(() => {
    if (reportsOpen) return;
    setReportFilters({
      dateFrom: new Date(ordersPeriodRange.dateFrom).toISOString().slice(0, 10),
      dateTo: new Date(ordersPeriodRange.dateTo).toISOString().slice(0, 10),
      status: 'ALL',
    });
  }, [ordersPeriodRange.dateFrom, ordersPeriodRange.dateTo, reportsOpen]);

  const downloadReportMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) return;
      await checkoutService.downloadOrdersReport(tenant.id, {
        branchId: activeBranchId,
        dateFrom: reportFilters.dateFrom
          ? new Date(`${reportFilters.dateFrom}T00:00:00.000Z`).toISOString()
          : ordersPeriodRange.dateFrom,
        dateTo: reportFilters.dateTo
          ? new Date(`${reportFilters.dateTo}T23:59:59.000Z`).toISOString()
          : ordersPeriodRange.dateTo,
        status: reportFilters.status !== 'ALL' ? reportFilters.status : undefined,
      });
    },
    onSuccess: () => {
      setReportsOpenState(false);
      toast({
        title: 'Relatório gerado',
        description: 'O download do CSV do checkout foi iniciado com os filtros selecionados.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao gerar relatório',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível gerar o relatório de pedidos.',
        }),
      });
    },
  });

  const summary = useMemo(() => {
    const awaitingPayment = allOrders.filter((order) => order.status === 'AWAITING_PAYMENT');
    const paid = allOrders.filter((order) => order.status === 'PAID');
    const open = allOrders.filter((order) =>
      ['AWAITING_PAYMENT', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(
        order.status,
      ),
    );

    return {
      openCount: open.length,
      awaitingPaymentCount: awaitingPayment.length,
      waitingRevenue: awaitingPayment.reduce(
        (total, order) => total + Number(order.totalAmount),
        0,
      ),
      paidRevenue: paid.reduce((total, order) => total + Number(order.totalAmount), 0),
    };
  }, [allOrders]);

  const summaryDeltas = useMemo<CheckoutKpiDeltas>(() => {
    const periodStart = new Date(ordersPeriodRange.dateFrom).getTime();
    const periodEnd = new Date(ordersPeriodRange.dateTo).getTime();
    const midpoint = periodStart + (periodEnd - periodStart) / 2;

    const buildBucket = () => ({
      openCount: 0,
      awaitingPaymentCount: 0,
      waitingRevenue: 0,
      paidRevenue: 0,
    });
    const current = buildBucket();
    const previous = buildBucket();

    for (const order of allOrders) {
      const updatedAt = new Date(order.updatedAt).getTime();
      const bucket = Number.isNaN(updatedAt) || updatedAt >= midpoint ? current : previous;
      const amount = Number(order.totalAmount);

      if (
        ['AWAITING_PAYMENT', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(
          order.status,
        )
      ) {
        bucket.openCount += 1;
      }
      if (order.status === 'AWAITING_PAYMENT') {
        bucket.awaitingPaymentCount += 1;
        bucket.waitingRevenue += amount;
      }
      if (order.status === 'PAID') {
        bucket.paidRevenue += amount;
      }
    }

    return {
      openCount: computeDelta(current.openCount, previous.openCount),
      awaitingPaymentCount: computeDelta(
        current.awaitingPaymentCount,
        previous.awaitingPaymentCount,
      ),
      waitingRevenue: computeDelta(current.waitingRevenue, previous.waitingRevenue),
      paidRevenue: computeDelta(current.paidRevenue, previous.paidRevenue),
    };
  }, [allOrders, ordersPeriodRange.dateFrom, ordersPeriodRange.dateTo]);

  const dailyRevenueSeries = useMemo<DailyRevenuePoint[]>(() => {
    const buckets = new Map<string, { revenue: number; orders: number }>();

    for (const order of allOrders) {
      if (order.status !== 'PAID' && order.status !== 'DELIVERED') continue;
      const updatedAt = new Date(order.updatedAt);
      if (Number.isNaN(updatedAt.getTime())) continue;
      const key = updatedAt.toISOString().slice(0, 10);
      const existing = buckets.get(key) ?? { revenue: 0, orders: 0 };
      existing.revenue += Number(order.totalAmount);
      existing.orders += 1;
      buckets.set(key, existing);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        label: dayLabelFormatter.format(new Date(`${date}T00:00:00`)),
        revenue: value.revenue,
        orders: value.orders,
      }));
  }, [allOrders]);

  const operationalFunnel = useMemo(() => {
    const sumByStatus = (status: CommerceOrderStatus) =>
      allOrders
        .filter((order) => order.status === status)
        .reduce((total, order) => total + Number(order.totalAmount), 0);
    const countByStatus = (status: CommerceOrderStatus) =>
      allOrders.filter((order) => order.status === status).length;

    return [
      {
        id: 'awaiting-payment',
        label: 'Aguardando pagamento',
        count: countByStatus('AWAITING_PAYMENT'),
        amount: sumByStatus('AWAITING_PAYMENT'),
        helper: 'Pedidos prontos para conversão financeira.',
      },
      {
        id: 'preparing',
        label: 'Em preparação',
        count: countByStatus('PREPARING'),
        amount: sumByStatus('PREPARING'),
        helper: 'Pedidos pagos que já entraram na operação interna.',
      },
      {
        id: 'ready-for-pickup',
        label: 'Pronto para retirada',
        count: countByStatus('READY_FOR_PICKUP'),
        amount: sumByStatus('READY_FOR_PICKUP'),
        helper: 'Pedidos prontos para coleta ou despacho.',
      },
      {
        id: 'out-for-delivery',
        label: 'Em rota',
        count: countByStatus('OUT_FOR_DELIVERY'),
        amount: sumByStatus('OUT_FOR_DELIVERY'),
        helper: 'Pedidos já saíram para entrega.',
      },
      {
        id: 'delivered',
        label: 'Entregues',
        count: countByStatus('DELIVERED'),
        amount: sumByStatus('DELIVERED'),
        helper: 'Fluxo concluído com sucesso.',
      },
      {
        id: 'cancelled',
        label: 'Cancelados',
        count: countByStatus('CANCELLED'),
        amount: sumByStatus('CANCELLED'),
        helper: 'Pedidos perdidos ou interrompidos.',
      },
    ];
  }, [allOrders]);

  const productRanking = useMemo(() => {
    const paidOrders = allOrders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED');
    const productMap = new Map<
      string,
      { name: string; totalQuantity: number; totalRevenue: number; orderIds: Set<string> }
    >();

    for (const order of paidOrders) {
      const orderWithItems = order as typeof order & CheckoutOrderWithItems;
      const items = orderWithItems.items ?? orderWithItems.sessionItems ?? [];
      for (const item of items) {
        const key = item.name ?? 'Item sem nome';
        const existing = productMap.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity ?? 1;
          existing.totalRevenue += Number(item.lineTotal ?? item.unitPrice ?? 0);
          existing.orderIds.add(order.id);
        } else {
          productMap.set(key, {
            name: key,
            totalQuantity: item.quantity ?? 1,
            totalRevenue: Number(item.lineTotal ?? item.unitPrice ?? 0),
            orderIds: new Set([order.id]),
          });
        }
      }
    }

    return Array.from(productMap.values())
      .map((p) => ({
        name: p.name,
        totalQuantity: p.totalQuantity,
        totalRevenue: p.totalRevenue,
        orderCount: p.orderIds.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20);
  }, [allOrders]);

  const customerRanking = useMemo(() => {
    const paidOrders = allOrders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED');
    const customerMap = new Map<
      string,
      {
        contactName: string;
        contactPhone: string;
        totalOrders: number;
        totalSpent: number;
        lastOrderAt: string;
      }
    >();

    for (const order of paidOrders) {
      const key = order.contactPhone ?? order.contactName ?? order.id;
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(order.totalAmount);
        if (order.updatedAt > existing.lastOrderAt) existing.lastOrderAt = String(order.updatedAt);
      } else {
        customerMap.set(key, {
          contactName: order.contactName ?? 'Não identificado',
          contactPhone: order.contactPhone ?? '',
          totalOrders: 1,
          totalSpent: Number(order.totalAmount),
          lastOrderAt: String(order.updatedAt),
        });
      }
    }

    return Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);
  }, [allOrders]);

  return {
    summary,
    summaryDeltas,
    dailyRevenueSeries,
    operationalFunnel,
    productRanking,
    customerRanking,
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
      if (open) {
        setReportFilters({
          dateFrom: new Date(ordersPeriodRange.dateFrom).toISOString().slice(0, 10),
          dateTo: new Date(ordersPeriodRange.dateTo).toISOString().slice(0, 10),
          status: 'ALL',
        });
      }
    },
    reportFilters,
    setReportFilters,
    reportStatusOptions: CHECKOUT_REPORT_STATUS_OPTIONS,
    downloadReportMutation,
    confirmDownloadReport() {
      downloadReportMutation.mutate();
    },
    downloadReport() {
      setReportsOpenState(true);
      setReportFilters({
        dateFrom: new Date(ordersPeriodRange.dateFrom).toISOString().slice(0, 10),
        dateTo: new Date(ordersPeriodRange.dateTo).toISOString().slice(0, 10),
        status: 'ALL',
      });
    },
  };
}
