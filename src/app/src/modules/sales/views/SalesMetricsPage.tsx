import { BarChart3, CreditCard, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';
import { SalesMetricsRevenueChart } from '@/modules/sales/components/SalesMetricsRevenueChart';
import { formatSalesCurrency } from '@/modules/sales/components/sales-view-helpers';
import { useSalesMetricsPageViewModel } from '@/modules/sales/view-models/useSalesMetricsPageViewModel';
import { DynamicFunnel } from '@/shared/ui/DynamicFunnel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { KPICard } from '@/shared/ui/KPICard';
import { StatusBadge } from '@/shared/ui/StatusBadge';

export function SalesMetricsPage() {
  const vm = useSalesMetricsPageViewModel();

  const formatPercent = (value: number) =>
    `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h1 className="page-title">Metricas de vendas</h1>
            <p className="page-description">
              Painel executivo do funil comercial e das Cobranças emitidas em {vm.rangeLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModuleAgentRuleButton moduleId="sales" buttonSize="sm" />
            <div className="rounded-2xl border border-border/60 bg-background/80 p-1">
              <Button
                size="sm"
                variant={vm.range === '7d' ? 'default' : 'ghost'}
                onClick={() => vm.setRange('7d')}
              >
                7 dias
              </Button>
              <Button
                size="sm"
                variant={vm.range === '30d' ? 'default' : 'ghost'}
                onClick={() => vm.setRange('30d')}
              >
                30 dias
              </Button>
              <Button
                size="sm"
                variant={vm.range === '90d' ? 'default' : 'ghost'}
                onClick={() => vm.setRange('90d')}
              >
                90 dias
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void vm.metricsQuery.refetch();
                void vm.recentChargesQuery.refetch();
              }}
            >
              Atualizar
            </Button>
          </div>
        </div>

        <Card className="glass-card overflow-hidden border-primary/15">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Radar comercial
              </Badge>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Leia aqui a intensidade do interesse comercial, a velocidade de emissao
                de checkouts e o quanto disso ja virou receita capturada.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Melhor dia
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.bestDay ? new Date(vm.bestDay.date).toLocaleDateString('pt-BR') : 'Sem dados'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vm.bestDay
                    ? formatSalesCurrency(vm.bestDay.estimatedRevenue)
                    : 'Aguardando movimentação'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Receita capturada
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatPercent(vm.paidShare)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatSalesCurrency(vm.paymentSummary.paidRevenue)} pagos no periodo recente
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="card-grid mb-6">
        <KPICard
          title="Mensagens comerciais"
          value={vm.summary.totalMessages}
          subtitle="Interacoes que entraram no radar de vendas"
          icon={BarChart3}
        />
        <KPICard
          title="Intencoes de compra"
          value={vm.summary.totalIntents}
          subtitle={`${formatPercent(vm.intentRate)} das mensagens viraram oportunidade`}
          icon={CreditCard}
        />
        <KPICard
          title="Checkouts emitidos"
          value={vm.summary.totalLinks}
          subtitle={`${formatPercent(vm.checkoutRate)} das intencoes viraram Cobrança`}
          icon={Send}
        />
        <KPICard
          title="Receita estimada"
          value={formatSalesCurrency(vm.summary.totalRevenue)}
          subtitle={`Ticket medio de ${formatSalesCurrency(vm.averageTicket)}`}
          icon={CreditCard}
        />
      </div>

      {vm.metricsQuery.isLoading && !vm.metricsQuery.data ? (
        <Card className="glass-card">
          <CardContent className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
            Carregando metricas comerciais...
          </CardContent>
        </Card>
      ) : vm.metricsQuery.isError && !vm.metricsQuery.data ? (
        <Card className="glass-card">
          <CardContent className="flex min-h-[260px] items-center justify-center">
            <EmptyState
              icon={BarChart3}
              title="não foi possivel carregar o painel"
              description="Tente atualizar em instantes para buscar as metricas do comercial."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
            <SalesMetricsRevenueChart data={vm.chartData} />

            <Card className="glass-card">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Efetividade do funil</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Conversao de interesse em checkout e distribuicao recente das Cobranças.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <DynamicFunnel
                  title="Funil dinamico de vendas"
                  description="Acompanhe a passagem de mensagens para oportunidades, checkouts e receita efetivamente paga."
                  gridClassName="md:grid-cols-2"
                  steps={vm.salesFunnel.map((step) => ({
                    id: step.id,
                    label: step.label,
                    count: step.count,
                    helper: step.helper,
                    amountLabel: step.amount != null ? formatSalesCurrency(step.amount) : undefined,
                  }))}
                  emptyMessage="Assim que o comercial gerar movimento, o funil aparece aqui."
                />

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Status recentes
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {vm.statusCards.map((card) => (
                      <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {card.label}
                        </p>
                        <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="glass-card">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Leitura executiva</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Indicadores para decidir se o gargalo esta no interesse, na emissao
                  de Cobranças ou na conversao em receita.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Ticket medio
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatSalesCurrency(vm.averageTicket)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valor medio por checkout emitido
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Receita paga
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatSalesCurrency(vm.paymentSummary.paidRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valor que ja entrou efetivamente
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Checkouts ativos
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {vm.paymentSummary.activeLinks}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cobranças ainda abertas para conversao
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Receita em jogo
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatSalesCurrency(vm.paymentSummary.estimatedRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Soma das Cobranças ainda monitoradas
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Checkouts recentes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ultimas Cobranças emitidas pelo time para acompanhar timing e follow-up.
                </p>
              </CardHeader>
              <CardContent>
                {!vm.recentCharges.length ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    Ainda não ha checkouts recentes para exibir.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vm.recentCharges.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border/60 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.contactName || 'Contato não vinculado'} •{' '}
                              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatSalesCurrency(item.value)}</Badge>
                          <Badge variant="outline">{item.source === 'AI' ? 'IA' : 'Manual'}</Badge>
                          <Badge variant="outline">
                            {item.resourceType === 'PAYMENT' ? 'Checkout split' : 'Link'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
