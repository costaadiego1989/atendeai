import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarRange, Globe, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingDayAvailabilityEditor({ vm }: Props) {
  return (
    <>
      {vm.availabilityDraft.map((slot, index) => (
        <div
          key={`${index}-${slot.startsAt}-${slot.endsAt}`}
          className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 lg:grid-cols-[120px_120px_minmax(0,1fr)_130px_max-content_auto]"
        >
          <Input
            type="time"
            value={slot.startsAt}
            onChange={(event) => vm.updateAvailabilityRow(index, 'startsAt', event.target.value)}
          />
          <Input
            type="time"
            value={slot.endsAt}
            onChange={(event) => vm.updateAvailabilityRow(index, 'endsAt', event.target.value)}
          />
          <Input
            value={slot.label}
            onChange={(event) => vm.updateAvailabilityRow(index, 'label', event.target.value)}
            placeholder="Etiqueta opcional"
          />
          <Input
            inputMode="decimal"
            value={slot.customPrice}
            onChange={(event) =>
              vm.updateAvailabilityRow(
                index,
                'customPrice',
                event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'),
              )
            }
            placeholder="preço"
          />
          <Button
            type="button"
            variant={slot.isOnline ? 'default' : 'secondary'}
            size="icon"
            className={cn(
              'rounded-xl transition-all',
              slot.isOnline
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => vm.updateAvailabilityRow(index, 'isOnline', !slot.isOnline)}
            title="Agendamento online (Meet)"
          >
            <Globe className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => vm.removeAvailabilityRow(index)}
            disabled={vm.availabilityDraft.length === 1}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-3 mt-4">
        <Button type="button" variant="outline" className="h-10" onClick={vm.addAvailabilityRow}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar horário
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={vm.openBulkSlotGenerator}
        >
          <CalendarRange className="mr-2 h-4 w-4" />
          Gerar lote de horários
        </Button>
        <Button
          type="button"
          className="h-10 ml-auto"
          onClick={vm.saveAvailability}
          disabled={vm.saveAvailabilityMutation.isPending}
        >
          Salvar horários do dia
        </Button>
      </div>

      {vm.bulkProgress ? (
        <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm text-muted-foreground">
          {vm.bulkProgress.current} de {vm.bulkProgress.total} dias gerados
        </div>
      ) : null}
    </>
  );
}
