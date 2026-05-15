import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { SchedulingRecurrencesCard } from '@/modules/scheduling/components/SchedulingRecurrencesCard';
import {
  Calendar,
  CalendarRange,
  ChevronRight,
  Clock3,
  Link2,
  Lock,
  Plus,
  Repeat2,
  Trash2,
  Unlock,
  UserRound,
  X,
  XCircle,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatDateTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import {
  formatCurrency,
  formatRecurrenceDateRange,
  formatScheduleDate,
  formatSlotTime,
  getRecurrenceStatusLabel,
  getSlotTone,
} from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
};

const frequencyLabels = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
} as const;

export function SchedulingProfessionalsTab({ vm }: Props) {
  const [slotsDayTab, setSlotsDayTab] = useState<'open' | 'reserved'>('open');
  const [scheduleMode, setScheduleMode] = useState<'day' | 'recurring'>('day');
  const [selectedRecurrence, setSelectedRecurrence] = useState<
    (typeof vm.recurrences)[number] | null
  >(null);

  useEffect(() => {
    vm.syncAvailabilityDraftFromLoaded();
  }, [vm.selectedProfessionalId, vm.selectedDate, vm.availabilitySlots.length]);

  useEffect(() => {
    setSlotsDayTab('open');
  }, [vm.selectedProfessionalId, vm.selectedDate]);

  const isRangeView = vm.calendarView !== 'day';
  const openSlots = vm.availabilitySlots.filter(
    (slot) =>
      slot.status !== 'RESERVED' &&
      slot.status !== 'PRE_RESERVED' &&
      slot.status !== 'COMPLETED' &&
      slot.status !== 'NO_SHOW',
  );
  const reservedSlots = vm.availabilitySlots.filter(
    (slot) =>
      slot.status === 'RESERVED' ||
      slot.status === 'PRE_RESERVED' ||
      slot.status === 'COMPLETED' ||
      slot.status === 'NO_SHOW',
  );
  const activeRecurrences = vm.recurrences.filter((recurrence) => recurrence.status === 'ACTIVE');
  const generatedRecurrencesCount = vm.recurrences.reduce(
    (total, recurrence) => total + recurrence.occurrencesCreated,
    0,
  );
  const nextRecurrenceDate =
    formatRecurrenceDateRange(
      activeRecurrences.find((recurrence) => recurrence.nextDate)?.nextDate ?? '',
    );
  const selectedRecurrenceContact = selectedRecurrence?.contactId
    ? vm.contacts.find((contact) => contact.id === selectedRecurrence.contactId)
    : null;
  const selectedRecurrenceCategory = selectedRecurrence?.categoryId
    ? vm.categories.find((category) => category.id === selectedRecurrence.categoryId)
    : null;
  function deleteRecurrence(recurrenceId: string) {
    if (!window.confirm('Excluir este atendimento recorrente? As sessões já geradas permanecem na agenda.')) {
      return;
    }

    vm.deleteRecurrenceMutation.mutate(recurrenceId, {
      onSuccess: () => setSelectedRecurrence(null),
    });
  }
  const rangeTotals = vm.calendarRange.reduce(
    (accumulator, entry) => {
      accumulator.total += entry.slots.length;
      accumulator.available += entry.slots.filter((slot) => slot.status === 'AVAILABLE').length;
      accumulator.reserved += entry.slots.filter(
        (slot) =>
          slot.status === 'RESERVED' ||
          slot.status === 'PRE_RESERVED' ||
          slot.status === 'COMPLETED' ||
          slot.status === 'NO_SHOW',
      ).length;
      accumulator.blocked += entry.slots.filter((slot) => slot.status === 'BLOCKED').length;
      return accumulator;
    },
    { total: 0, available: 0, reserved: 0, blocked: 0 },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-4 pt-1">
      <Sheet open={Boolean(selectedRecurrence)} onOpenChange={(open) => !open && setSelectedRecurrence(null)}>
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
                  {selectedRecurrenceContact
                    ? `${selectedRecurrenceContact.name} - ${formatPhone(selectedRecurrenceContact.phone)}`
                    : 'Sem contato vinculado'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
                <p className="font-medium text-foreground">Categoria</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedRecurrenceCategory?.name || 'Sem categoria vinculada'}
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
                  onClick={() => deleteRecurrence(selectedRecurrence.id)}
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

      <Card className="glass-card lg:col-span-1 h-fit">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Profissionais</CardTitle>
          <Button size="icon" onClick={() => vm.setCreateProfessionalOpen(true)} className="h-8 w-8 rounded-lg shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all text-primary-foreground">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {vm.professionals.length ? (
            vm.professionals.map((professional) => (
              <button
                key={professional.id}
                onClick={() => vm.setSelectedProfessionalId(professional.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-all',
                  vm.selectedProfessionalId === professional.id
                    ? 'border-primary/30 bg-primary/[0.05]'
                    : 'border-border/60 hover:bg-muted/20',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{professional.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {professional.phone
                        ? formatPhone(professional.phone)
                        : 'Telefone para confirmacoes não definido'}
                    </p>
                  </div>
                  <StatusBadge status={professional.active ? 'ACTIVE' : 'CLOSED'} />
                </div>
                {vm.professionalCategoryMap[professional.id]?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vm.professionalCategoryMap[professional.id]
                      .slice(0, 3)
                      .map((category) => (
                        <Badge
                          key={category.id}
                          variant="secondary"
                          className="rounded-full px-2.5 py-1 text-[11px]"
                        >
                          {category.name}
                        </Badge>
                      ))}
                    {vm.professionalCategoryMap[professional.id].length > 3 ? (
                      <Badge
                        variant="outline"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        +{vm.professionalCategoryMap[professional.id].length - 3}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Nenhuma categoria vinculada ainda.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={(event) => {
                      event.stopPropagation();
                      vm.openAssignCategories(professional.id);
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular categorias
                  </Button>
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              icon={UserRound}
              title="Nenhum profissional"
              description="Cadastre o primeiro profissional para montar sua agenda."
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-5 lg:col-span-3">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <CardTitle className="text-base">
                    {scheduleMode === 'day' ? 'Disponibilidade do dia' : 'Atendimentos recorrentes'}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {vm.selectedProfessional
                      ? scheduleMode === 'day'
                        ? `Monte ou ajuste a grade de ${vm.selectedProfessional.name}.`
                        : `Acompanhe os pacotes vendidos para ${vm.selectedProfessional.name}.`
                      : 'Selecione um profissional para editar a agenda.'}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                <Tabs
                  value={scheduleMode}
                  onValueChange={(value) => setScheduleMode(value as 'day' | 'recurring')}
                >
                  <PageTabsList
                    tabs={[
                      { value: 'day', label: 'Agenda do dia', icon: Calendar },
                      { value: 'recurring', label: 'Recorrentes', icon: Repeat2 },
                    ]}
                    className="h-10 w-full justify-start sm:w-fit"
                  />
                </Tabs>
                {scheduleMode === 'day' ? (
                  <Input
                    type="date"
                    value={vm.selectedDate}
                    onChange={(event) => vm.setSelectedDate(event.target.value)}
                    className="h-10 w-full rounded-xl lg:w-[180px]"
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
            {scheduleMode === 'day' ? (
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
            {scheduleMode === 'day' ? (
              vm.selectedProfessional ? (
              <>
                {vm.availabilityDraft.map((slot, index) => (
                  <div
                    key={`${index}-${slot.startsAt}-${slot.endsAt}`}
                    className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 lg:grid-cols-[120px_120px_minmax(0,1fr)_130px_max-content_auto]"
                  >
                    <Input
                      type="time"
                      value={slot.startsAt}
                      onChange={(event) =>
                        vm.updateAvailabilityRow(index, 'startsAt', event.target.value)
                      }
                    />
                    <Input
                      type="time"
                      value={slot.endsAt}
                      onChange={(event) =>
                        vm.updateAvailabilityRow(index, 'endsAt', event.target.value)
                      }
                    />
                    <Input
                      value={slot.label}
                      onChange={(event) =>
                        vm.updateAvailabilityRow(index, 'label', event.target.value)
                      }
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
                      className={cn("rounded-xl transition-all", slot.isOnline ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
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
              </>
            ) : (
              <EmptyState
                icon={Calendar}
                title="Selecione um profissional"
                description="A agenda diaria aparece aqui assim que um profissional for escolhido."
              />
              )
            ) : vm.selectedProfessional ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Ativas
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {activeRecurrences.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Geradas
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {generatedRecurrencesCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Proxima
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {nextRecurrenceDate}
                    </p>
                  </div>
                </div>

                {vm.recurrences.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {vm.recurrences.map((recurrence) => (
                      <div
                        key={recurrence.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRecurrence(recurrence)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedRecurrence(recurrence);
                          }
                        }}
                        className="self-start cursor-pointer rounded-3xl border border-border/60 bg-background/90 p-5 transition-shadow duration-200 hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.06] text-primary">
                              <CalendarRange className="h-5 w-5" />
                            </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {formatRecurrenceDateRange(
                                    recurrence.firstDate,
                                    recurrence.endDate,
                                  )}
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
                            {frequencyLabels[recurrence.period]} a cada {recurrence.interval}{' '}
                            ciclo(s)
                          </p>
                          <p className="mt-1">
                            {recurrence.occurrencesCreated}/{recurrence.maxOccurrences} sessões
                            geradas
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
                              deleteRecurrence(recurrence.id);
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
            {isRangeView ? (
              vm.calendarRange.length ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-border/60 bg-muted/[0.16] p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          {vm.calendarView === 'week' ? 'visão semanal' : 'visão mensal'}
                        </p>
                        <h3 className="text-lg font-semibold text-foreground">
                          Distribuição operacional da agenda
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Acompanhe ocupação, bloqueios e dias mais pressionados sem perder a
                          leitura executiva da agenda.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <div className="min-w-[132px] rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Slots
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {rangeTotals.total}
                          </p>
                        </div>
                        <div className="min-w-[136px] rounded-2xl border border-success/20 bg-success/[0.06] px-4 py-3">
                          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-success/80">
                            Disponiveis
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {rangeTotals.available}
                          </p>
                        </div>
                        <div className="min-w-[136px] rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
                          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/90">
                            Reservados
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {rangeTotals.reserved}
                          </p>
                        </div>
                        <div className="min-w-[136px] rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Bloqueados
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {rangeTotals.blocked}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {vm.calendarRange.map((entry) => {
                      const availableCount = entry.slots.filter(
                        (slot) => slot.status === 'AVAILABLE',
                      ).length;
                      const reservedCount = entry.slots.filter(
                        (slot) =>
                          slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED',
                      ).length;
                      const blockedCount = entry.slots.filter(
                        (slot) => slot.status === 'BLOCKED',
                      ).length;

                      return (
                        <div
                          key={entry.date}
                          className="rounded-3xl border border-border/60 bg-background/90 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)]"
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
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {availableCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
                              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/90">
                                Reservados
                              </p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {reservedCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-muted/[0.18] px-4 py-3">
                              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                Bloqueados
                              </p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {blockedCount}
                              </p>
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
              ) : (
                <EmptyState
                  icon={CalendarRange}
                  title={
                    vm.calendarView === 'week'
                      ? 'Sem agenda nesta semana'
                      : 'Sem agenda neste mes'
                  }
                  description="Monte a disponibilidade acima para enxergar a distribuição executiva da agenda."
                />
              )
            ) : vm.availabilitySlots.length ? (
              <Tabs
                value={slotsDayTab}
                onValueChange={(value) => setSlotsDayTab(value as 'open' | 'reserved')}
                className="space-y-4"
              >
                <PageTabsList
                  tabs={[
                    { value: 'open', label: `Agenda aberta (${openSlots.length})`, icon: Unlock },
                    { value: 'reserved', label: `Reservados (${reservedSlots.length})`, icon: Lock },
                  ]}
                />

                <TabsContent value="open" className="space-y-0">
                  {openSlots.length ? (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {openSlots.map((slot) => {
                        const tone = getSlotTone(slot.status);
                        const ToneIcon = tone.Icon;

                        return (
                          <div
                            key={slot.id}
                            className={cn(
                              'self-start rounded-3xl border p-5 transition-shadow duration-200 hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]',
                              tone.cardClass,
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                                    tone.iconClass,
                                  )}
                                >
                                  <ToneIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatSlotTime(slot)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {slot.label || 'Horário da agenda'}
                                  </p>
                                  {slot.customPrice ? (
                                    <p className="mt-2 text-xs font-medium text-foreground">
                                      {formatCurrency(slot.customPrice)}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
                                  tone.badgeClass,
                                )}
                              >
                                {tone.label}
                              </Badge>
                            </div>

                            {slot.status === 'BLOCKED' ? (
                              <div
                                className={cn(
                                  'mt-4 rounded-2xl border p-3.5 text-xs text-muted-foreground',
                                  tone.detailClass,
                                )}
                              >
                                <p>horário bloqueado manualmente para evitar novos encaixes.</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="mt-4 rounded-xl"
                                  onClick={() => vm.unblockSlot(slot.id)}
                                >
                                  <Unlock className="mr-2 h-4 w-4" />
                                  Desbloquear
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-4 flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-11 flex-1 rounded-xl"
                                  onClick={() =>
                                    vm.openReserveSlot({
                                      id: slot.id,
                                      professionalId: slot.professionalId,
                                      startsAt: slot.startsAt ?? slot.startTime ?? '',
                                      endsAt: slot.endsAt ?? slot.endTime ?? '',
                                    })
                                  }
                                >
                                  Reservar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-11 rounded-xl px-3"
                                  onClick={() => vm.blockSlot(slot.id)}
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Clock3}
                      title="Sem slots abertos neste dia"
                      description="Os horários disponíveis e bloqueados aparecem aqui."
                    />
                  )}
                </TabsContent>

                <TabsContent value="reserved" className="space-y-0">
                  {reservedSlots.length ? (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {reservedSlots.map((slot) => {
                        const tone = getSlotTone(slot.status);
                        const ToneIcon = tone.Icon;

                        return (
                          <div
                            key={slot.id}
                            className={cn(
                              'self-start rounded-3xl border p-5 transition-shadow duration-200 hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]',
                              tone.cardClass,
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                                    tone.iconClass,
                                  )}
                                >
                                  <ToneIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatSlotTime(slot)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {slot.label || 'Horário da agenda'}
                                  </p>
                                  {slot.customPrice ? (
                                    <p className="mt-2 text-xs font-medium text-foreground">
                                      Preço do horário: {formatCurrency(slot.customPrice)}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
                                  tone.badgeClass,
                                )}
                              >
                                {tone.label}
                              </Badge>
                            </div>

                            <div
                              className={cn(
                                'mt-4 rounded-2xl border p-3.5 text-xs text-muted-foreground',
                                tone.detailClass,
                              )}
                            >
                              <p className="font-medium text-foreground">
                                {slot.reservedFor?.contactName || 'Cliente não identificado'}
                              </p>
                              {slot.reservedFor?.categoryName ? (
                                <p className="mt-1">Categoria: {slot.reservedFor.categoryName}</p>
                              ) : null}
                              {slot.reservedFor?.contactPhone ? (
                                <p className="mt-1">Celular: {slot.reservedFor.contactPhone}</p>
                              ) : null}
                              {slot.reservedFor?.contactEmail ? (
                                <p className="mt-1">Email: {slot.reservedFor.contactEmail}</p>
                              ) : null}
                              {slot.payment ? (
                                <p className="mt-1">
                                  {slot.status === 'PRE_RESERVED'
                                    ? `Pagamento pendente até ${slot.payment.expiresAt?.slice(11, 16) ?? 'o prazo configurado'}.`
                                    : `Pagamento ${slot.payment.status === 'PAID' ? 'confirmado' : 'registrado'}.`}
                                </p>
                              ) : null}
                              <p className="mt-1">
                                {slot.reservedFor?.notes || 'horário reservado para atendimento.'}
                              </p>
                              {slot.reservedAt ? (
                                <p className="mt-1">
                                  Registrado em {formatDateTime(slot.reservedAt)}
                                </p>
                              ) : null}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => vm.openSlotDetails(slot)}
                                >
                                  Ver detalhes
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => vm.cancelReservation(slot.id)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Calendar}
                      title="Sem slots reservados neste dia"
                      description="As reservas ficam separadas aqui para manter a agenda principal mais limpa."
                    />
                  )}
                </TabsContent>
              </Tabs>
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
