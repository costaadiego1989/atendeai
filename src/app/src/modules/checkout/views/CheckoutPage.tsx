import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCheckoutPageViewModel,
  type CheckoutTab,
} from '@/modules/checkout/view-models/useCheckoutPageViewModel';
import { getShippingLabel, getWeekdayLabel } from '@/modules/checkout/view-models/checkout-ui-utils';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { CheckoutKPIs } from '../components/CheckoutKPIs';
import { CheckoutOrdersMesa } from '../components/CheckoutOrdersMesa';
import { CheckoutDetailsSheet } from '../components/CheckoutDetailsSheet';
import { CheckoutAnalyticsTabs } from '../components/CheckoutAnalyticsTabs';
import { CheckoutRevenueChart } from '../components/CheckoutRevenueChart';
import { CheckoutPeriodPicker } from '../components/CheckoutPeriodPicker';
import { AbandonmentConfigSheet } from '../components/AbandonmentConfigSheet';
import { ShippingPolicySheet } from '../components/ShippingPolicySheet';
import { CheckoutReportsSheet } from '../components/CheckoutReportsSheet';
import { formatCurrency } from '@/shared/lib/formatters';
import { DynamicFunnel } from '@/shared/ui/DynamicFunnel';
import { CalendarDays, Download } from 'lucide-react';

export default function CheckoutPage() {
  const vm = useCheckoutPageViewModel();
  const shippingPolicy = vm.shippingPolicyQuery.data;

  return (
    <div className="page-container animate-fade-in">
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
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CheckoutPeriodPicker
              periodFilter={vm.periodFilter}
              customRange={vm.customRange}
              periodOptions={vm.periodOptions}
              onSelectPreset={vm.applyPeriodPreset}
              onSelectRange={vm.applyCustomRange}
            />

            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={vm.downloadReport}
            >
              <Download className="h-4 w-4" />
              Gerar Relatório
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
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="space-y-6">
          <CheckoutKPIs summary={vm.summary} deltas={vm.summaryDeltas} />

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
        </div>

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
        />
      </div>

      <CheckoutRevenueChart data={vm.dailyRevenueSeries} />

      <CheckoutAnalyticsTabs
        productRanking={vm.productRanking}
        customerRanking={vm.customerRanking}
        activeTab={vm.analyticsTab}
        onTabChange={vm.setAnalyticsTab}
      />

      <CheckoutReportsSheet vm={vm} />

      <ShippingPolicySheet
        open={vm.shippingPolicySheetOpen}
        onOpenChange={vm.setShippingPolicySheetOpen}
        form={vm.shippingPolicyForm}
        onFormChange={vm.setShippingPolicyForm}
        onSave={() => vm.updateShippingPolicyMutation.mutate()}
        isSaving={vm.updateShippingPolicyMutation.isPending}
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
      />
    </div>
  );
}
