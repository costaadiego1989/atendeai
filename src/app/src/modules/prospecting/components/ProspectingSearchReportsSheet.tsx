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
import { useProspectingSearchesViewModel } from '@/modules/prospecting/view-models/useProspectingSearchesViewModel';
import { MultiSelectFilter } from '@/shared/ui/MultiSelectFilter';

const SEARCH_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'RUNNING', label: 'Em andamento' },
  { value: 'COMPLETED', label: 'Concluida' },
  { value: 'FAILED', label: 'Falhou' },
] as const;

const SEARCH_SOURCE_OPTIONS = [
  { value: 'GOOGLE_PLACES', label: 'Google Places' },
  { value: 'GOOGLE_ADS_AUDIENCE', label: 'Google Ads (Audiência)' },
] as const;

type Props = {
  vm: ReturnType<typeof useProspectingSearchesViewModel>;
};

export function ProspectingSearchReportsSheet({ vm }: Props) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>relatórios de prospeccao local</SheetTitle>
          <SheetDescription>
            Exporte um CSV com buscas, territorio, volume encontrado e sinais de contato dos resultados.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label>Busca no CSV</Label>
            <Input
              value={vm.reportFilters.query}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="Segmento, cidade, bairro ou falha"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <MultiSelectFilter
              value={vm.reportFilters.statuses}
              options={[...SEARCH_STATUS_OPTIONS]}
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
            <Label>Fontes</Label>
            <MultiSelectFilter
              value={vm.reportFilters.sources}
              options={[...SEARCH_SOURCE_OPTIONS]}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  sources: value as typeof current.sources,
                }))
              }
              placeholder="Fontes"
              allLabel="Todas as fontes"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={vm.reportFilters.dateFrom}
                onChange={(event) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={vm.reportFilters.dateTo}
                onChange={(event) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          O arquivo sai com termo pesquisado, territorio, status, volume encontrado, quantidade com WhatsApp,
          Instagram, email e timestamps operacionais.
        </div>

        {vm.activeReportJob ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{vm.activeReportJob.status}</Badge>
              <Badge variant="secondary">{vm.activeReportJob.progress}%</Badge>
              {vm.activeReportJob.totalItems > 0 ? (
                <Badge variant="secondary">
                  {vm.activeReportJob.processedItems}/{vm.activeReportJob.totalItems}
                </Badge>
              ) : null}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {vm.activeReportJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download sera iniciado automaticamente.'}
              {vm.activeReportJob.status === 'PROCESSING' &&
                'Estamos consolidando as buscas e montando o arquivo em segundo plano.'}
              {vm.activeReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.activeReportJob.fileName ? `: ${vm.activeReportJob.fileName}` : ''}.`}
              {vm.activeReportJob.status === 'FAILED' &&
                (vm.activeReportJob.errorMessage ??
                  'não foi possivel gerar o CSV deste Relatório.')}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReportsOpen(false)}>
            Fechar
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
