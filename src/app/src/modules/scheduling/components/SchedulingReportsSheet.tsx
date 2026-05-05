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
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingReportsSheet({ vm }: Props) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Relatórios da agenda</SheetTitle>
          <SheetDescription>
            Escolha o período e exporte um CSV com slots, reservas, status e receita estimada.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Data inicial</Label>
            <Input
              type="date"
              value={vm.reportFilters.startDate}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Data final</Label>
            <Input
              type="date"
              value={vm.reportFilters.endDate}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Profissional</Label>
            <MultiSelectFilter
              value={vm.reportFilters.professionalIds}
              options={vm.professionals.map((professional) => ({
                value: professional.id,
                label: professional.name,
              }))}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  professionalIds: value,
                }))
              }
              placeholder="Profissionais"
              allLabel="Todos os profissionais"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <MultiSelectFilter
              value={vm.reportFilters.statuses}
              options={[
                { value: 'AVAILABLE', label: 'Disponivel' },
                { value: 'PRE_RESERVED', label: 'Pre-reservado' },
                { value: 'RESERVED', label: 'Reservado' },
                { value: 'COMPLETED', label: 'Concluido' },
                { value: 'NO_SHOW', label: 'No-show' },
                { value: 'BLOCKED', label: 'Bloqueado' },
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

          <div className="space-y-2 md:col-span-2">
            <Label>Categoria</Label>
            <MultiSelectFilter
              value={vm.reportFilters.categoryIds}
              options={vm.categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  categoryIds: value,
                }))
              }
              placeholder="Categorias"
              allLabel="Todas as categorias"
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          O arquivo sai com data, profissional, horário, status, categoria, cliente,
          telefone, valor, pagamento e observações da reserva.
        </div>

        {vm.schedulingActiveReportJob && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{vm.schedulingActiveReportJob.status}</Badge>
              <Badge variant="secondary">{vm.schedulingActiveReportJob.progress}%</Badge>
              {vm.schedulingActiveReportJob.totalItems > 0 && (
                <Badge variant="secondary">
                  {vm.schedulingActiveReportJob.processedItems}/{vm.schedulingActiveReportJob.totalItems}
                </Badge>
              )}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {vm.schedulingActiveReportJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download sera iniciado automaticamente.'}
              {vm.schedulingActiveReportJob.status === 'PROCESSING' &&
                'Estamos consolidando os slots da agenda e montando o arquivo em segundo plano.'}
              {vm.schedulingActiveReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.schedulingActiveReportJob.fileName ? `: ${vm.schedulingActiveReportJob.fileName}` : ''}.`}
              {vm.schedulingActiveReportJob.status === 'FAILED' &&
                (vm.schedulingActiveReportJob.errorMessage ??
                  'não foi possível gerar o CSV deste relatório.')}
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
