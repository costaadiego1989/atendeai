import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarSync, ExternalLink, Link2Off, Check } from 'lucide-react';
import { useSchedulingGoogleCalendarViewModel } from '@/modules/scheduling/view-models/useSchedulingGoogleCalendarViewModel';

export function SchedulingGoogleCalendarCard() {
  const vm = useSchedulingGoogleCalendarViewModel();
  const connected = vm.connection?.connected === true;

  if (connected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 mb-5">
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" />
          <span className="font-medium">Google Calendar conectado</span>
          <span className="text-muted-foreground">
            ({vm.connection?.googleEmail || 'Conta conectada'})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => vm.disconnect()}
          disabled={vm.disconnectMutation.isPending}
          className="text-muted-foreground hover:text-destructive"
        >
          <Link2Off className="mr-1.5 h-3.5 w-3.5" />
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 mb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <CalendarSync className="h-3.5 w-3.5" />
            Google Calendar
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Conecte sua agenda ao Google Calendar
          </h3>
          <p className="text-sm text-muted-foreground">
            Autorize uma conta Google para sincronizar reservas e horários confirmados automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => vm.startConnection()} disabled={vm.startMutation.isPending}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Conectar Google Calendar
          </Button>
        </div>
      </div>
    </div>
  );
}
