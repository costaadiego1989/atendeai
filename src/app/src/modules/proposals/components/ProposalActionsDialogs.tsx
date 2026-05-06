import { AlertTriangle, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProposalRecord } from '../types';

type Props = {
  scheduleTarget: ProposalRecord | null;
  scheduleAt: string;
  isSchedulePending: boolean;
  deleteTarget: ProposalRecord | null;
  isDeletePending: boolean;
  onScheduleAtChange: (value: string) => void;
  onCloseSchedule: () => void;
  onConfirmSchedule: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
};

export function ProposalActionsDialogs({
  scheduleTarget,
  scheduleAt,
  isSchedulePending,
  deleteTarget,
  isDeletePending,
  onScheduleAtChange,
  onCloseSchedule,
  onConfirmSchedule,
  onCloseDelete,
  onConfirmDelete,
}: Props) {
  return (
    <>
      <Dialog
        open={Boolean(scheduleTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseSchedule();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar envio da proposta</DialogTitle>
            <DialogDescription>
              A fila vai disparar a mensagem para o contato com o PDF anexado no horário definido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Data e horário</Label>
            <Input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => onScheduleAtChange(event.target.value)}
            />
          </div>

          {scheduleTarget ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{scheduleTarget.title}</p>
              <p className="mt-1">
                Ao confirmar, o worker de entrega envia esta proposta para o contato associado.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={onCloseSchedule}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={onConfirmSchedule} disabled={isSchedulePending}>
              <CalendarClock className="h-4 w-4" />
              {isSchedulePending ? 'Agendando...' : 'Confirmar agendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseDelete();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Excluir proposta
            </DialogTitle>
            <DialogDescription>
              Esta ação remove a proposta da lista. O PDF e o agendamento vinculados também deixam
              de fazer sentido.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <div className="rounded-2xl border border-destructive/15 bg-destructive/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{deleteTarget.title}</p>
              <p className="mt-1">Deseja continuar com a exclusão permanente deste registro?</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={onCloseDelete}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeletePending}>
              {isDeletePending ? 'Excluindo...' : 'Excluir proposta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
