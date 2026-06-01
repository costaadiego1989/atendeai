import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { checkoutService } from '@/modules/checkout/services/checkout-service';
import { messagingRealtimeService } from '@/modules/messaging/services/messaging-realtime-service';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { CommerceOrderStatus } from '@/shared/types';

export type CheckoutTab =
  | 'open'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

export type CheckoutPeriodFilter = 'today' | '7d' | '30d' | 'custom';

export type CheckoutPeriodRange = {
  dateFrom: string;
  dateTo: string;
};

export type CheckoutCustomRange = {
  from: Date | null;
  to: Date | null;
};

export type CheckoutAnalyticsSubTab = 'products' | 'customers';

export const CHECKOUT_PERIOD_OPTIONS: Array<{
  value: Exclude<CheckoutPeriodFilter, 'custom'>;
  label: string;
  description: string;
}> = [
  { value: 'today', label: 'Hoje', description: 'Pedidos movimentados hoje' },
  { value: '7d', label: '7 dias', description: 'Últimos 7 dias' },
  { value: '30d', label: '30 dias', description: 'Últimos 30 dias' },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 0);
  return next;
}

function buildCheckoutPeriodRange(
  period: CheckoutPeriodFilter,
  customRange: CheckoutCustomRange,
): CheckoutPeriodRange {
  const now = new Date();

  if (period === 'custom' && customRange.from) {
    return {
      dateFrom: startOfDay(customRange.from).toISOString(),
      dateTo: endOfDay(customRange.to ?? customRange.from).toISOString(),
    };
  }

  const dateTo = now.toISOString();
  const dateFrom = new Date(now);

  if (period === 'today') {
    dateFrom.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    dateFrom.setDate(dateFrom.getDate() - 7);
  } else {
    dateFrom.setDate(dateFrom.getDate() - 30);
  }

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo,
  };
}

export function useCheckoutOrdersViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const effectiveTenantId = tenant?.id || user?.tenantId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CheckoutTab>('open');
  const [analyticsTab, setAnalyticsTab] = useState<CheckoutAnalyticsSubTab>('products');
  const [periodFilter, setPeriodFilter] = useState<CheckoutPeriodFilter>('30d');
  const [customRange, setCustomRange] = useState<CheckoutCustomRange>({ from: null, to: null });
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPageSize = 10;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const ordersPeriodRange = useMemo(
    () => buildCheckoutPeriodRange(periodFilter, customRange),
    [periodFilter, customRange],
  );

  const ordersQuery = useQuery({
    queryKey: [
      'checkout-orders',
      tenant?.id,
      activeBranchId,
      periodFilter,
      ordersPeriodRange.dateFrom,
      ordersPeriodRange.dateTo,
    ],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      checkoutService.listOrders(tenant!.id, {
        branchId: activeBranchId,
        dateFrom: ordersPeriodRange.dateFrom,
        dateTo: ordersPeriodRange.dateTo,
      }),
    refetchInterval: tenant?.id ? 15000 : false,
  });

  const orderDetailsQuery = useQuery({
    queryKey: ['checkout-order-details', tenant?.id, selectedOrderId],
    enabled: Boolean(tenant?.id && selectedOrderId),
    queryFn: () => checkoutService.getOrderDetails(tenant!.id, selectedOrderId!),
    refetchInterval: tenant?.id && selectedOrderId ? 10000 : false,
  });

  const updateAbandonmentStateMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!effectiveTenantId || !selectedOrderId) {
        throw new Error('Empresa ou pedido não identificados.');
      }

      return checkoutService.updateAbandonmentState(effectiveTenantId, selectedOrderId, {
        paused,
        userId: user?.id,
        userName: user?.name,
      });
    },
    onSuccess: async (_, paused) => {
      if (!tenant?.id || !selectedOrderId) return;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['checkout-orders', tenant.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['checkout-order-details', tenant.id, selectedOrderId],
        }),
      ]);

      toast({
        title: paused ? 'Régua pausada' : 'Régua retomada',
        description: paused
          ? 'Os toques automáticos de abandono foram pausados para este checkout.'
          : 'Os toques automáticos de abandono voltaram a ficar ativos.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao alterar régua',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível alterar o estado da régua de abandono.',
        }),
      });
    },
  });

  const triggerAbandonmentTouchMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTenantId || !selectedOrderId) {
        throw new Error('Empresa ou pedido não identificados.');
      }

      return checkoutService.triggerAbandonmentTouch(effectiveTenantId, selectedOrderId, {
        interval: 'manual',
        userId: user?.id,
        userName: user?.name,
      });
    },
    onSuccess: async () => {
      if (!tenant?.id || !selectedOrderId) return;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['checkout-orders', tenant.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['checkout-order-details', tenant.id, selectedOrderId],
        }),
      ]);

      toast({
        title: 'Toque reenviado',
        description: 'A IA iniciou uma nova retomada manual para este checkout.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao reenviar toque',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível disparar o toque de retomada.',
        }),
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: CommerceOrderStatus;
    }) => {
      if (!effectiveTenantId) {
        throw new Error('Empresa não identificada.');
      }

      return checkoutService.updateOrderStatus(effectiveTenantId, orderId, {
        status,
        userId: user?.id,
        userName: user?.name,
      });
    },
    onMutate: async ({ orderId, status }) => {
      if (!tenant?.id) return;

      await queryClient.cancelQueries({
        queryKey: ['checkout-orders', tenant.id],
        exact: false,
      });

      const previousQueries = queryClient.getQueriesData<unknown>({
        queryKey: ['checkout-orders', tenant.id],
        exact: false,
      });

      previousQueries.forEach(([queryKey, data]) => {
        if (!Array.isArray(data)) return;

        queryClient.setQueryData(
          queryKey,
          data.map((order) =>
            typeof order === 'object' && order !== null && 'id' in order && order.id === orderId
              ? { ...order, status, updatedAt: new Date().toISOString() }
              : order,
          ),
        );
      });

      return { previousQueries };
    },
    onSuccess: async (updatedOrder) => {
      if (!tenant?.id) return;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['checkout-orders', tenant.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['checkout-order-details', tenant.id, updatedOrder.id],
        }),
      ]);

      toast({
        title: 'Pedido movimentado',
        description: 'O status do pedido foi atualizado no checkout.',
      });
    },
    onError: (error, _variables, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      toast({
        title: 'Falha ao mover pedido',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível atualizar o status do pedido.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!tenant?.id) {
      return;
    }

    return messagingRealtimeService.subscribe(tenant.id, (event) => {
      if (
        event.type !== 'message.received' &&
        event.type !== 'message.queued' &&
        event.type !== 'message.sent' &&
        event.type !== 'message.failed' &&
        event.type !== 'conversation.status.changed'
      ) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ['checkout-orders', tenant.id],
        exact: false,
      });

      if (selectedOrderId) {
        void queryClient.invalidateQueries({
          queryKey: ['checkout-order-details', tenant.id, selectedOrderId],
        });
      }
    });
  }, [activeBranchId, queryClient, selectedOrderId, tenant?.id]);

  const allOrders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'new':
        return allOrders.filter(
          (order) => order.status === 'AWAITING_PAYMENT' || order.status === 'PAID',
        );
      case 'preparing':
        return allOrders.filter((order) => order.status === 'PREPARING');
      case 'ready':
        return allOrders.filter((order) => order.status === 'READY_FOR_PICKUP');
      case 'shipping':
        return allOrders.filter((order) => order.status === 'OUT_FOR_DELIVERY');
      case 'delivered':
        return allOrders.filter((order) => order.status === 'DELIVERED');
      case 'cancelled':
        return allOrders.filter((order) => order.status === 'CANCELLED');
      case 'open':
      default:
        return allOrders;
    }
  }, [activeTab, allOrders]);

  useEffect(() => {
    setOrdersPage(1);
  }, [activeTab, periodFilter]);

  const ordersTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((ordersPage - 1) * ordersPageSize, ordersPage * ordersPageSize),
    [filteredOrders, ordersPage, ordersPageSize],
  );

  const selectedListItem = useMemo(
    () => allOrders.find((order) => order.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId],
  );

  const selectedOrder = orderDetailsQuery.data?.order ?? null;
  const selectedSession = orderDetailsQuery.data?.session ?? null;
  const selectedAbandonmentTouches = orderDetailsQuery.data?.abandonmentTouches ?? [];

  function applyPeriodPreset(value: Exclude<CheckoutPeriodFilter, 'custom'>) {
    setPeriodFilter(value);
    setCustomRange({ from: null, to: null });
  }

  function applyCustomRange(range: CheckoutCustomRange) {
    setCustomRange(range);
    setPeriodFilter(range.from ? 'custom' : '30d');
  }

  return {
    tenant,
    allOrders,
    activeTab,
    setActiveTab,
    analyticsTab,
    setAnalyticsTab,
    selectedOrderId,
    setSelectedOrderId,
    ordersQuery,
    orderDetailsQuery,
    filteredOrders,
    paginatedOrders,
    ordersPagination: {
      page: ordersPage,
      pageSize: ordersPageSize,
      totalItems: filteredOrders.length,
      totalPages: ordersTotalPages,
      setPage: setOrdersPage,
    },
    periodFilter,
    setPeriodFilter,
    customRange,
    applyPeriodPreset,
    applyCustomRange,
    periodOptions: CHECKOUT_PERIOD_OPTIONS,
    ordersPeriodRange,
    updateAbandonmentStateMutation,
    triggerAbandonmentTouchMutation,
    updateOrderStatusMutation,
    selectedOrder,
    selectedSession,
    selectedAbandonmentTouches,
    selectedListItem,
    openConversation(conversationId?: string | null) {
      if (!conversationId) return;
      navigate(`/app/conversations/${conversationId}`);
    },
  };
}
