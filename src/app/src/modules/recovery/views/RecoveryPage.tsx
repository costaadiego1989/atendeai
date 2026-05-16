import {
  BookMarked,
  Bot,
  CalendarDays,
  CircleDollarSign,
  Download,
  HandCoins,
  MessageSquareHeart,
  Plus,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppPagination } from '@/shared/ui/AppPagination';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { RecoveryCaseDetailSheet } from '@/modules/recovery/components/RecoveryCaseDetailSheet';
import { RecoveryDialogs } from '@/modules/recovery/components/RecoveryDialogs';
import { RecoveryMetricCard } from '@/modules/recovery/components/RecoveryMetricCard';
import { RecoveryPlaybooksSheet } from '@/modules/recovery/components/RecoveryPlaybooksSheet';
import { RecoveryReportsSheet } from '@/modules/recovery/components/RecoveryReportsSheet';
import {
  RECOVERY_SOURCE_OPTIONS,
  RECOVERY_STATUS_OPTIONS,
} from '@/modules/recovery/components/RecoveryViewHelper';
import { recoverySourceLabels } from '@/modules/recovery/components/RecoveryLabel';
import {
  getRecoveryCommercialContext,
  getRecoveryCommercialToneClassName,
} from '@/modules/recovery/utils/recovery-commercial';
import { useRecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';
import { formatCurrency } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import type { RecoverySource, RecoveryStatus } from '@/shared/types';
import { TableSkeleton } from '@/shared/ui/Skeletons';

export default function RecoveryPage() {
  const vm = useRecoveryPageViewModel();

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Recuperação de clientes</h1>
          <p className="page-description">
            Gerencie cobranças em atraso e acompanhe a recuperação de valores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModuleAgentRuleButton moduleId="recovery" className="gap-1.5" />
          <Button size="sm" className="gap-1.5" onClick={() => vm.setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo caso
          </Button>
        </div>
      </div>

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.recoveryActiveJobItems}
      />

      <Card className="glass-card border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório da Cobrança</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1 sm:w-fit">
              {vm.periodOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.periodFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  title={option.description}
                  onClick={() => vm.setPeriodFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={() => vm.setReportsOpen(true)}
            >
              <Download className="h-4 w-4" />
              Relatórios
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="card-grid">
        <RecoveryMetricCard
          icon={HandCoins}
          title="Carteira aberta"
          value={String(vm.summary.openCount)}
          subtitle={`${formatCurrency(vm.summary.openAmount) ?? 'R$ 0,00'} pendentes em operação.`}
        />
        <RecoveryMetricCard
          icon={MessageSquareHeart}
          title="Promessas"
          value={String(vm.summary.promiseCount)}
          subtitle="Casos aguardando confirmação de pagamento."
        />
        <RecoveryMetricCard
          icon={CircleDollarSign}
          title="Pagos"
          value={String(vm.summary.paidCount)}
          subtitle={`${formatCurrency(vm.summary.paidAmount) ?? 'R$ 0,00'} conciliados.`}
        />
        <RecoveryMetricCard
          icon={Bot}
          title="Sugestões prontas"
          value={String(vm.summary.guidanceCount)}
          subtitle="Casos com resposta sugerida para o atendente."
        />
      </div>

      <div className="space-y-4">
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              {vm.filteredCases && (
                <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
                  <span className="font-bold text-foreground mr-1.5">{vm.filteredCases.length}</span>
                  <span className="font-normal text-muted-foreground">{vm.filteredCases.length === 1 ? 'caso' : 'casos'}</span>
                </Badge>
              )}
              <div className="relative flex-1 lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={vm.search}
                  onChange={(event) => vm.setSearch(event.target.value)}
                  placeholder="Buscar por devedor, empresa, título ou referência..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={vm.statusFilter}
                onValueChange={(value: 'ALL' | RecoveryStatus) => vm.setStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOVERY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={vm.sourceFilter}
                onValueChange={(value: 'ALL' | RecoverySource) => vm.setSourceFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOVERY_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {vm.casesQuery.isLoading ? (
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-6">
              <TableSkeleton cols={5} />
            </CardContent>
          </Card>
        ) : vm.pageCases.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nenhum caso encontrado"
            description="Ajuste os filtros ou crie um novo caso para iniciar a recuperação."
            actionLabel="Novo caso"
            onAction={() => vm.setCreateOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            <Card className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border/40 bg-muted/20">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                  Casos de recuperação
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Devedor</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vm.pageCases.map((item) => {
                    const commercial = getRecoveryCommercialContext(item);

                    return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => vm.selectCase(item.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.debtorName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.debtorCompanyName || formatPhone(item.phone)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.chargeTitle || 'Cobrança manual'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.chargeDescription || item.relatedEntityLabel || 'Sem contexto adicional'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.amountDue != null ? formatCurrency(item.amountDue) ?? '-' : '-'}
                      </TableCell>
                      <TableCell>{recoverySourceLabels[item.source] ?? item.source}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          <Badge
                            variant="outline"
                            className={getRecoveryCommercialToneClassName(commercial.tone)}
                          >
                            {commercial.kindLabel}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">
                            {item.paidAt
                              ? new Date(item.paidAt).toLocaleString('pt-BR')
                              : item.lastContactedAt
                                ? new Date(item.lastContactedAt).toLocaleString('pt-BR')
                                : new Date(item.createdAt).toLocaleString('pt-BR')}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {commercial.statusLabel}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <AppPagination
              page={vm.page}
              totalPages={vm.totalPages}
              totalItems={vm.filteredCases.length}
              currentItemsCount={vm.pageCases.length}
              itemLabel="casos"
              onPageChange={vm.setPage}
            />
          </div>
        )}
      </div>

      <RecoveryCaseDetailSheet vm={vm} />
      <RecoveryReportsSheet vm={vm} />
      <RecoveryPlaybooksSheet vm={vm} />
      <RecoveryDialogs vm={vm} />
    </div>
  );
}
