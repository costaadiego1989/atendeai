import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarRange, Trash2, XCircle } from 'lucide-react';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import type { useSchedulingProfessionalsTabViewModel } from '@/modules/scheduling/view-models/useSchedulingProfessionalsTabViewModel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatRecurrenceDateRange, frequencyLabels, getRecurrenceStatusLabel } from '../view-models/scheduling-formatters';

type TabViewModel = ReturnType<typeof useSchedulingProfessionalsTabViewModel>;

type Props = {
  vm: SchedulingPageViewModel;
  tab: TabViewModel;
};

export function SchedulingRecurrencesGrid({ vm, tab }: Props) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Ativas
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {tab.activeRecurrences.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Geradas
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {tab.generatedRecurrencesCount}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Proxima
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{tab.nextRecurrenceDate}</p>
        </div>
      </div>

      {vm.recurrences.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {vm.recurrences.map((recurrence) => (
            <div
              key={recurrence.id}
              role="button"
              tabIndex={0}
              onClick={() => tab.setSelectedRecurrence(recurrence)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  tab.setSelectedRecurrence(recurrence);
                }
              }}
              className="self-start cursor-pointer rounded-2xl border border-border/60 bg-background/90 p-5 transition-shadow duration-200 hover:shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)] focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.06] text-primary">
                    <CalendarRange className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatRecurrenceDateRange(recurrence.firstDate, recurrence.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recurrence.startsAt} - {recurrence.endsAt}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                >
                  {getRecurrenceStatusLabel(recurrence.status)}
                </Badge>
              </div>

              <div className="mt-4 rounded-2xl border border-border/60 bg-muted/[0.14] p-3.5 text-xs text-muted-foreground">
                <p>
                  {frequencyLabels[recurrence.period]} a cada {recurrence.interval} ciclo(s)
                </p>
                <p className="mt-1">
                  {recurrence.occurrencesCreated}/{recurrence.maxOccurrences} sessões geradas
                </p>
                {recurrence.nextDate ? (
                  <p className="mt-1">
                    Proxima geracao em {formatRecurrenceDateRange(recurrence.nextDate)}
                  </p>
                ) : null}
                {recurrence.status === 'ACTIVE' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl"
                    onClick={(event) => {
                      event.stopPropagation();
                      vm.cancelRecurrenceMutation.mutate(recurrence.id);
                    }}
                    disabled={vm.cancelRecurrenceMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar contrato
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 mt-4 rounded-xl text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    tab.requestDeleteRecurrence(recurrence.id);
                  }}
                  disabled={vm.deleteRecurrenceMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="Sem atendimentos recorrentes"
          description="Crie um pacote recorrente para vender sessões por cliente, serviço e horário."
        />
      )}
    </>
  );
}
