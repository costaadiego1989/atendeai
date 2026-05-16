import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarSync, ExternalLink, Link2Off } from 'lucide-react';
import { useSchedulingGoogleCalendarViewModel } from '@/modules/scheduling/view-models/useSchedulingGoogleCalendarViewModel';

export function SchedulingGoogleCalendarCard() {
  const vm = useSchedulingGoogleCalendarViewModel();
  const connected = vm.connection?.connected === true;
  const inheritedFromTenant = vm.connection?.scope === 'TENANT';
  const branchScoped = Boolean(vm.activeBranchId);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 mb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <CalendarSync className="h-3.5 w-3.5" />
            Google Calendar
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {connected ? 'Calendário conectado' : 'Conecte sua agenda ao Google Calendar'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {connected
              ? 'Novas reservas, cancelamentos e confirmações de pagamento podem refletir no calendário principal.'
              : 'Autorize uma conta Google para sincronizar reservas e horários confirmados automaticamente.'}
          </p>
          {branchScoped ? (
            <p className="text-xs text-muted-foreground">
              Filial ativa: {vm.activeBranchName || 'Filial selecionada'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">

            </p>
          )}
          {connected ? (
            <div className="space-y-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-700">
              <p className="font-medium text-foreground">
                {vm.connection?.googleEmail || 'Conta conectada'}
              </p>
              {inheritedFromTenant ? (
                <p className="text-xs text-muted-foreground">
                  Esta filial esta usando a conexão global do tenant.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Calendário: {vm.connection?.calendarId || 'primary'}
              </p>
              {vm.calendars.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Calendário de sincronização
                  </p>
                  <Select
                    value={vm.connection?.calendarId || 'primary'}
                    onValueChange={(value) => vm.selectCalendar(value)}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Selecione o calendário" />
                    </SelectTrigger>
                    <SelectContent>
                      {vm.calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          {calendar.summary}
                          {calendar.primary ? ' (Principal)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {connected ? (
            <Button
              variant="outline"
              onClick={() => vm.disconnect()}
              disabled={vm.disconnectMutation.isPending}
            >
              <Link2Off className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          ) : (
            <Button onClick={() => vm.startConnection()} disabled={vm.startMutation.isPending}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Conectar Google Calendar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
