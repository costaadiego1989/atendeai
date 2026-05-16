import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatPhone } from '@/shared/lib/masks';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { CalendarRange, Check, ChevronsUpDown, Plus, Repeat2, UserRound, XCircle } from 'lucide-react';
import {
  formatRecurrenceDateRange,
  getRecurrenceStatusLabel,
} from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
  sheetOnly?: boolean;
};

const frequencyLabels = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
} as const;

export function SchedulingRecurrencesCard({ vm, sheetOnly = false }: Props) {
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedRecurrence, setSelectedRecurrence] = useState<
    (typeof vm.recurrences)[number] | null
  >(null);
  const activeRecurrences = vm.recurrences.filter((recurrence) => recurrence.status === 'ACTIVE');
  const generatedCount = vm.recurrences.reduce(
    (total, recurrence) => total + recurrence.occurrencesCreated,
    0,
  );
  const nextRecurrenceDate =
    formatRecurrenceDateRange(
      activeRecurrences.find((recurrence) => recurrence.nextDate)?.nextDate ?? '',
    );
  const selectedRecurrenceFormContact =
    vm.contacts.find((contact) => contact.id === vm.recurrenceForm.contactId) ?? null;
  const recurrenceProfessionalId =
    vm.recurrenceForm.professionalId || vm.selectedProfessionalId || '';
  const recurrenceProfessionalCategories =
    recurrenceProfessionalId ? vm.professionalCategoryMap[recurrenceProfessionalId] ?? [] : [];
  const filteredRecurrenceContacts = useMemo(() => {
    const normalizedQuery = contactSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return vm.contacts.slice(0, 40);
    }

    return vm.contacts
      .filter((contact) =>
        [contact.name, contact.phone, contact.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 40);
  }, [contactSearch, vm.contacts]);
  const selectedRecurrenceContact = selectedRecurrence?.contactId
    ? vm.contacts.find((contact) => contact.id === selectedRecurrence.contactId)
    : null;
  const selectedRecurrenceCategory = selectedRecurrence?.categoryId
    ? vm.categories.find((category) => category.id === selectedRecurrence.categoryId)
    : null;

  const recurrenceSheet = (
    <Sheet open={vm.recurrenceOpen} onOpenChange={vm.setRecurrenceOpen}>
      <SheetContent side="right" className="w-[640px] overflow-y-auto sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>Novo atendimento recorrente</SheetTitle>
          <SheetDescription>
            Venda um pacote de sessões para o mesmo cliente, profissional, serviço e horário.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Profissional</Label>
            <Select
              value={recurrenceProfessionalId}
              onValueChange={(value) => {
                const linkedCategories = vm.professionalCategoryMap[value] ?? [];
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  professionalId: value,
                  categoryId: linkedCategories[0]?.id ?? 'none',
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {vm.professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input
              type="date"
              value={vm.recurrenceForm.startDate}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Limite final opcional</Label>
            <Input
              type="date"
              value={vm.recurrenceForm.endDate}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Sessoes contratadas</Label>
            <Input
              type="number"
              min="1"
              max="370"
              value={vm.recurrenceForm.occurrences}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  occurrences: event.target.value.replace(/\D/g, '') || '1',
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Começa</Label>
            <Input
              type="time"
              value={vm.recurrenceForm.startsAt}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  startsAt: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Termina</Label>
            <Input
              type="time"
              value={vm.recurrenceForm.endsAt}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={vm.recurrenceForm.frequency}
              onValueChange={(value) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  frequency: value as typeof current.frequency,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Intervalo</Label>
            <Input
              type="number"
              min="1"
              value={vm.recurrenceForm.interval}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  interval: event.target.value.replace(/\D/g, '') || '1',
                }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Contato</Label>
            <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={contactPickerOpen}
                  className="h-11 w-full justify-between rounded-xl font-normal"
                >
                  <span className="truncate text-left">
                    {selectedRecurrenceFormContact
                      ? `${selectedRecurrenceFormContact.name} - ${formatPhone(selectedRecurrenceFormContact.phone)}`
                      : 'Sem contato'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={contactSearch}
                    onValueChange={setContactSearch}
                    placeholder="Buscar contato..."
                  />
                  <CommandList>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          vm.setRecurrenceForm((current) => ({ ...current, contactId: 'none' }));
                          setContactSearch('');
                          setContactPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            vm.recurrenceForm.contactId === 'none' ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        Sem contato
                      </CommandItem>
                    </CommandGroup>
                    <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredRecurrenceContacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={`${contact.name} ${contact.phone} ${contact.email ?? ''}`}
                          onSelect={() => {
                            vm.setRecurrenceForm((current) => ({
                              ...current,
                              contactId: contact.id,
                            }));
                            setContactSearch(contact.name);
                            setContactPickerOpen(false);
                          }}
                          className="items-start"
                        >
                          <Check
                            className={cn(
                              'mr-2 mt-0.5 h-4 w-4',
                              vm.recurrenceForm.contactId === contact.id
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{contact.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatPhone(contact.phone)}
                              {contact.email ? ` - ${contact.email}` : ''}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Categoria</Label>
            <Select
              value={vm.recurrenceForm.categoryId}
              onValueChange={(value) =>
                vm.setRecurrenceForm((current) => ({ ...current, categoryId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {recurrenceProfessionalCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3 md:col-span-2">
            <Checkbox
              checked={vm.recurrenceForm.isFree}
              onCheckedChange={(checked) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  isFree: Boolean(checked),
                }))
              }
            />
            <span className="text-sm text-foreground">Sessoes gratuitas</span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3 md:col-span-2">
            <Checkbox
              checked={vm.recurrenceForm.isOnline}
              onCheckedChange={(checked) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  isOnline: Boolean(checked),
                }))
              }
            />
            <span className="text-sm text-foreground">
              Sessoes online com link do Google Meet
            </span>
          </label>

          <div className="space-y-2 md:col-span-2">
            <Label>Observacoes</Label>
            <Textarea
              value={vm.recurrenceForm.notes}
              onChange={(event) =>
                vm.setRecurrenceForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setRecurrenceOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitCreateRecurrence}
            disabled={vm.createRecurrenceMutation.isPending}
          >
            Criar atendimento recorrente
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (sheetOnly) {
    return recurrenceSheet;
  }

  return (
    <>
      <Sheet
        open={Boolean(selectedRecurrence)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecurrence(null);
          }
        }}
      >
        <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>Detalhes do recorrente</SheetTitle>
            <SheetDescription>
              Contrato recorrente e informações das sessões geradas para a agenda.
            </SheetDescription>
          </SheetHeader>

          {selectedRecurrence ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
                <p className="font-medium text-foreground">
                  {formatRecurrenceDateRange(
                    selectedRecurrence.firstDate,
                    selectedRecurrence.endDate,
                  )}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {selectedRecurrence.startsAt} - {selectedRecurrence.endsAt}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                <p>
                  {frequencyLabels[selectedRecurrence.period]} a cada{' '}
                  {selectedRecurrence.interval} ciclo(s)
                </p>
                <p className="mt-1">
                  {selectedRecurrence.occurrencesCreated}/{selectedRecurrence.maxOccurrences}{' '}
                  sessões geradas
                </p>
                {selectedRecurrence.nextDate ? (
                  <p className="mt-1">
                    Próxima geração em {formatRecurrenceDateRange(selectedRecurrence.nextDate)}
                  </p>
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
                  <p className="mt-1">
                    O link do Google Meet fica disponível nos detalhes de cada sessão gerada na
                    agenda do dia.
                  </p>
                </div>
              ) : null}

              {selectedRecurrence.notes ? (
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                  {selectedRecurrence.notes}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <div className="grid gap-4 pt-1 lg:grid-cols-4">
        <Card className="glass-card h-fit lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Profissionais</CardTitle>
            <Button
              size="icon"
              onClick={() => vm.setCreateProfessionalOpen(true)}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
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
                          : 'Telefone para confirmações não definido'}
                      </p>
                    </div>
                    <StatusBadge status={professional.active ? 'ACTIVE' : 'CLOSED'} />
                  </div>

                  {vm.professionalCategoryMap[professional.id]?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {vm.professionalCategoryMap[professional.id].slice(0, 3).map((category) => (
                        <Badge
                          key={category.id}
                          variant="secondary"
                          className="rounded-full px-2.5 py-1 text-[11px]"
                        >
                          {category.name}
                        </Badge>
                      ))}
                      {vm.professionalCategoryMap[professional.id].length > 3 ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                          +{vm.professionalCategoryMap[professional.id].length - 3}
                        </Badge>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nenhuma categoria vinculada ainda.
                    </p>
                  )}
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Repeat2 className="h-4 w-4 text-primary" />
                    Atendimentos recorrentes
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {vm.selectedProfessional
                      ? `Acompanhe os pacotes vendidos para ${vm.selectedProfessional.name}.`
                      : 'Selecione um profissional para ver atendimentos recorrentes.'}
                  </p>
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={vm.openRecurrenceForm}
                  disabled={!vm.selectedProfessionalId && vm.professionals.length === 0}
                >
                  <Repeat2 className="h-4 w-4" />
                  Novo recorrente
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {vm.selectedProfessional ? (
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
                        {generatedCount}
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
                          className="self-start cursor-pointer rounded-2xl border border-border/60 bg-background/90 p-5 transition-shadow duration-200 hover:shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)] focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                                Próxima geração em {formatRecurrenceDateRange(recurrence.nextDate)}
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
        </div>
      </div>

      {recurrenceSheet}
    </>
  );
}
