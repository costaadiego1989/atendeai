import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingReserveSlotSheet({ vm }: Props) {
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [reserveStep, setReserveStep] = useState<1 | 2 | 3>(1);
  const reserveContactReady = Boolean(vm.reserveForm.contactId);
  const reserveModeReady = Boolean(
    vm.reserveForm.isFree || Number(vm.reserveForm.paymentTimeoutHours || '0') > 0,
  );

  const reserveSteps = [
    {
      step: 1 as const,
      title: 'Quem vai reservar?',
      description: 'Escolha o contato do CRM.',
      ready: reserveContactReady,
    },
    {
      step: 2 as const,
      title: 'Como sera esse horário?',
      description: 'Defina se sera gratis ou pre-agendado.',
      ready: reserveModeReady,
    },
    {
      step: 3 as const,
      title: 'Confirmação',
      description: 'Revise e confirme o envio.',
      ready: false,
    },
  ];

  useEffect(() => {
    if (!vm.reserveSlotOpen) {
      setContactPickerOpen(false);
      setReserveStep(1);
    }
  }, [vm.reserveSlotOpen]);

  useEffect(() => {
    if (!vm.reserveSlotOpen) {
      return;
    }

    if (!reserveContactReady) {
      setReserveStep(1);
      return;
    }

    setReserveStep((current) => (current === 1 ? 2 : current));
  }, [reserveContactReady, vm.reserveSlotOpen]);

  return (
    <Sheet open={vm.reserveSlotOpen} onOpenChange={vm.setReserveSlotOpen}>
      <SheetContent side="right" className="w-[760px] sm:max-w-[760px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reservar horário</SheetTitle>
          <SheetDescription>
            Preencha em 3 etapas: contato, formato do atendimento e confirmação.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {reserveSteps.map((item) => {
            const available =
              item.step === 1 ||
              (item.step === 2 && reserveContactReady) ||
              (item.step === 3 && reserveContactReady && reserveModeReady);

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  if (available) {
                    setReserveStep(item.step);
                  }
                }}
                className={`rounded-2xl border p-4 text-left transition ${reserveStep === item.step
                  ? 'border-primary/30 bg-primary/[0.06]'
                  : 'border-border/60 bg-muted/10'
                  } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Etapa {item.step}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                {item.ready ? (
                  <div className="mt-3 inline-flex rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                    Pronto
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm md:col-span-2 mt-4">
            <p className="font-medium text-foreground">
              {vm.selectedSlot
                ? `${vm.selectedDate} - ${vm.selectedSlot.startsAt} - ${vm.selectedSlot.endsAt}`
                : 'Nenhum horário selecionado'}
            </p>
          </div>

          {reserveStep === 1 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                Escolha quem vai ocupar esse horário. O cliente selecionado recebera a confirmação
                ou o link de pagamento no WhatsApp.
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reserve-contact">Contato do CRM</Label>
                <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="reserve-contact"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactPickerOpen}
                      className="h-11 w-full justify-between rounded-xl font-normal"
                    >
                      <span className="truncate text-left">
                        {vm.selectedReserveContact
                          ? `${vm.selectedReserveContact.name} - ${formatPhone(vm.selectedReserveContact.phone)}`
                          : 'Buscar contato por nome, telefone ou email'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={vm.reserveContactSearch}
                        onValueChange={vm.setReserveContactSearch}
                        placeholder="Buscar contato..."
                      />
                      <CommandList>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              vm.setReserveForm((current) => ({ ...current, contactId: 'none' }));
                              vm.setReserveContactSearch('');
                              setContactPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                vm.reserveForm.contactId === 'none' ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            Sem contato vinculado
                          </CommandItem>
                        </CommandGroup>
                        <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                        <CommandGroup>
                          {vm.filteredContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={`${contact.name} ${contact.phone} ${contact.email ?? ''}`}
                              onSelect={() => {
                                vm.setReserveForm((current) => ({
                                  ...current,
                                  contactId: contact.id,
                                }));
                                vm.setReserveContactSearch(contact.name);
                                setContactPickerOpen(false);
                              }}
                              className="items-start"
                            >
                              <Check
                                className={cn(
                                  'mr-2 mt-0.5 h-4 w-4',
                                  vm.reserveForm.contactId === contact.id
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
            </>
          ) : null}

          {reserveStep === 2 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                Agora escolha se esse horário será gratuito ou se deve virar pré-agendamento com
                pagamento antes da confirmação final.
              </div>
              {vm.selectedReserveCategory ? (
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-3 text-sm text-muted-foreground md:col-span-2">
                  Categoria vinculada automaticamente:{' '}
                  <strong className="text-foreground">{vm.selectedReserveCategory.name}</strong>
                  {vm.selectedReserveCategory.basePrice
                    ? ` - ${formatCurrency(vm.selectedReserveCategory.basePrice)}`
                    : ''}
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:col-span-2">
                <Checkbox
                  checked={vm.reserveForm.isFree}
                  onCheckedChange={(checked) =>
                    vm.setReserveForm((current) => ({
                      ...current,
                      isFree: Boolean(checked),
                    }))
                  }
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Atendimento gratuito</p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, o horário ja fica confirmado e nenhuma cobrança e enviada.
                  </p>
                </div>
              </label>
              {vm.reserveForm.isFree ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900 md:col-span-2">
                  O cliente recebera apenas a confirmação amigavel do agendamento no WhatsApp.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reserve-payment-timeout">Expira em (horas)</Label>
                    <Input
                      id="reserve-payment-timeout"
                      type="number"
                      min="1"
                      step="1"
                      value={vm.reserveForm.paymentTimeoutHours}
                      onChange={(event) =>
                        vm.setReserveForm((current) => ({
                          ...current,
                          paymentTimeoutHours: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reserve-notes">Observações</Label>
                <label className="mb-4 flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <Checkbox
                    checked={vm.reserveForm.isOnline}
                    onCheckedChange={(checked) =>
                      vm.setReserveForm((current) => ({
                        ...current,
                        isOnline: Boolean(checked),
                      }))
                    }
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Atendimento online</p>
                    <p className="text-xs text-muted-foreground">
                      Com Google Calendar conectado, o sistema cria e envia o link do Meet.
                    </p>
                  </div>
                </label>
                <Textarea
                  id="reserve-notes"
                  value={vm.reserveForm.notes}
                  onChange={(event) =>
                    vm.setReserveForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Ex: reserva feita apos conversa no WhatsApp."
                />
              </div>
            </>
          ) : null}

          {reserveStep === 3 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                Revise o horário, o contato e a forma de confirmação antes de concluir.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Cliente
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.selectedReserveContact?.name || 'Sem contato vinculado'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vm.selectedReserveContact
                    ? formatPhone(vm.selectedReserveContact.phone)
                    : 'Atendimento interno'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  horário
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.selectedSlot
                    ? `${vm.selectedSlot.startsAt} - ${vm.selectedSlot.endsAt}`
                    : 'Sem horário'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vm.selectedReserveCategory?.name || 'Sem categoria vinculada'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 md:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Confirmação
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.reserveForm.isFree
                    ? 'Atendimento gratuíto'
                    : 'Pré-agendamento com pagamento'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vm.reserveForm.isFree
                    ? 'O cliente receberá a confirmação automática no WhatsApp.'
                    : `O pagamento precisa acontecer em até ${vm.reserveForm.paymentTimeoutHours || '3'} horas para confirmar o slot.`}
                </p>
                {vm.reserveForm.notes ? (
                  <p className="mt-3 text-xs text-muted-foreground">{vm.reserveForm.notes}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReserveSlotOpen(false)}>
            Cancelar
          </Button>
          {reserveStep > 1 ? (
            <Button
              variant="outline"
              onClick={() => setReserveStep((current) => (current === 3 ? 2 : 1))}
            >
              Voltar
            </Button>
          ) : null}
          {reserveStep < 3 ? (
            <Button
              onClick={() => setReserveStep((current) => (current === 1 ? 2 : 3))}
              disabled={
                (reserveStep === 1 && !reserveContactReady) ||
                (reserveStep === 2 && !reserveModeReady)
              }
            >
              Continuar
            </Button>
          ) : (
            <Button onClick={vm.submitReserveSlot} disabled={vm.reserveSlotMutation.isPending}>
              {vm.reserveForm.isFree ? 'Confirmar gratis' : 'Criar pré-agendamento'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
