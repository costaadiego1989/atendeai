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
import { useProspectingCampaignsViewModel } from '@/modules/prospecting/view-models/useProspectingCampaignsViewModel';

const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PAUSED', label: 'Pausada' },
  { value: 'COMPLETED', label: 'Concluida' },
  { value: 'ARCHIVED', label: 'Arquivada' },
] as const;

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
] as const;

const AUDIENCE_OPTIONS = [
  { value: 'CONTACT_LIST', label: 'Lista de contatos' },
  { value: 'REENGAGEMENT', label: 'Reengajamento' },
] as const;

type Props = {
  vm: ReturnType<typeof useProspectingCampaignsViewModel>;
};

export function ProspectingCampaignReportsSheet({ vm }: Props) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>relatórios de campanhas</SheetTitle>
          <SheetDescription>
            Exporte um CSV com campanhas, publico, canal, status e volume operacional das execucoes.
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
              placeholder="Nome ou objetivo da campanha"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <MultiSelectFilter
                value={vm.reportFilters.statuses}
                options={[...CAMPAIGN_STATUS_OPTIONS]}
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
              <Label>Canais</Label>
              <MultiSelectFilter
                value={vm.reportFilters.channels}
                options={[...CHANNEL_OPTIONS]}
                onChange={(value) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    channels: value as typeof current.channels,
                  }))
                }
                placeholder="Canais"
                allLabel="Todos os canais"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Publicos</Label>
            <MultiSelectFilter
              value={vm.reportFilters.audienceTypes}
              options={[...AUDIENCE_OPTIONS]}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  audienceTypes: value as typeof current.audienceTypes,
                }))
              }
              placeholder="Publicos"
              allLabel="Todos os publicos"
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
          O arquivo sai com campanha, objetivo, publico, canal, limite diario, quantidade de contatos
          alvo e resumo das execucoes criadas.
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
                'Estamos consolidando as campanhas e montando o arquivo em segundo plano.'}
              {vm.activeReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.activeReportJob.fileName ? `: ${vm.activeReportJob.fileName}` : ''}.`}
              {vm.activeReportJob.status === 'FAILED' &&
                (vm.activeReportJob.errorMessage ??
                  'não foi possível gerar o CSV deste Relatório.')}
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
