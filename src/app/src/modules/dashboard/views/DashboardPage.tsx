import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Contact2,
  CreditCard,
  MessageSquareText,
  RefreshCcw,
  Search,
  Siren,
  Sparkles,
  ShoppingCart,
  UserPlus,
  Wallet,
  Webhook,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { KPICard } from '@/shared/ui/KPICard';
import { DashboardOperationsPanel } from '@/modules/dashboard/components/DashboardOperationsPanel';
import { DashboardPipelineChart } from '@/modules/dashboard/components/DashboardPipelineChart';
import { DashboardRecoveryChart } from '@/modules/dashboard/components/DashboardRecoveryChart';
import { DashboardRevenueChart } from '@/modules/dashboard/components/DashboardRevenueChart';
import { DashboardUsagePanel } from '@/modules/dashboard/components/DashboardUsagePanel';
import { DashboardWidgetRenderer } from '@/modules/dashboard/components/DashboardWidgetRenderer';
import { useDashboardPageViewModel } from '@/modules/dashboard/view-models/useDashboardPageViewModel';
import { PageSkeleton } from '@/shared/ui/Skeletons';
import { formatCurrency } from '@/shared/lib/formatters';

const dashboardIconMap = {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Contact2,
  CreditCard,
  MessageSquareText,
  RefreshCcw,
  Search,
  Siren,
  Sparkles,
  ShoppingCart,
  UserPlus,
  Wallet,
  Webhook,
};

export default function DashboardPage() {
  const vm = useDashboardPageViewModel();

  if (vm.isLoading) {
    return <PageSkeleton />;
  }

  if (vm.snapshotQuery.isError && !vm.snapshotQuery.data) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Não foi possível montar a visão executiva agora.</p>
        </div>
        <Card className="glass-card">
          <CardContent className="flex min-h-[320px] items-center justify-center">
            <EmptyState
              icon={Activity}
              title="Falha ao carregar o dashboard"
              description="Tente atualizar a página em instantes para buscar os dados da operação."
              actionLabel="Atualizar"
              onAction={() => void vm.snapshotQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = vm.dashboardProfile;
  const showRevenueChart = profile.key !== 'recovery';
  const showRecoveryChart = profile.key === 'recovery';
  const PrimaryActionIcon =
    dashboardIconMap[profile.primaryAction.icon as keyof typeof dashboardIconMap] ??
    Activity;
  const reportStats = {
    handoff: {
      label: 'Aguardando atendente',
      value: vm.operationReports.handoffQueue,
    },
    risk: {
      label: 'Conversas críticas',
      value: vm.operationReports.sentimentSummary.negative,
    },
    recovery: {
      label: profile.key === 'commerce' ? 'Pedidos' : 'Cobrança',
      value: vm.operationReports.openRecoveryCount,
    },
    paidRate: {
      label: 'Pago',
      value: `${vm.operationReports.checkoutPaidRate}%`,
    },
    contacts: {
      label: 'Contatos',
      value: vm.totalContacts.toLocaleString('pt-BR'),
    },
    intents: {
      label: 'Intenções',
      value: vm.salesSummary.totalIntents,
    },
  };
  const profileKpis =
    profile.key === 'commerce'
      ? [
          {
            title: 'Receita estimada',
            value: formatCurrency(vm.salesSummary.totalRevenue),
            subtitle: `${vm.salesSummary.totalLinks} checkouts emitidos no período`,
            icon: CreditCard,
          },
          {
            title: 'Nova venda confirmada',
            value: formatCurrency(vm.commercialRevenue.newSaleRevenue),
            subtitle: `${vm.commercialRevenue.newSalePaymentsCount} pagamentos de venda`,
            icon: Wallet,
          },
          {
            title: 'Receita recuperada',
            value: formatCurrency(vm.commercialRevenue.recoveredRevenue),
            subtitle: `${vm.commercialRevenue.recoveredPaymentsCount} pagamentos de recovery`,
            icon: Siren,
          },
          {
            title: 'Atendimento humano',
            value: vm.waitingHumanCount,
            subtitle: `${vm.activeConversationCount} conversas abertas agora`,
            icon: MessageSquareText,
          },
        ]
      : profile.key === 'scheduling'
        ? [
            {
              title: 'Atendimento humano',
              value: vm.waitingHumanCount,
              subtitle: `${vm.activeConversationCount} conversas abertas agora`,
              icon: MessageSquareText,
            },
            {
              title: 'Novos contatos',
              value: vm.totalContacts.toLocaleString('pt-BR'),
              subtitle: 'Leads e clientes que chegaram no período',
              icon: Contact2,
            },
            {
              title: 'Receita estimada',
              value: formatCurrency(vm.salesSummary.totalRevenue),
              subtitle: `${vm.salesSummary.totalLinks} cobranças ou checkouts emitidos`,
              icon: CreditCard,
            },
            {
              title: 'Carteira em aberto',
              value: formatCurrency(vm.openRecoveryAmount),
              subtitle: `${vm.openRecoveryCount} casos que pedem acompanhamento`,
              icon: Siren,
            },
          ]
        : profile.key === 'recovery'
          ? [
              {
                title: 'Carteira em aberto',
                value: formatCurrency(vm.openRecoveryAmount),
                subtitle: `${vm.openRecoveryCount} casos em cobrança`,
                icon: Siren,
              },
              {
                title: 'Pagamentos confirmados',
                value: formatCurrency(vm.paymentSummary.paidRevenue),
                subtitle: `${vm.paymentSummary.paidLinks} pagamentos confirmados`,
                icon: Wallet,
              },
              {
                title: 'Atendimento humano',
                value: vm.waitingHumanCount,
                subtitle: `${vm.activeConversationCount} conversas abertas agora`,
                icon: MessageSquareText,
              },
              {
                title: 'Risco em conversas',
                value: vm.operationReports.sentimentSummary.negative,
                subtitle: 'Conversas com sentimento negativo no período',
                icon: Activity,
              },
            ]
          : [
              {
                title: 'Receita estimada',
                value: formatCurrency(vm.salesSummary.totalRevenue),
                subtitle: `${vm.salesSummary.totalLinks} checkouts emitidos no período`,
                icon: CreditCard,
              },
              {
                title: 'Pagamentos confirmados',
                value: formatCurrency(vm.paymentSummary.paidRevenue),
                subtitle: `${vm.paymentSummary.paidLinks} cobranças pagas`,
                icon: Wallet,
              },
              {
                title: 'Atendimento humano',
                value: vm.waitingHumanCount,
                subtitle: `${vm.activeConversationCount} conversas abertas agora`,
                icon: MessageSquareText,
              },
              {
                title: 'Carteira em aberto',
                value: formatCurrency(vm.openRecoveryAmount),
                subtitle: `${vm.openRecoveryCount} casos em cobrança`,
                icon: Siren,
              },
            ];
  const modularKpiWidgets = vm.dashboardLayout.widgets
    .filter((widget) => widget.kind === 'KPI')
    .slice(0, 4);
  const modularKpiTitles = new Set(modularKpiWidgets.map((widget) => widget.title));
  const fallbackKpis = profileKpis
    .filter((kpi) => !modularKpiTitles.has(kpi.title))
    .slice(0, Math.max(0, 4 - modularKpiWidgets.length));

  return (
    <div className="page-container animate-fade-in overflow-x-hidden">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="page-title">
            {profile.title}, {vm.user?.name?.split(' ')[0] || 'time'}
          </h1>
          <p className="page-description">
            Resumo da sua operação nos últimos {vm.range === '7d' ? '7 dias' : '30 dias'}.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
          <div className="flex items-center gap-2">
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
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void vm.snapshotQuery.refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

        <Card className="glass-card overflow-hidden border-primary/15">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {profile.radarLabel}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {profile.radarDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.secondaryActions.map((action) => {
                const ActionIcon =
                  dashboardIconMap[action.icon as keyof typeof dashboardIconMap] ??
                  Activity;

                return (
                  <Link key={`${action.route}-${action.label}`} to={action.route}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ActionIcon className="h-4 w-4" />
                      {action.label}
                    </Button>
                  </Link>
                );
              })}
              <Link to={profile.primaryAction.route}>
                <Button size="sm" className="gap-2">
                  <PrimaryActionIcon className="h-4 w-4" />
                  {profile.primaryAction.label}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Onboarding rápido
                  </Badge>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">
                    Preparação para operar
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {vm.launchProgress.completed} de {vm.launchProgress.total} blocos prontos
                    para a IA trabalhar com contexto seguro.
                  </p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {vm.launchProgress.percent}%
                </p>
              </div>

              <div className="mt-4 h-2 rounded-full bg-muted/60">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${vm.launchProgress.percent}%` }}
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {vm.launchChecklist.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    to={item.route}
                    className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-sm transition hover:border-primary/30 hover:bg-primary/[0.03]"
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Reports operacionais
                  </Badge>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">
                    {profile.reportTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {profile.reportDescription}
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {profile.focusStats.map((statKey) => (
                  <div
                    key={statKey}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {reportStats[statKey].label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {reportStats[statKey].value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {vm.operationReports.topConversationTags.length ? (
                  vm.operationReports.topConversationTags.map((item) => (
                    <Badge key={item.tag} variant="secondary" className="rounded-full">
                      {item.tag} {item.total}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    As tags aparecem conforme as conversas forem classificadas.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      <div className="card-grid">
        {modularKpiWidgets.map((widget) => (
          <DashboardWidgetRenderer
            key={widget.id}
            widget={widget}
            metric={vm.widgetMetrics[widget.queryKey]}
          />
        ))}
        {fallbackKpis.map((kpi) => (
          <KPICard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
        {showRevenueChart ? <DashboardRevenueChart data={vm.revenueSeries} onExportCsv={vm.exportSalesReportCsv} /> : null}
        <DashboardUsagePanel
          usageSeries={vm.usageSeries}
          plan={vm.plan}
          billingCycle={vm.billingCycle}
          onExportCsv={vm.exportUsageCsv}
        />
      </div>

      <div className={`mt-6 grid gap-6 ${showRecoveryChart ? 'xl:grid-cols-2' : ''}`}>
        <DashboardPipelineChart data={vm.pipelineSeries} />
        {showRecoveryChart ? <DashboardRecoveryChart data={vm.recoverySeries} /> : null}
      </div>

      <div className="mt-6">
        <DashboardOperationsPanel
          profileKey={profile.key}
          recentConversations={vm.recentConversations}
          recoveryPriorities={vm.recoveryPriorities}
          recentCharges={vm.recentCharges}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="flex h-full items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-semibold text-foreground">
                Conversas ativas
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {vm.activeConversationCount}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground max-w-[200px]">
                Hoje exigem acompanhamento do time ou da IA.
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 shrink-0">
              <MessageSquareText className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex h-full items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-semibold text-foreground">
                Novos contatos
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {vm.totalContacts.toLocaleString('pt-BR')}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground max-w-[200px]">
                Leads e clientes que entraram no CRM neste período.
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 shrink-0">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex h-full items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-semibold text-foreground">
                Oportunidades abertas
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {vm.salesSummary.totalIntents}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground max-w-[220px]">
                {profile.key === 'commerce'
                  ? 'Pedidos, checkouts e oportunidades que ainda podem gerar receita.'
                  : 'Casos, negociações ou cobranças que ainda podem gerar receita.'}
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 shrink-0">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
