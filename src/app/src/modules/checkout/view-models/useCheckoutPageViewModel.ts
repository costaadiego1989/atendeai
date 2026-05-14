import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { checkoutService } from '@/modules/checkout/services/checkout-service';
import { messagingRealtimeService } from '@/modules/messaging/services/messaging-realtime-service';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type {
  CommerceDeliverySchedule,
  CommerceDeliveryWeekday,
  CommerceOrderStatus,
  CommerceSessionItem,
} from '@/shared/types';
import type { AbandonmentConfig } from '@/modules/checkout/components/AbandonmentConfigSheet';

export type CheckoutTab =
  | 'open'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'shipping'
  | 'delivered'
  | 'cancelled';
export type CheckoutPeriodFilter = 'today' | '7d' | '30d';
export type CheckoutReportStatusFilter = CommerceOrderStatus | 'ALL';

type CheckoutMapLocation = {
  latitude: number;
  longitude: number;
  source: 'browser';
};

type CheckoutOrderWithItems = {
  id: string;
  items?: CommerceSessionItem[];
  sessionItems?: CommerceSessionItem[];
};

const DELIVERY_WEEKDAY_ORDER: CommerceDeliveryWeekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const CHECKOUT_PERIOD_OPTIONS: Array<{
  value: CheckoutPeriodFilter;
  label: string;
  description: string;
}> = [
    { value: 'today', label: 'Hoje', description: 'Pedidos movimentados hoje' },
    { value: '7d', label: '7 dias', description: 'Ultimos 7 dias' },
    { value: '30d', label: '30 dias', description: 'Ultimos 30 dias' },
  ];

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

function buildCheckoutPeriodRange(period: CheckoutPeriodFilter) {
  const now = new Date();
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

function buildDefaultDeliverySchedule(): CommerceDeliverySchedule[] {
  return DELIVERY_WEEKDAY_ORDER.map((weekday, index) => ({
    weekday,
    enabled: index < 5,
    startTime: '09:00',
    endTime: '18:00',
  }));
}

function normalizeDeliverySchedule(
  schedule?: CommerceDeliverySchedule[] | null,
): CommerceDeliverySchedule[] {
  const source = schedule?.length ? schedule : buildDefaultDeliverySchedule();
  return DELIVERY_WEEKDAY_ORDER.map((weekday) => {
    const existing = source.find((slot) => slot.weekday === weekday);
    return {
      weekday,
      enabled: existing?.enabled ?? false,
      startTime: existing?.startTime ?? '09:00',
      endTime: existing?.endTime ?? '18:00',
    };
  });
}

function buildOpenStreetMapEmbedUrl(latitude: number, longitude: number, radiusKm: number) {
  const latDelta = Math.max(radiusKm / 111, 0.01);
  const lngDelta = Math.max(radiusKm / (111 * Math.cos((latitude * Math.PI) / 180)), 0.01);
  const left = longitude - lngDelta;
  const right = longitude + lngDelta;
  const top = latitude + latDelta;
  const bottom = latitude - latDelta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function useCheckoutPageViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const effectiveTenantId = tenant?.id || user?.tenantId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CheckoutTab>('open');
  const [periodFilter, setPeriodFilter] = useState<CheckoutPeriodFilter>('30d');
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPageSize = 10;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [shippingPolicySheetOpen, setShippingPolicySheetOpen] = useState(false);
  const [abandonmentConfigOpen, setAbandonmentConfigOpen] = useState(false);
  const [mapLocation, setMapLocation] = useState<CheckoutMapLocation | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [shippingPolicyForm, setShippingPolicyForm] = useState({
    mode: 'FIXED' as 'FIXED' | 'PER_KM',
    fixedAmount: '',
    pricePerKm: '',
    minimumAmount: '',
    maxRadiusKm: '',
    servicedNeighborhoods: '',
    deliverySchedule: buildDefaultDeliverySchedule(),
    notes: '',
  });
  const [abandonmentConfigForm, setAbandonmentConfigForm] = useState<AbandonmentConfig>({
    active: true,
    message: '',
    useAiMessage: true,
    mode: 'SINGLE',
    maxTouches: 1,
    intervalMinutes: 60,
  });

  const ordersPeriodRange = useMemo(
    () => buildCheckoutPeriodRange(periodFilter),
    [periodFilter],
  );

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

  const shippingPolicyQuery = useQuery({
    queryKey: ['checkout-shipping-policy', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => checkoutService.getShippingPolicy(tenant!.id),
  });

  const abandonmentConfigQuery = useQuery({
    queryKey: ['checkout-abandonment-config', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => checkoutService.getAbandonmentConfig(tenant!.id),
  });

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
        title: 'Relatorio gerado',
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

  useEffect(() => {
    const config = abandonmentConfigQuery.data;
    if (!config) return;
    setAbandonmentConfigForm({
      active: config.active,
      message: config.message ?? '',
      useAiMessage: config.useAiMessage,
      mode: config.mode,
      maxTouches: config.maxTouches,
      intervalMinutes: config.intervalMinutes,
    });
  }, [abandonmentConfigQuery.data]);

  useEffect(() => {
    const policy = shippingPolicyQuery.data;
    if (!policy) {
      return;
    }

    setShippingPolicyForm({
      mode: policy.mode,
      fixedAmount: policy.fixedAmount != null ? String(policy.fixedAmount) : '',
      pricePerKm: policy.pricePerKm != null ? String(policy.pricePerKm) : '',
      minimumAmount: policy.minimumAmount != null ? String(policy.minimumAmount) : '',
      maxRadiusKm: policy.maxRadiusKm != null ? String(policy.maxRadiusKm) : '',
      servicedNeighborhoods: (policy.servicedNeighborhoods ?? []).join(', '),
      deliverySchedule: normalizeDeliverySchedule(policy.deliverySchedule),
      notes: policy.notes ?? '',
    });
  }, [shippingPolicyQuery.data]);

  useEffect(() => {
    if (!shippingPolicySheetOpen) {
      return;
    }

    const policy = shippingPolicyQuery.data;
    if (policy) {
      setShippingPolicyForm({
        mode: policy.mode ?? 'FIXED',
        fixedAmount: policy.fixedAmount != null ? String(policy.fixedAmount) : '',
        pricePerKm: policy.pricePerKm != null ? String(policy.pricePerKm) : '',
        minimumAmount: policy.minimumAmount != null ? String(policy.minimumAmount) : '',
        maxRadiusKm: policy.maxRadiusKm != null ? String(policy.maxRadiusKm) : '',
        servicedNeighborhoods: (policy.servicedNeighborhoods ?? []).join(', '),
        deliverySchedule: normalizeDeliverySchedule(policy.deliverySchedule),
        notes: policy.notes ?? '',
      });
      return;
    }

    setShippingPolicyForm({
      mode: 'FIXED',
      fixedAmount: '',
      pricePerKm: '',
      minimumAmount: '',
      maxRadiusKm: '',
      servicedNeighborhoods: '',
      deliverySchedule: buildDefaultDeliverySchedule(),
      notes: '',
    });
    setMapLocation(null);
  }, [shippingPolicyQuery.data, shippingPolicySheetOpen]);

  useEffect(() => {
    if (!shippingPolicySheetOpen || mapLocation || tenant?.street || tenant?.city) {
      return;
    }

    if (shippingPolicyForm.mode !== 'PER_KM') {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    setMapLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'browser',
        });
        setMapLoading(false);
      },
      () => {
        setMapLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [
    mapLocation,
    shippingPolicyForm.mode,
    shippingPolicySheetOpen,
    tenant?.city,
    tenant?.street,
  ]);

  const updateShippingPolicyMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTenantId) {
        throw new Error('Empresa não identificada.');
      }

      return checkoutService.updateShippingPolicy(effectiveTenantId, {
        mode: shippingPolicyForm.mode,
        fixedAmount:
          shippingPolicyForm.mode === 'FIXED' && shippingPolicyForm.fixedAmount.trim()
            ? Number(shippingPolicyForm.fixedAmount)
            : null,
        pricePerKm:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.pricePerKm.trim()
            ? Number(shippingPolicyForm.pricePerKm)
            : null,
        minimumAmount:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.minimumAmount.trim()
            ? Number(shippingPolicyForm.minimumAmount)
            : null,
        maxRadiusKm:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.maxRadiusKm.trim()
            ? Number(shippingPolicyForm.maxRadiusKm)
            : null,
        servicedNeighborhoods:
          shippingPolicyForm.mode === 'FIXED'
            ? shippingPolicyForm.servicedNeighborhoods
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
            : [],
        deliverySchedule: shippingPolicyForm.deliverySchedule.map((slot) => ({
          weekday: slot.weekday,
          enabled: slot.enabled,
          startTime: slot.enabled ? slot.startTime ?? null : null,
          endTime: slot.enabled ? slot.endTime ?? null : null,
        })),
        notes: shippingPolicyForm.notes.trim() || null,
      });
    },
    onSuccess: async () => {
      if (!tenant?.id) return;

      await queryClient.invalidateQueries({
        queryKey: ['checkout-shipping-policy', tenant.id],
      });

      toast({
        title: 'Frete atualizado',
        description: 'As regras de entrega e atendimento já foram salvas.',
      });
      setShippingPolicySheetOpen(false);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar frete',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível salvar a política de frete.',
        }),
      });
    },
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
        title: paused ? 'Regua pausada' : 'Regua retomada',
        description: paused
          ? 'Os toques automaticos de abandono foram pausados para este checkout.'
          : 'Os toques automaticos de abandono voltaram a ficar ativos.',
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
        throw new Error('Empresa nao identificada.');
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
          fallbackMessage: 'Nao foi possivel atualizar o status do pedido.',
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
    () =>
      filteredOrders.slice(
        (ordersPage - 1) * ordersPageSize,
        ordersPage * ordersPageSize,
      ),
    [filteredOrders, ordersPage, ordersPageSize],
  );

  const selectedListItem = useMemo(
    () => allOrders.find((order) => order.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId],
  );

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
      waitingRevenue: awaitingPayment.reduce((total, order) => total + Number(order.totalAmount), 0),
      paidRevenue: paid.reduce((total, order) => total + Number(order.totalAmount), 0),
    };
  }, [allOrders]);
  const operationalFunnel = useMemo(
    () => [
      {
        id: 'awaiting-payment',
        label: 'Aguardando pagamento',
        count: allOrders.filter((order) => order.status === 'AWAITING_PAYMENT').length,
        amount: allOrders
          .filter((order) => order.status === 'AWAITING_PAYMENT')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Pedidos prontos para conversao financeira.',
      },
      {
        id: 'preparing',
        label: 'Em preparação',
        count: allOrders.filter((order) => order.status === 'PREPARING').length,
        amount: allOrders
          .filter((order) => order.status === 'PREPARING')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Pedidos pagos que ja entraram na Operação interna.',
      },
      {
        id: 'ready-for-pickup',
        label: 'Pronto para retirada',
        count: allOrders.filter((order) => order.status === 'READY_FOR_PICKUP').length,
        amount: allOrders
          .filter((order) => order.status === 'READY_FOR_PICKUP')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Pedidos prontos para coleta ou despacho.',
      },
      {
        id: 'out-for-delivery',
        label: 'Em rota',
        count: allOrders.filter((order) => order.status === 'OUT_FOR_DELIVERY').length,
        amount: allOrders
          .filter((order) => order.status === 'OUT_FOR_DELIVERY')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Pedidos ja sairam para entrega.',
      },
      {
        id: 'delivered',
        label: 'Entregues',
        count: allOrders.filter((order) => order.status === 'DELIVERED').length,
        amount: allOrders
          .filter((order) => order.status === 'DELIVERED')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Fluxo concluido com sucesso.',
      },
      {
        id: 'cancelled',
        label: 'Cancelados',
        count: allOrders.filter((order) => order.status === 'CANCELLED').length,
        amount: allOrders
          .filter((order) => order.status === 'CANCELLED')
          .reduce((total, order) => total + Number(order.totalAmount), 0),
        helper: 'Pedidos perdidos ou interrompidos.',
      },
    ],
    [allOrders],
  );

  const productRanking = useMemo(() => {
    const paidOrders = allOrders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED');
    const productMap = new Map<string, { name: string; totalQuantity: number; totalRevenue: number; orderIds: Set<string> }>();

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
      .map((p) => ({ name: p.name, totalQuantity: p.totalQuantity, totalRevenue: p.totalRevenue, orderCount: p.orderIds.size }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20);
  }, [allOrders]);

  const customerRanking = useMemo(() => {
    const paidOrders = allOrders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED');
    const customerMap = new Map<string, { contactName: string; contactPhone: string; totalOrders: number; totalSpent: number; lastOrderAt: string }>();

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

  const updateAbandonmentConfigMutation = useMutation({
    mutationFn: async () => {
      const state = useAuthStore.getState();
      const tid = state.tenant?.id || state.user?.tenantId;
      if (!tid) {
        throw new Error(`ID ausente. State: tenant=${!!state.tenant}, tid=${state.tenant?.id}, utid=${state.user?.tenantId}`);
      }
      return checkoutService.updateAbandonmentConfig(tid, abandonmentConfigForm);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checkout-abandonment-config', tenant?.id] });
      setAbandonmentConfigOpen(false);
      toast({ title: 'Configuração salva', description: 'As regras de carrinho abandonado foram atualizadas.' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao salvar', description: getFriendlyErrorMessage(error, { fallbackMessage: 'Não foi possível salvar a configuração.' }), variant: 'destructive' });
    },
  });

  const generateAbandonmentMessageMutation = useMutation({
    mutationFn: async () => {
      const state = useAuthStore.getState();
      const tid = state.tenant?.id || state.user?.tenantId;
      if (!tid) {
        throw new Error(`ID ausente. State: tenant=${!!state.tenant}, tid=${state.tenant?.id}, utid=${state.user?.tenantId}`);
      }
      return checkoutService.generateAbandonmentMessage(tid);
    },
    onSuccess: (result) => {
      setAbandonmentConfigForm((prev) => ({ ...prev, message: result.message, useAiMessage: false }));
      toast({ title: 'Mensagem gerada', description: 'A IA criou uma sugestão de mensagem de retomada.' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao gerar', description: getFriendlyErrorMessage(error, { fallbackMessage: 'Não foi possível gerar a mensagem.' }), variant: 'destructive' });
    },
  });

  const selectedOrder = orderDetailsQuery.data?.order ?? null;
  const selectedSession = orderDetailsQuery.data?.session ?? null;
  const selectedAbandonmentTouches = orderDetailsQuery.data?.abandonmentTouches ?? [];
  const shippingRadiusKm = Number(shippingPolicyForm.maxRadiusKm || '5') || 5;
  const companyAddress = [tenant?.street, tenant?.streetNumber, tenant?.neighborhood, tenant?.city, tenant?.state]
    .filter(Boolean)
    .join(', ');
  const mapEmbedUrl = mapLocation
    ? buildOpenStreetMapEmbedUrl(
      mapLocation.latitude,
      mapLocation.longitude,
      shippingRadiusKm,
    )
    : null;
  const mapCoverageDiameter = Math.max(72, Math.min(220, 64 + shippingRadiusKm * 6));

  return {
    tenant,
    activeTab,
    setActiveTab,
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
    summary,
    operationalFunnel,
    periodFilter,
    setPeriodFilter,
    periodOptions: CHECKOUT_PERIOD_OPTIONS,
    ordersPeriodRange,
    shippingPolicyQuery,
    shippingPolicyForm,
    setShippingPolicyForm,
    shippingPolicySheetOpen,
    setShippingPolicySheetOpen,
    updateShippingPolicyMutation,
    updateAbandonmentStateMutation,
    triggerAbandonmentTouchMutation,
    updateOrderStatusMutation,
    mapLocation,
    mapLoading,
    companyAddress,
    mapEmbedUrl,
    shippingRadiusKm,
    mapCoverageDiameter,
    selectedOrder,
    selectedSession,
    selectedAbandonmentTouches,
    selectedListItem,
    productRanking,
    customerRanking,
    abandonmentConfigOpen,
    setAbandonmentConfigOpen,
    abandonmentConfigForm,
    setAbandonmentConfigForm,
    abandonmentConfigQuery,
    updateAbandonmentConfigMutation,
    generateAbandonmentMessageMutation,
    requestBrowserLocation() {
      if (!navigator.geolocation) {
        toast({
          title: 'Geolocalização indisponível',
          description: 'Seu navegador não liberou acesso à localização atual.',
        });
        return;
      }

      setMapLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: 'browser',
          });
          setMapLoading(false);
        },
        () => {
          setMapLoading(false);
          toast({
            title: 'Não foi possível obter a localização',
            description: 'Libere a localização do navegador para ajustar o raio no mapa.',
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
      );
    },
    openConversation(conversationId?: string | null) {
      if (!conversationId) return;
      navigate(`/app/conversations/${conversationId}`);
    },
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
