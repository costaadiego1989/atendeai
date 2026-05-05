import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  RECOVERY_SOURCE_OPTIONS,
  RECOVERY_STATUS_OPTIONS,
} from '@/modules/recovery/components/RecoveryViewHelper';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';
import { MultiSelectFilter } from '@/shared/ui/MultiSelectFilter';

type Props = {
  vm: RecoveryPageViewModel;
};

export function RecoveryReportsSheet({ vm }: Props) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>relatórios de Cobrança</SheetTitle>
          <SheetDescription>
            Exporte um CSV com carteira aberta, promessas, pagamentos e contexto operacional dos casos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Periodo
            </p>
            <div className="mt-3 grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
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
          </div>

          <div className="space-y-2">
            <Label>Buscar no CSV</Label>
            <Input
              value={vm.reportFilters.search}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Devedor, empresa, titulo ou referência"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <MultiSelectFilter
                value={vm.reportFilters.statuses}
                options={RECOVERY_STATUS_OPTIONS.filter((option) => option.value !== 'ALL')}
                onChange={(value) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    statuses: value as typeof current.statuses,
                  }))
                }
                placeholder="Status"
                allLabel="Todos os status"
              />
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <MultiSelectFilter
                value={vm.reportFilters.sources}
                options={RECOVERY_SOURCE_OPTIONS.filter((option) => option.value !== 'ALL')}
                onChange={(value) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    sources: value as typeof current.sources,
                  }))
                }
                placeholder="Origens"
                allLabel="Todas as origens"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          O arquivo sai com devedor, empresa, telefone, origem, status, titulo da Cobrança,
          valor, vencimento, referências, tags e historico operacional principal.
        </div>

        {vm.recoveryActiveReportJob ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{vm.recoveryActiveReportJob.status}</Badge>
              <Badge variant="secondary">{vm.recoveryActiveReportJob.progress}%</Badge>
              {vm.recoveryActiveReportJob.totalItems > 0 ? (
                <Badge variant="secondary">
                  {vm.recoveryActiveReportJob.processedItems}/{vm.recoveryActiveReportJob.totalItems}
                </Badge>
              ) : null}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {vm.recoveryActiveReportJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download sera iniciado automaticamente.'}
              {vm.recoveryActiveReportJob.status === 'PROCESSING' &&
                'Estamos consolidando a carteira de Cobrança e montando o arquivo em segundo plano.'}
              {vm.recoveryActiveReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.recoveryActiveReportJob.fileName ? `: ${vm.recoveryActiveReportJob.fileName}` : ''}.`}
              {vm.recoveryActiveReportJob.status === 'FAILED' &&
                (vm.recoveryActiveReportJob.errorMessage ??
                  'não foi possivel gerar o CSV deste Relatório.')}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReportsOpen(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => vm.syncReportSummaryMutation.mutate()}
            disabled={vm.syncReportSummaryMutation.isPending}
          >
            {vm.syncReportSummaryMutation.isPending ? 'Calculando...' : 'Ver resumo agora'}
          </Button>
          <Button
            onClick={() => vm.generateReportMutation.mutate()}
            disabled={vm.generateReportMutation.isPending}
          >
            {vm.generateReportMutation.isPending ? 'Enfileirando...' : 'Baixar CSV'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
