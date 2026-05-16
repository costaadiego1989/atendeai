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
import type { ContactAsyncJob, ContactStage } from '@/shared/types';

interface ReportFilters {
  tags: string;
  stages: ContactStage[];
  timelineTypes: Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>;
  channels: Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>;
  dateFrom: string;
  dateTo: string;
}

interface ContactReportsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ReportFilters;
  activeJob?: ContactAsyncJob | null;
  isPending: boolean;
  onFilterChange: <K extends keyof ReportFilters>(field: K, value: ReportFilters[K]) => void;
  onDownloadCsv: () => void;
}

export function ContactReportsSheet({
  open,
  onOpenChange,
  filters,
  activeJob,
  isPending,
  onFilterChange,
  onDownloadCsv,
}: ContactReportsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Exportar contatos</SheetTitle>
          <SheetDescription>
            Escolha os filtros do CRM e baixe um CSV com os contatos do Relatório atual.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="report-tags">Tags</Label>
            <Input
              id="report-tags"
              value={filters.tags}
              onChange={(event) => onFilterChange('tags', event.target.value)}
              placeholder="VIP, recovery, premium"
            />
          </div>

          <div className="space-y-2">
            <Label>Estagios</Label>
            <MultiSelectFilter
              value={filters.stages}
              options={[
                { value: 'LEAD', label: 'Lead' },
                { value: 'PROSPECT', label: 'Prospect' },
                { value: 'OPPORTUNITY', label: 'Oportunidade' },
                { value: 'CUSTOMER', label: 'Cliente' },
                { value: 'INACTIVE', label: 'Inativo' },
              ]}
              onChange={(value) => onFilterChange('stages', value as ContactStage[])}
              placeholder="Estagios"
              allLabel="Todos os estagios"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipos de evento</Label>
            <MultiSelectFilter
              value={filters.timelineTypes}
              options={[
                { value: 'MESSAGING', label: 'Mensagens' },
                { value: 'RECOVERY', label: 'Recovery' },
                { value: 'PAYMENT', label: 'Pagamentos' },
                { value: 'SCHEDULING', label: 'Agendamentos' },
              ]}
              onChange={(value) =>
                onFilterChange(
                  'timelineTypes',
                  value as Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>,
                )
              }
              placeholder="Tipos de evento"
              allLabel="Todos os tipos"
            />
          </div>

          <div className="space-y-2">
            <Label>Canais</Label>
            <MultiSelectFilter
              value={filters.channels}
              options={[
                { value: 'WHATSAPP', label: 'WhatsApp' },
                { value: 'INSTAGRAM', label: 'Instagram' },
                { value: 'CRM', label: 'CRM' },
              ]}
              onChange={(value) =>
                onFilterChange('channels', value as Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>)
              }
              placeholder="Canais"
              allLabel="Todos os canais"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-date-from">Data inicial</Label>
            <Input
              id="report-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onFilterChange('dateFrom', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-date-to">Data final</Label>
            <Input
              id="report-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onFilterChange('dateTo', event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          O arquivo sai com nome, telefone, documento, e-mail, estagio, tags, ultima
          interação, canais e tipos de evento da timeline.
        </div>

        {activeJob && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{activeJob.status}</Badge>
              <Badge variant="secondary">{activeJob.progress}%</Badge>
              {activeJob.totalItems > 0 && (
                <Badge variant="secondary">
                  {activeJob.processedItems}/{activeJob.totalItems}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {activeJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download será iniciado automaticamente.'}
              {activeJob.status === 'PROCESSING' &&
                'Estamos consolidando os contatos e montando o arquivo em segundo plano.'}
              {activeJob.status === 'COMPLETED' &&
                `CSV pronto${activeJob.fileName ? `: ${activeJob.fileName}` : ''}.`}
              {activeJob.status === 'FAILED' &&
                (activeJob.errorMessage ?? 'não foi possível gerar o CSV deste Relatório.')}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onDownloadCsv} disabled={isPending}>
            {isPending ? 'Enfileirando...' : 'Baixar CSV'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
