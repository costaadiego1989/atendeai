import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCheckoutPageViewModel, type CheckoutTab } from '@/modules/checkout/view-models/useCheckoutPageViewModel';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { CheckoutKPIs } from '../components/CheckoutKPIs';
import { CheckoutOrdersMesa } from '../components/CheckoutOrdersMesa';
import { CheckoutDetailsSheet } from '../components/CheckoutDetailsSheet';
import { CheckoutAnalyticsTabs } from '../components/CheckoutAnalyticsTabs';
import { AbandonmentConfigSheet } from '../components/AbandonmentConfigSheet';
import { ShippingPolicySheet } from '../components/ShippingPolicySheet';
import { CheckoutReportsSheet } from '../components/CheckoutReportsSheet';
import { formatCurrency } from '@/shared/lib/formatters';
import { DynamicFunnel } from '@/shared/ui/DynamicFunnel';
import {
  getPaymentStatusClassName,
  getPaymentStatusLabel,
} from '@/shared/payment/payment-ui';
import { CalendarDays, Download } from 'lucide-react';

// --- Theme/Style Helpers (Maturidade: Padronização de Cores e Labels Executivos) ---

function getOrderTone(status: string) {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'AWAITING_PAYMENT':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-primary/10 text-primary border-primary/20';
  }
}

function getOrderLabel(status: string) {
  const labels: Record<string, string> = {
    'AWAITING_PAYMENT': 'Aguardando Pagamento',
    'PAID': 'Pedido Pago',
    'PREPARING': 'Em Preparação',
    'READY_FOR_PICKUP': 'Pronto para Retirada',
    'OUT_FOR_DELIVERY': 'Em Rota de Entrega',
    'DELIVERED': 'Pedido Entregue',
    'CANCELLED': 'Cancelado',
  };
  return labels[status] || status;
}

function getPaymentTone(status?: string | null) {
  return getPaymentStatusClassName(status);
}

function getPaymentLabel(status?: string | null) {
  return status === 'PAID'
    ? 'Confirmado'
    : getPaymentStatusLabel(status, 'Pendente');
}

function getShippingLabel(mode?: string | null) {
  return mode === 'PER_KM' ? 'Frete por KM' : mode === 'FIXED' ? 'Taxa Fixa' : 'Retirada Local';
}

function getFulfillmentLabel(type?: string | null) {
  return type === 'DELIVERY' ? 'Entrega em Casa' : 'Retirada Presencial';
}

function getWeekdayLabel(value: string) {
  const labels: Record<string, string> = {
    'MONDAY': 'Segunda', 'TUESDAY': 'Terça', 'WEDNESDAY': 'Quarta',
    'THURSDAY': 'Quinta', 'FRIDAY': 'Sexta', 'SATURDAY': 'Sábado', 'SUNDAY': 'Domingo'
  };
  return labels[value] || value;
}

function getCheckoutStageLabel(step?: string | null) {
  const labels: Record<string, string> = {
    'IDENTIFYING_NEED': 'Qualificação',
    'SELECTING_ITEM': 'Escolha de Itens',
    'AWAITING_QUANTITY': 'Definição de Qtd',
    'ASKING_MORE_ITEMS': 'Adicionais',
    'AWAITING_FULFILLMENT': 'Logística',
    'AWAITING_DELIVERY_ADDRESS': 'Endereço',
    'AWAITING_FREIGHT_REVIEW': 'Cálculo Frete',
    'AWAITING_ORDER_NOTE': 'Detalhes Finais',
    'READY_FOR_CHECKOUT': 'Pronto para Faturar',
    'AWAITING_PAYMENT': 'Pagamento',
    'PAID': 'Venda Concluída',
    'CANCELLED': 'Abandono/Cancelado',
  };
  return labels[step || ''] || 'Em Negociação';
}

function getCheckoutStageOrder(step?: string | null): number {
  const stages: Record<string, number> = {
    'IDENTIFYING_NEED': 1, 'SELECTING_ITEM': 1, 'AWAITING_QUANTITY': 1, 'ASKING_MORE_ITEMS': 1,
    'AWAITING_FULFILLMENT': 2, 'AWAITING_DELIVERY_ADDRESS': 2, 'AWAITING_FREIGHT_REVIEW': 2,
    'AWAITING_ORDER_NOTE': 3,
    'READY_FOR_CHECKOUT': 4, 'AWAITING_PAYMENT': 4,
    'PAID': 5,
  };
  return stages[step || ''] || 1;
}

export default function CheckoutPage() {
  const vm = useCheckoutPageViewModel();
  const shippingPolicy = vm.shippingPolicyQuery.data;

  return (
    <div className="page-container animate-in fade-in duration-500 space-y-6">
      <CheckoutHeader
        onOpenShippingPolicy={() => vm.setShippingPolicySheetOpen(true)}
        onOpenAbandonmentConfig={() => vm.setAbandonmentConfigOpen(true)}
      />

      <Card className="glass-card border-border/40 bg-background/30">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório do checkout</p>
              <p className="text-xs text-muted-foreground">
                KPIs, funil, pedidos e CSV seguem o mesmo periodo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {vm.periodOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.periodFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => vm.setPeriodFilter(option.value)}
                  title={option.description}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={vm.downloadReport}
            >
              <Download className="h-4 w-4" />
              Gerar relatorio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card shadow-sm border-border/40">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">Estratégia de Logística</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Define como a IA orienta o cliente sobre frete, áreas de cobertura e horários operacionais.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 transition-colors hover:bg-background/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Modelo de Frete
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {shippingPolicy ? getShippingLabel(shippingPolicy.mode) : 'Não configurado'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {shippingPolicy?.mode === 'FIXED'
                ? `Custo padrão: ${formatCurrency(shippingPolicy.fixedAmount ?? 0)}`
                : shippingPolicy?.mode === 'PER_KM'
                  ? `Base: ${formatCurrency(shippingPolicy.pricePerKm ?? 0)}/km`
                  : 'Ajuste as regras base do checkout.'}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 transition-colors hover:bg-background/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Disponibilidade
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {shippingPolicy?.maxRadiusKm != null ? `${shippingPolicy.maxRadiusKm}km de cobertura` : 'Raio global'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {shippingPolicy?.mode === 'FIXED' && shippingPolicy?.servicedNeighborhoods?.length
                ? shippingPolicy.servicedNeighborhoods.join(', ')
                : 'Operando dentro do raio geográfico definido.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {shippingPolicy?.deliverySchedule?.some((slot) => slot.enabled) && (
        <Card className="glass-card border-border/40 bg-background/20">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horários de Entrega Ativos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shippingPolicy.deliverySchedule
                .filter((slot) => slot.enabled)
                .map((slot) => (
                  <Badge key={slot.weekday} variant="secondary" className="rounded-lg bg-background/60 border-border/40 px-3 py-1 text-[10px] font-bold">
                    {getWeekdayLabel(slot.weekday)} {slot.startTime} - {slot.endTime}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CheckoutKPIs summary={vm.summary} />

      <DynamicFunnel
        title="Funil do checkout"
        description="Veja onde os pedidos estão acumulando entre pagamento, preparo, expedição e entrega."
        steps={vm.operationalFunnel.map((step) => ({
          id: step.id,
          label: step.label,
          count: step.count,
          helper: step.helper,
          amountLabel: formatCurrency(step.amount) ?? undefined,
        }))}
        emptyMessage="Assim que houver pedidos circulando pelo checkout, o funil operacional aparece aqui."
      />

      <CheckoutOrdersMesa
        activeTab={vm.activeTab}
        onTabChange={(v) => vm.setActiveTab(v as CheckoutTab)}
        isLoading={vm.ordersQuery.isLoading}
        orders={vm.filteredOrders}
        onSelectOrder={vm.setSelectedOrderId}
        onMoveOrderStatus={(orderId, status) =>
          vm.updateOrderStatusMutation.mutate({ orderId, status })
        }
        movingOrderId={vm.updateOrderStatusMutation.variables?.orderId ?? null}
        getOrderTone={getOrderTone}
        getOrderLabel={getOrderLabel}
        getPaymentTone={getPaymentTone}
        getPaymentLabel={getPaymentLabel}
        getFulfillmentLabel={getFulfillmentLabel}
        getShippingLabel={getShippingLabel}
        getCheckoutStageLabel={getCheckoutStageLabel}
      />

      <CheckoutAnalyticsTabs
        productRanking={vm.productRanking}
        customerRanking={vm.customerRanking}
      />

      <CheckoutReportsSheet vm={vm} />

      <ShippingPolicySheet
        open={vm.shippingPolicySheetOpen}
        onOpenChange={vm.setShippingPolicySheetOpen}
        form={vm.shippingPolicyForm}
        onFormChange={vm.setShippingPolicyForm}
        onSave={() => vm.updateShippingPolicyMutation.mutate()}
        isSaving={vm.updateShippingPolicyMutation.isPending}
        getWeekdayLabel={getWeekdayLabel}
        requestBrowserLocation={vm.requestBrowserLocation}
        mapLoading={vm.mapLoading}
        companyAddress={vm.companyAddress}
        mapEmbedUrl={vm.mapEmbedUrl}
        mapCoverageDiameter={vm.mapCoverageDiameter}
      />

      <AbandonmentConfigSheet
        open={vm.abandonmentConfigOpen}
        onOpenChange={vm.setAbandonmentConfigOpen}
        config={vm.abandonmentConfigForm}
        onConfigChange={vm.setAbandonmentConfigForm}
        onSave={() => vm.updateAbandonmentConfigMutation.mutate()}
        onGenerateAiMessage={() => vm.generateAbandonmentMessageMutation.mutate()}
        isSaving={vm.updateAbandonmentConfigMutation.isPending}
        isGenerating={vm.generateAbandonmentMessageMutation.isPending}
      />

      <CheckoutDetailsSheet
        orderId={vm.selectedOrderId}
        onClose={() => vm.setSelectedOrderId(null)}
        order={vm.selectedOrder}
        session={vm.selectedSession}
        listItem={vm.selectedListItem}
        abandonmentTouches={vm.selectedAbandonmentTouches}
        onToggleAbandonmentPause={(paused) =>
          vm.updateAbandonmentStateMutation.mutate(paused)
        }
        onTriggerManualTouch={() => vm.triggerAbandonmentTouchMutation.mutate()}
        abandonmentBusy={vm.updateAbandonmentStateMutation.isPending}
        manualTouchBusy={vm.triggerAbandonmentTouchMutation.isPending}
        getOrderTone={getOrderTone}
        getOrderLabel={getOrderLabel}
        getPaymentTone={getPaymentTone}
        getPaymentLabel={getPaymentLabel}
        getCheckoutStageLabel={getCheckoutStageLabel}
        getCheckoutStageOrder={getCheckoutStageOrder}
      />
    </div>
  );
}
