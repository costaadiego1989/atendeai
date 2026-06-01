import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Ban,
  CheckCircle,
  Clock,
  CreditCard,
  PackageCheck,
  Send,
  ShoppingCart,
  Truck,
  Utensils,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import {
  getFulfillmentLabel,
  getOrderLabel,
  getOrderTone,
  getPaymentLabel,
  getPaymentTone,
  getShippingLabel,
} from '@/modules/checkout/view-models/checkout-ui-utils';
import type { CommerceOrderStatus } from '@/shared/types';

interface Order {
  id: string;
  status: CommerceOrderStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  subtotalAmount: number;
  freightAmount: number;
  totalAmount: number;
  fulfillmentType?: string | null;
  shippingMode?: string | null;
  paymentStatus?: string | null;
  abandonmentTouchesCount?: number;
  lastAbandonmentInterval?: string | null;
  lastAbandonmentAt?: string | Date | null;
  updatedAt: string | Date;
}

interface CheckoutOrdersMesaProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLoading: boolean;
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onMoveOrderStatus: (orderId: string, status: CommerceOrderStatus) => void;
  movingOrderId?: string | null;
}

const KANBAN_COLUMNS: Array<{
  id: string;
  statuses: CommerceOrderStatus[];
  targetStatus: CommerceOrderStatus;
  title: string;
  description: string;
}> = [
  {
    id: 'new',
    statuses: ['AWAITING_PAYMENT', 'PAID'],
    targetStatus: 'PAID',
    title: 'Novo',
    description: 'Pedidos novos, pagos ou aguardando confirmação.',
  },
  {
    id: 'preparing',
    statuses: ['PREPARING'],
    targetStatus: 'PREPARING',
    title: 'Em preparacao',
    description: 'Pedidos pagos em producao ou separacao.',
  },
  {
    id: 'ready',
    statuses: ['READY_FOR_PICKUP'],
    targetStatus: 'READY_FOR_PICKUP',
    title: 'Pronto/Separado',
    description: 'Pedidos prontos para retirada ou despacho.',
  },
  {
    id: 'shipping',
    statuses: ['OUT_FOR_DELIVERY'],
    targetStatus: 'OUT_FOR_DELIVERY',
    title: 'Enviado/Entrega',
    description: 'Pedidos em rota ou com entrega iniciada.',
  },
  {
    id: 'delivered',
    statuses: ['DELIVERED'],
    targetStatus: 'DELIVERED',
    title: 'Entregue',
    description: 'Fluxo concluido.',
  },
  {
    id: 'cancelled',
    statuses: ['CANCELLED'],
    targetStatus: 'CANCELLED',
    title: 'Cancelado',
    description: 'Pedidos interrompidos.',
  },
];

const STATUS_ACTIONS: Partial<Record<CommerceOrderStatus, Array<{
  status: CommerceOrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'outline' | 'destructive';
}>>> = {
  AWAITING_PAYMENT: [
    { status: 'CANCELLED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  PAID: [
    { status: 'PREPARING', label: 'Preparar', icon: Utensils },
    { status: 'READY_FOR_PICKUP', label: 'Separar', icon: PackageCheck, variant: 'outline' },
    { status: 'OUT_FOR_DELIVERY', label: 'Enviar', icon: Send, variant: 'outline' },
    { status: 'DELIVERED', label: 'Entregar', icon: CheckCircle, variant: 'outline' },
    { status: 'CANCELLED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  PREPARING: [
    { status: 'READY_FOR_PICKUP', label: 'Pronto', icon: PackageCheck },
    { status: 'OUT_FOR_DELIVERY', label: 'Enviar', icon: Send, variant: 'outline' },
    { status: 'DELIVERED', label: 'Entregar', icon: CheckCircle, variant: 'outline' },
    { status: 'CANCELLED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  READY_FOR_PICKUP: [
    { status: 'OUT_FOR_DELIVERY', label: 'Enviar', icon: Send, variant: 'outline' },
    { status: 'DELIVERED', label: 'Entregar', icon: CheckCircle },
    { status: 'CANCELLED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  OUT_FOR_DELIVERY: [
    { status: 'DELIVERED', label: 'Entregar', icon: CheckCircle },
    { status: 'CANCELLED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
};

export const CheckoutOrdersMesa: React.FC<CheckoutOrdersMesaProps> = ({
  activeTab,
  onTabChange,
  isLoading,
  orders,
  onSelectOrder,
  onMoveOrderStatus,
  movingOrderId,
}) => {
  const getAbandonmentLabel = (interval?: string | null) => {
    switch (interval) {
      case '1h':
        return 'Retomada 1h';
      case '1d':
        return 'Retomada 1d';
      case '7d':
        return 'Retomada 7d';
      default:
        return 'Carrinho retomado';
    }
  };

  const renderOrderCard = (order: Order, draggable: boolean) => {
    const actions = STATUS_ACTIONS[order.status] ?? [];
    const isMoving = movingOrderId === order.id;

    return (
      <article
        key={order.id}
        draggable={draggable && !isMoving}
        onDragStart={(event) => {
          if (!draggable) return;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', order.id);
          event.dataTransfer.setData('application/x-order-status', order.status);
        }}
        className="group rounded-lg border border-border/60 border-l-4 border-l-primary/50 bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md data-[drag=true]:cursor-grab data-[drag=true]:active:cursor-grabbing"
        data-drag={draggable}
      >
        <button type="button" onClick={() => onSelectOrder(order.id)} className="block w-full text-left">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {order.contactName || 'Contato não identificado'}
              </p>
              <Badge
                className={`shrink-0 border px-2 py-0.5 text-[10px] font-bold uppercase ${getOrderTone(order.status)}`}
              >
                {getOrderLabel(order.status)}
              </Badge>
            </div>
            <p className="break-words font-mono text-xs leading-5 text-muted-foreground">
              {order.contactPhone ? formatPhone(order.contactPhone).replace('+55 ', '') : 'Sem telefone'}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total</p>
              <p className="mt-1 text-sm font-bold text-primary">
                {formatCurrency(order.totalAmount) ?? 'R$ 0,00'}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Frete</p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {formatCurrency(order.freightAmount) ?? 'R$ 0,00'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full text-[10px]">
              {getFulfillmentLabel(order.fulfillmentType)}
            </Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {getShippingLabel(order.shippingMode)}
            </Badge>
            <Badge className={`rounded-full border text-[10px] ${getPaymentTone(order.paymentStatus)}`}>
              {getPaymentLabel(order.paymentStatus)}
            </Badge>
            {(order.abandonmentTouchesCount ?? 0) > 0 ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-300"
              >
                {getAbandonmentLabel(order.lastAbandonmentInterval)} - {order.abandonmentTouchesCount}
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground/80">
            Atualizado em {formatDateTime(order.updatedAt) ?? 'agora'}.
          </p>
          {(order.abandonmentTouchesCount ?? 0) > 0 && order.lastAbandonmentAt ? (
            <p className="mt-1 text-[10px] text-amber-300/80">
              Ultima retomada em {formatDateTime(order.lastAbandonmentAt) ?? 'agora'}.
            </p>
          ) : null}
        </button>

        {actions.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.status}
                  type="button"
                  size="sm"
                  variant={action.variant ?? 'default'}
                  className="justify-center gap-1.5 rounded-md px-2"
                  disabled={isMoving}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveOrderStatus(order.id, action.status);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
            Etapa final
          </div>
        )}
      </article>
    );
  };

  return (
    <Card className="border-border/60 bg-background/70 shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/60 bg-muted/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Operacao de pedidos</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Controle preparo, separacao, expedicao e entrega por etapa.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            {orders.length} pedidos no filtro
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange}>
          <PageTabsList
            containerClassName="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabs={[
              { value: 'open', label: 'Todos', icon: Clock },
              { value: 'new', label: 'Novo', icon: CreditCard },
              { value: 'preparing', label: 'Em preparo', icon: Utensils },
              { value: 'ready', label: 'Pronto', icon: PackageCheck },
              { value: 'shipping', label: 'Enviado', icon: Truck },
              { value: 'delivered', label: 'Entregue', icon: CheckCircle },
              { value: 'cancelled', label: 'Cancelados', icon: XCircle },
            ]}
          />
        </Tabs>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-20 text-sm text-muted-foreground animate-pulse">
            Carregando pedidos da operacao...
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido nesta etapa"
            description="Os pedidos aparecerao aqui conforme os clientes avancarem no checkout conversacional."
          />
        ) : activeTab === 'open' ? (
          <div className="max-h-[680px] overflow-auto">
            <div className="flex min-w-max divide-x divide-border/60">
              {KANBAN_COLUMNS.map((column) => {
                const columnOrders = orders.filter((order) =>
                  column.statuses.includes(order.status),
                );

                return (
                  <section
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const orderId = event.dataTransfer.getData('text/plain');
                      const sourceStatus = event.dataTransfer.getData('application/x-order-status');
                      if (!orderId || sourceStatus === column.targetStatus) return;
                      onMoveOrderStatus(orderId, column.targetStatus);
                    }}
                    className="flex min-h-[520px] w-[280px] shrink-0 flex-col bg-muted/[0.08]"
                  >
                    <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold uppercase tracking-wide text-foreground">
                            {column.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            {column.description}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="h-6 min-w-6 justify-center rounded-full px-2 text-[10px]"
                        >
                          {columnOrders.length}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 p-4">
                      {columnOrders.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-5 text-center text-[11px] text-muted-foreground">
                          Sem pedidos
                        </div>
                      ) : (
                        columnOrders.map((order) => renderOrderCard(order, true))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-[680px] overflow-y-auto p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {orders.map((order) => renderOrderCard(order, false))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
