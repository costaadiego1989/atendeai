import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingRescheduleReservationSheet({ vm }: Props) {
  return (
    <Sheet
      open={vm.rescheduleReservationOpen}
      onOpenChange={vm.setRescheduleReservationOpen}
    >
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Remarcar reserva</SheetTitle>
          <SheetDescription>
            Escolha a nova data e o novo horário livre para mover esse atendimento.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
            <p className="font-medium text-foreground">
              Atual:{' '}
              {vm.selectedSlotDetails
                ? `${vm.selectedDate} - ${vm.selectedSlotDetails.startsAt} - ${vm.selectedSlotDetails.endsAt}`
                : 'Nenhuma reserva selecionada'}
            </p>
            <p className="mt-1 text-muted-foreground">
              {vm.selectedSlotDetails?.reservedFor?.contactName || 'Cliente não identificado'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-target-date">Nova data</Label>
            <Input
              id="reschedule-target-date"
              type="date"
              value={vm.rescheduleReservationForm.targetDate}
              onChange={(event) =>
                vm.setRescheduleReservationForm((current) => ({
                  ...current,
                  targetDate: event.target.value,
                  targetSlotId: '',
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-target-slot">Novo horário</Label>
            <Select
              value={vm.rescheduleReservationForm.targetSlotId}
              onValueChange={(value) =>
                vm.setRescheduleReservationForm((current) => ({
                  ...current,
                  targetSlotId: value,
                }))
              }
            >
              <SelectTrigger id="reschedule-target-slot">
                <SelectValue placeholder="Selecione um horário livre" />
              </SelectTrigger>
              <SelectContent>
                {vm.rescheduleAvailableSlots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {slot.startsAt} - {slot.endsAt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!vm.rescheduleAvailableSlots.length ? (
              <p className="text-xs text-muted-foreground">
                não encontramos horários livres para essa data.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setRescheduleReservationOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitRescheduleReservation}
            disabled={vm.rescheduleReservationMutation.isPending}
          >
            Confirmar remarcação
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
