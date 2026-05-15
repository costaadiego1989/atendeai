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
import { MultiSelectFilter } from '@/shared/ui/MultiSelectFilter';
import type { InventoryPageViewModel } from '@/modules/inventory/view-models/useInventoryPageViewModel';

interface InventoryReportsSheetProps {
  vm: InventoryPageViewModel;
}

export function InventoryReportsSheet({ vm }: InventoryReportsSheetProps) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Exportar estoque</SheetTitle>
          <SheetDescription>
            Gere um CSV com os itens atuais do estoque usando os filtros operacionais.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label>Busca</Label>
            <Input
              value={vm.reportFilters.query}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="SKU, nome ou referência"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <MultiSelectFilter
              value={vm.reportFilters.statuses}
              options={[
                { value: 'AVAILABLE', label: 'Disponivel' },
                { value: 'LOW_STOCK', label: 'Estoque baixo' },
                { value: 'UNAVAILABLE', label: 'Indisponivel' },
                { value: 'RESERVED', label: 'Reservado' },
              ]}
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

          <Button
            type="button"
            variant={vm.reportFilters.availableOnly ? 'default' : 'outline'}
            className="justify-start"
            onClick={() =>
              vm.setReportFilters((current) => ({
                ...current,
                availableOnly: !current.availableOnly,
              }))
            }
          >
            {vm.reportFilters.availableOnly
              ? 'Somente itens disponíveis'
              : 'Incluir itens indisponíveis'}
          </Button>
        </div>

        {vm.activeReportJob && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{vm.activeReportJob.status}</Badge>
              <Badge variant="secondary">{vm.activeReportJob.progress}%</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {vm.activeReportJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download sera iniciado automaticamente.'}
              {vm.activeReportJob.status === 'PROCESSING' &&
                'Estamos consolidando os itens do estoque e montando o arquivo em segundo plano.'}
              {vm.activeReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.activeReportJob.fileName ? `: ${vm.activeReportJob.fileName}` : ''}.`}
              {vm.activeReportJob.status === 'FAILED' &&
                (vm.activeReportJob.errorMessage ??
                  'não foi possível gerar o CSV deste Relatório.')}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReportsOpen(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => vm.syncReportSummaryMutation.mutate(vm.reportFilters)}
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
