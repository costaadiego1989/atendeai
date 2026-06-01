import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Trash2, XCircle } from 'lucide-react';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import type { useSchedulingProfessionalsTabViewModel } from '@/modules/scheduling/view-models/useSchedulingProfessionalsTabViewModel';
import { formatPhone } from '@/shared/lib/masks';
import { formatRecurrenceDateRange } from '../view-models/scheduling-formatters';

type TabViewModel = ReturnType<typeof useSchedulingProfessionalsTabViewModel>;

type Props = {
  vm: SchedulingPageViewModel;
  tab: TabViewModel;
};

const frequencyLabels = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
} as const;

export function SchedulingRecurrenceDetailSheet({ vm, tab }: Props) {
  const { selectedRecurrence } = tab;

  return (
    <Sheet
      open={Boolean(selectedRecurrence)}
      onOpenChange={(open) => !open && tab.setSelectedRecurrence(null)}
    >
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Detalhes do recorrente</SheetTitle>
          <SheetDescription>
            Contrato recorrente e sessões geradas na agenda do profissional.
          </SheetDescription>
        </SheetHeader>

        {selectedRecurrence ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
              <p className="font-medium text-foreground">
                {formatRecurrenceDateRange(selectedRecurrence.firstDate, selectedRecurrence.endDate)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {selectedRecurrence.startsAt} - {selectedRecurrence.endsAt}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
              <p>{frequencyLabels[selectedRecurrence.period]} a cada {selectedRecurrence.interval} ciclo(s)</p>
              <p className="mt-1">{selectedRecurrence.occurrencesCreated}/{selectedRecurrence.maxOccurrences} sessões geradas</p>
              {selectedRecurrence.nextDate ? (
                <p className="mt-1">Próxima geração em {formatRecurrenceDateRange(selectedRecurrence.nextDate)}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
              <p className="font-medium text-foreground">Cliente</p>
              <p className="mt-1 text-muted-foreground">
                {tab.selectedRecurrenceContact
                  ? `${tab.selectedRecurrenceContact.name} - ${formatPhone(tab.selectedRecurrenceContact.phone)}`
                  : 'Sem contato vinculado'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
              <p className="font-medium text-foreground">Categoria</p>
              <p className="mt-1 text-muted-foreground">
                {tab.selectedRecurrenceCategory?.name || 'Sem categoria vinculada'}
              </p>
            </div>
            {selectedRecurrence.isOnline ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Consulta online</p>
                <p className="mt-1">O link do Google Meet aparece nos detalhes de cada sessão já gerada na agenda do dia.</p>
              </div>
            ) : null}
            {selectedRecurrence.notes ? (
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                {selectedRecurrence.notes}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedRecurrence.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => vm.cancelRecurrenceMutation.mutate(selectedRecurrence.id)}
                  disabled={vm.cancelRecurrenceMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar contrato
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                onClick={() => tab.requestDeleteRecurrence(selectedRecurrence.id)}
                disabled={vm.deleteRecurrenceMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
