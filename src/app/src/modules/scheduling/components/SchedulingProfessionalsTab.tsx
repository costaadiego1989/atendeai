import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { SchedulingRecurrencesCard } from '@/modules/scheduling/components/SchedulingRecurrencesCard';
import { SchedulingDatePicker } from '@/modules/scheduling/components/SchedulingDatePicker';
import { SchedulingDeleteRecurrenceDialog } from '@/modules/scheduling/components/SchedulingDeleteRecurrenceDialog';
import { SchedulingRecurrenceDetailSheet } from '@/modules/scheduling/components/SchedulingRecurrenceDetailSheet';
import { SchedulingRangeOverview } from '@/modules/scheduling/components/SchedulingRangeOverview';
import { SchedulingDaySlotsTabs } from '@/modules/scheduling/components/SchedulingDaySlotsTabs';
import { SchedulingProfessionalsList } from '@/modules/scheduling/components/SchedulingProfessionalsList';
import { SchedulingRecurrencesGrid } from '@/modules/scheduling/components/SchedulingRecurrencesGrid';
import { SchedulingDayAvailabilityEditor } from '@/modules/scheduling/components/SchedulingDayAvailabilityEditor';
import { Calendar, CalendarRange, Clock3, Repeat2 } from 'lucide-react';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { useSchedulingProfessionalsTabViewModel } from '@/modules/scheduling/view-models/useSchedulingProfessionalsTabViewModel';
import { EmptyState } from '@/shared/ui/EmptyState';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingProfessionalsTab({ vm }: Props) {
  const tab = useSchedulingProfessionalsTabViewModel(vm);

  return (
    <div className="grid gap-4 lg:grid-cols-4 pt-1">
      <SchedulingDeleteRecurrenceDialog
        open={tab.confirmDeleteId !== null}
        isPending={vm.deleteRecurrenceMutation.isPending}
        onOpenChange={(open) => !open && tab.cancelDeleteRecurrence()}
        onConfirm={tab.confirmDeleteRecurrence}
      />

      <SchedulingRecurrenceDetailSheet vm={vm} tab={tab} />

      <SchedulingProfessionalsList vm={vm} />

      <div className="space-y-5 lg:col-span-3">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <CardTitle className="text-base">
                    {tab.scheduleMode === 'day' ? 'Disponibilidade do dia' : 'Atendimentos recorrentes'}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {vm.selectedProfessional
                      ? tab.scheduleMode === 'day'
                        ? `Monte ou ajuste a grade de ${vm.selectedProfessional.name}.`
                        : `Acompanhe os pacotes vendidos para ${vm.selectedProfessional.name}.`
                      : 'Selecione um profissional para editar a agenda.'}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                <Tabs
                  value={tab.scheduleMode}
                  onValueChange={(value) => tab.setScheduleMode(value as 'day' | 'recurring')}
                >
                  <PageTabsList
                    tabs={[
                      { value: 'day', label: 'Agenda do dia', icon: Calendar },
                      { value: 'recurring', label: 'Recorrentes', icon: Repeat2 },
                    ]}
                    className="h-10 w-full justify-start sm:w-fit"
                  />
                </Tabs>
                {tab.scheduleMode === 'day' ? (
                  <SchedulingDatePicker
                    value={vm.selectedDate}
                    onChange={(date) => vm.setSelectedDate(date)}
                    className="lg:w-[200px]"
                  />
                ) : (
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={vm.openRecurrenceForm}
                    disabled={!vm.selectedProfessionalId && vm.professionals.length === 0}
                  >
                    <Repeat2 className="h-4 w-4" />
                    Novo recorrente
                  </Button>
                )}
              </div>
            </div>
            {tab.scheduleMode === 'day' ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={vm.calendarView === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => vm.setCalendarView('day')}
                >
                  Dia
                </Button>
                <Button
                  type="button"
                  variant={vm.calendarView === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => vm.setCalendarView('week')}
                >
                  Semana
                </Button>
                <Button
                  type="button"
                  variant={vm.calendarView === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => vm.setCalendarView('month')}
                >
                  Mes
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {tab.scheduleMode === 'day' ? (
              vm.selectedProfessional ? (
                <SchedulingDayAvailabilityEditor vm={vm} />
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="Selecione um profissional"
                  description="A agenda diaria aparece aqui assim que um profissional for escolhido."
                />
              )
            ) : vm.selectedProfessional ? (
              <SchedulingRecurrencesGrid vm={vm} tab={tab} />
            ) : (
              <EmptyState
                icon={CalendarRange}
                title="Selecione um profissional"
                description="Os contratos recorrentes aparecem aqui assim que um profissional for escolhido."
              />
            )}
          </CardContent>
        </Card>
        <SchedulingRecurrencesCard vm={vm} sheetOnly />

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Slots de Horários</CardTitle>
          </CardHeader>
          <CardContent>
            {tab.isRangeView ? (
              vm.calendarRange.length ? (
                <SchedulingRangeOverview vm={vm} tab={tab} />
              ) : (
                <EmptyState
                  icon={CalendarRange}
                  title={
                    vm.calendarView === 'week' ? 'Sem agenda nesta semana' : 'Sem agenda neste mes'
                  }
                  description="Monte a disponibilidade acima para enxergar a distribuição executiva da agenda."
                />
              )
            ) : vm.availabilitySlots.length ? (
              <SchedulingDaySlotsTabs vm={vm} tab={tab} />
            ) : (
              <EmptyState
                icon={Clock3}
                title="Sem slots para este dia"
                description="Monte a disponibilidade acima para liberar horários na agenda."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
