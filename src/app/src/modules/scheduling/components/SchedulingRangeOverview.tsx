import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import type { useSchedulingProfessionalsTabViewModel } from '@/modules/scheduling/view-models/useSchedulingProfessionalsTabViewModel';
import { formatScheduleDate, formatSlotTime, getSlotTone } from '../view-models/scheduling-formatters';

type TabViewModel = ReturnType<typeof useSchedulingProfessionalsTabViewModel>;

type Props = {
  vm: SchedulingPageViewModel;
  tab: TabViewModel;
};

export function SchedulingRangeOverview({ vm, tab }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/[0.16] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {vm.calendarView === 'week' ? 'visão semanal' : 'visão mensal'}
            </p>
            <h3 className="text-lg font-semibold text-foreground">
              Distribuição operacional da agenda
            </h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe ocupação, bloqueios e dias mais pressionados sem perder a leitura executiva
              da agenda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 xl:justify-end">
            <div className="min-w-[132px] rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Slots
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{tab.rangeTotals.total}</p>
            </div>
            <div className="min-w-[136px] rounded-2xl border border-success/20 bg-success/[0.06] px-4 py-3">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-success/80">
                Disponiveis
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {tab.rangeTotals.available}
              </p>
            </div>
            <div className="min-w-[136px] rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/90">
                Reservados
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {tab.rangeTotals.reserved}
              </p>
            </div>
            <div className="min-w-[136px] rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Bloqueados
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {tab.rangeTotals.blocked}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {vm.calendarRange.map((entry) => {
          const breakdown = tab.rangeBreakdownByDate[entry.date] ?? {
            available: 0,
            reserved: 0,
            blocked: 0,
          };

          return (
            <div
              key={entry.date}
              className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {vm.calendarView === 'week' ? 'Dia da semana' : 'Dia do mes'}
                  </p>
                  <h4 className="text-lg font-semibold text-foreground">
                    {formatScheduleDate(entry.date, {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {entry.slots.length
                      ? `${entry.slots.length} horários mapeados nesta data.`
                      : 'Nenhum horário liberado nesta data.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    vm.setSelectedDate(entry.date);
                    vm.setCalendarView('day');
                  }}
                >
                  Abrir dia
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-success/20 bg-success/[0.05] px-4 py-3">
                  <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-success/80">
                    Disponiveis
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{breakdown.available}</p>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
                  <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/90">
                    Reservados
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{breakdown.reserved}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/[0.18] px-4 py-3">
                  <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Bloqueados
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{breakdown.blocked}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {entry.slots.length ? (
                  entry.slots.slice(0, 4).map((slot) => {
                    const tone = getSlotTone(slot.status);

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/[0.14] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatSlotTime(slot)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED'
                              ? slot.reservedFor?.contactName || 'Cliente reservado'
                              : slot.status === 'BLOCKED'
                                ? 'horário bloqueado manualmente'
                                : slot.label || 'Livre para agendamento'}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-3 py-1 text-[11px] font-semibold',
                            tone.badgeClass,
                          )}
                        >
                          {tone.label}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/[0.14] px-4 py-5 text-sm text-muted-foreground">
                    Nenhum horário configurado para esta data.
                  </div>
                )}
              </div>

              {entry.slots.length > 4 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  +{entry.slots.length - 4} horários adicionais nesta data.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
