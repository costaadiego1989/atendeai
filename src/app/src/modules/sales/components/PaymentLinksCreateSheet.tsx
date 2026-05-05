import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { CreateSalesSplitChargeInput } from '@/modules/sales/services/sales-service';
import type { PaymentLinksPageViewModel } from '@/modules/sales/view-models/usePaymentLinksPageViewModel';
import { Send } from 'lucide-react';
import {
  buildPaymentLinkStepItems,
  formatSalesBillingType,
  formatSalesCurrency,
  formatSalesDueDate,
} from './sales-view-helpers';
import { formatCurrencyInput, formatPhone, parseCurrencyInput } from '@/shared/lib/masks';

type Props = {
  vm: PaymentLinksPageViewModel;
};

export function PaymentLinksCreateSheet({ vm }: Props) {
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const dueDateEnabled = Boolean(vm.form.dueDate);
  const isSubmitting = vm.createChargeMutation.isPending;
  const hasCustomerDocument = Boolean(vm.form.customerDocument.trim());
  const numericValue = Number(parseCurrencyInput(vm.form.value) || 0);
  const createDisabled =
    !vm.form.contactId ||
    !hasCustomerDocument ||
    !vm.form.name.trim() ||
    !(numericValue > 0) ||
    (vm.form.recurring && !vm.form.recurrenceEndDate);
  const contactReady = Boolean(vm.form.contactId && hasCustomerDocument);
  const chargeReady = Boolean(vm.form.name.trim() && numericValue > 0);
  const stepItems = useMemo(
    () => buildPaymentLinkStepItems(contactReady, chargeReady),
    [chargeReady, contactReady],
  );

  useEffect(() => {
    if (!vm.createOpen) {
      setCreateStep(1);
      return;
    }

    if (!contactReady) {
      setCreateStep(1);
      return;
    }

    setCreateStep((current) => (current === 1 ? 2 : current));
  }, [contactReady, vm.createOpen]);

  return (
    <Sheet open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
      <SheetContent side="right" className="w-[860px] overflow-y-auto sm:max-w-[860px]">
        <SheetHeader>
          <SheetTitle>Criar cobrança</SheetTitle>
          <SheetDescription>
            Preencha em 3 etapas: contato, cobrança e envio.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {stepItems.map((item) => {
            const available =
              item.step === 1 ||
              (item.step === 2 && contactReady) ||
              (item.step === 3 && contactReady && chargeReady);

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  if (available) {
                    setCreateStep(item.step);
                  }
                }}
                className={`rounded-2xl border p-4 text-left transition ${createStep === item.step
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
                  <Badge variant="outline" className="mt-3 rounded-full px-2.5 py-1 text-[11px]">
                    Pronto
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {createStep === 1 ? (
            <>
              <div className="space-y-2 md:col-span-2 mt-4">
                <Label htmlFor="charge-contact-search">Contato do CRM</Label>
                <Input
                  id="charge-contact-search"
                  value={vm.contactSearch}
                  onChange={(event) => vm.setContactSearch(event.target.value)}
                  placeholder="Buscar por nome, telefone ou email"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                {vm.selectedContact ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {vm.selectedContact.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPhone(vm.selectedContact.phone)}
                        </p>
                        {vm.selectedContact.email ? (
                          <p className="text-xs text-muted-foreground">
                            {vm.selectedContact.email}
                          </p>
                        ) : null}
                      </div>
                      <Button variant="outline" size="sm" onClick={vm.clearSelectedContact}>
                        Trocar contato
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-3">
                    {vm.contactsQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando contatos...</p>
                    ) : vm.filteredContacts.length ? (
                      <div className="space-y-2">
                        {vm.filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => vm.selectContact(contact)}
                            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:bg-muted/30"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {contact.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPhone(contact.phone)}
                                {contact.email ? ` • ${contact.email}` : ''}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="rounded-full px-2.5 py-1 text-[11px]"
                            >
                              {contact.stage}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum contato encontrado para esta busca.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {vm.form.contactId ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="charge-customer-document">CPF ou CNPJ do pagador *</Label>
                  <Input
                    id="charge-customer-document"
                    value={vm.form.customerDocument}
                    onChange={(event) =>
                      vm.setForm((current) => ({
                        ...current,
                        customerDocument: event.target.value,
                      }))
                    }
                    placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-99"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se o contato ainda não tiver documento salvo no CRM, você pode informar aqui para liberar a cobrança.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {createStep === 2 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2 mt-4">
                Agora defina o que será cobrado e como esse checkout deve ser pago.
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="charge-name">Título da cobrança *</Label>
                <Input
                  id="charge-name"
                  value={vm.form.name}
                  onChange={(event) =>
                    vm.setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex: Procedimento odontológico premium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-value">Valor *</Label>
                <Input
                  id="charge-value"
                  inputMode="decimal"
                  placeholder="Ex: 120,00"
                  value={vm.form.value}
                  onChange={(event) =>
                    vm.setForm((current) => ({
                      ...current,
                      value: formatCurrencyInput(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-billing">Forma de pagamento *</Label>
                <Select
                  value={vm.form.billingType}
                  onValueChange={(value) =>
                    vm.setForm((current) => ({
                      ...current,
                      billingType: value as CreateSalesSplitChargeInput['billingType'],
                    }))
                  }
                >
                  <SelectTrigger id="charge-billing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-label">Label interna</Label>
                <Input
                  id="charge-label"
                  value={vm.form.label}
                  onChange={(event) =>
                    vm.setForm((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="Ex: ortodontia-retorno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-due-date">Vencimento</Label>
                <Input
                  id="charge-due-date"
                  type="date"
                  value={vm.form.dueDate}
                  onChange={(event) =>
                    vm.setForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {dueDateEnabled
                    ? `A cobrança vencerá em ${formatSalesDueDate(vm.form.dueDate)}.`
                    : 'Se deixar vazio, o backend usará a regra padrão de vencimento.'}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="charge-description">Descrição</Label>
                <Textarea
                  id="charge-description"
                  rows={4}
                  value={vm.form.description}
                  onChange={(event) =>
                    vm.setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Explique o serviço, os termos da cobrança e qualquer observação relevante."
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background px-4 py-3 md:col-span-2">
                <div className="space-y-1">
                  <Label htmlFor="charge-recurring">Cobrança recorrente</Label>
                  <p className="text-xs text-muted-foreground">
                    Registra a agenda recorrente e cria a primeira cobrança agora.
                  </p>
                </div>
                <Switch
                  id="charge-recurring"
                  checked={vm.form.recurring}
                  onCheckedChange={(checked) =>
                    vm.setForm((current) => ({
                      ...current,
                      recurring: checked,
                      recurrenceStartDate: checked
                        ? current.recurrenceStartDate || current.dueDate
                        : '',
                      recurrenceEndDate: checked ? current.recurrenceEndDate : '',
                    }))
                  }
                />
              </div>
              {vm.form.recurring ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="charge-recurrence-frequency">Frequência</Label>
                    <Select
                      value={vm.form.recurrenceFrequency}
                      onValueChange={(value) =>
                        vm.setForm((current) => ({
                          ...current,
                          recurrenceFrequency: value as CreateSalesSplitChargeInput['recurrenceFrequency'],
                        }))
                      }
                    >
                      <SelectTrigger id="charge-recurrence-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Semanal</SelectItem>
                        <SelectItem value="MONTHLY">Mensal</SelectItem>
                        <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                        <SelectItem value="YEARLY">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge-recurrence-start">Início</Label>
                    <Input
                      id="charge-recurrence-start"
                      type="date"
                      value={vm.form.recurrenceStartDate}
                      onChange={(event) =>
                        vm.setForm((current) => ({
                          ...current,
                          recurrenceStartDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="charge-recurrence-end">Fim *</Label>
                    <Input
                      id="charge-recurrence-end"
                      type="date"
                      value={vm.form.recurrenceEndDate}
                      onChange={(event) =>
                        vm.setForm((current) => ({
                          ...current,
                          recurrenceEndDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {createStep === 3 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2 mt-4">
                Revise os dados e escolha se a cobrança já deve sair no WhatsApp automaticamente.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 md:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Contato
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.selectedContact?.name || 'Não selecionado'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vm.selectedContact?.phone
                    ? formatPhone(vm.selectedContact.phone)
                    : 'Sem telefone'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 md:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Cobrança
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {vm.form.name || 'Sem título'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {numericValue > 0
                    ? formatSalesCurrency(numericValue)
                    : 'Valor não informado'}{' '}
                  - {formatSalesBillingType(vm.form.billingType)}
                </p>
                {vm.form.recurring ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recorrente até {formatSalesDueDate(vm.form.recurrenceEndDate)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 md:col-span-2">
                <Checkbox
                  id="charge-send-whatsapp"
                  checked={vm.form.sendViaWhatsApp}
                  onCheckedChange={(checked) =>
                    vm.setForm((current) => ({
                      ...current,
                      sendViaWhatsApp: checked === true,
                    }))
                  }
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="charge-send-whatsapp"
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4 text-primary" />
                    Enviar no WhatsApp após criar
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se marcado, o sistema dispara automaticamente a cobrança no contexto da conversa do contato.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setCreateOpen(false)}>
            Cancelar
          </Button>
          {createStep > 1 ? (
            <Button
              variant="outline"
              onClick={() => setCreateStep((current) => (current === 3 ? 2 : 1))}
            >
              Voltar
            </Button>
          ) : null}
          {createStep < 3 ? (
            <Button
              onClick={() => setCreateStep((current) => (current === 1 ? 2 : 3))}
              disabled={(createStep === 1 && !contactReady) || (createStep === 2 && !chargeReady)}
            >
              Continuar
            </Button>
          ) : (
            <Button onClick={vm.submitCreate} disabled={isSubmitting || createDisabled}>
              {isSubmitting ? 'Criando cobrança...' : 'Criar cobrança'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
