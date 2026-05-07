import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/shared/lib/formatters';
import { formatCurrencyInput, formatPhone } from '@/shared/lib/masks';
import { TagInput } from '@/shared/ui/TagInput';
import type { Contact } from '@/shared/types';
import type { ProposalFormState, ProposalItemDraft } from '../types';
import { getProposalDisplayTotal } from '../utils/proposal-finance';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  form: ProposalFormState;
  contacts: Contact[];
  contactLabelMap: Record<string, string>;
  contactSearch: string;
  filteredContacts: Contact[];
  selectedContact: Contact | null;
  isPending: boolean;
  currentUserName?: string;
  onOpenChange: (open: boolean) => void;
  onFieldChange: <K extends keyof ProposalFormState>(field: K, value: ProposalFormState[K]) => void;
  onContactSearchChange: (value: string) => void;
  onSelectContact: (contact: Contact) => void;
  onClearSelectedContact: () => void;
  onItemChange: (itemId: string, field: keyof ProposalItemDraft, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onSubmit: () => void;
};

function computeFormTotal(form: ProposalFormState) {
  return form.items.reduce((sum, item) => {
    const digits = item.unitPrice.replace(/\D/g, '');
    const unitPrice = digits ? Number(digits) / 100 : 0;
    return sum + unitPrice * Number(item.quantity || 0);
  }, 0);
}

export function ProposalEditorSheet({
  open,
  mode,
  form,
  contacts,
  contactLabelMap,
  contactSearch,
  filteredContacts,
  selectedContact,
  isPending,
  currentUserName,
  onOpenChange,
  onFieldChange,
  onContactSearchChange,
  onSelectContact,
  onClearSelectedContact,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: Props) {
  const total = computeFormTotal(form);
  const hasFinalPriceOverride = Boolean(form.finalPrice.trim());
  const displayTotal = getProposalDisplayTotal({
    metadata: hasFinalPriceOverride ? { finalPrice: form.finalPrice } : null,
    totalAmount: total,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="space-y-2">
          <SheetTitle>{mode === 'create' ? 'Nova proposta' : 'Editar proposta'}</SheetTitle>
          <SheetDescription>
            Mantenha o layout atual da aplicação e preencha os dados da proposta, itens e validade.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Contato</Label>
              {selectedContact ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedContact.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(selectedContact.phone)}
                      </p>
                      {selectedContact.email ? (
                        <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                      ) : null}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={onClearSelectedContact}>
                      Trocar contato
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-3">
                  <div className="space-y-2">
                    <Input
                      value={contactSearch}
                      onChange={(event) => onContactSearchChange(event.target.value)}
                      placeholder="Buscar por nome, telefone ou email"
                    />
                    {contacts.length ? (
                      filteredContacts.length ? (
                        <div className="space-y-2">
                          {filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => onSelectContact(contact)}
                              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:bg-muted/30"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {contactLabelMap[contact.id] ?? contact.name}
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
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum contato disponível.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(event) => onFieldChange('title', event.target.value)}
                placeholder="Ex: Proposta de automação comercial"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(event) => onFieldChange('description', event.target.value)}
                placeholder="Contextualize a proposta e a dor que ela resolve."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Benefícios</Label>
              <TagInput
                value={form.benefits}
                onChange={(value) =>
                  onFieldChange('benefits', typeof value === 'string' ? value : value.join(', '))
                }
                placeholder="Adicione benefícios e pressione Enter"
              />
              <p className="text-xs text-muted-foreground">
                Pressione Enter ou vírgula para adicionar um benefício. Clique no x para remover.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Válida até</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(event) => onFieldChange('validUntil', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={currentUserName ?? 'Usuário logado'} disabled />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Preço final</Label>
              <Input
                value={form.finalPrice}
                onChange={(event) =>
                  onFieldChange('finalPrice', formatCurrencyInput(event.target.value))
                }
                placeholder="Opcional: ajuste o valor final da proposta"
              />
              <p className="text-xs text-muted-foreground">
                Use este campo se quiser sobrescrever o total calculado pelos itens.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Itens</p>
                <p className="text-xs text-muted-foreground">
                  A proposta precisa de pelo menos um item para gerar o PDF e agendar o envio.
                </p>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={onAddItem}>
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 bg-background/50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Item {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={form.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-5">
                      <Label>Nome</Label>
                      <Input
                        value={item.name}
                        onChange={(event) => onItemChange(item.id, 'name', event.target.value)}
                        placeholder="Ex: Implantação de chatbot"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Qtd.</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label>Valor unitário</Label>
                      <Input
                        value={item.unitPrice}
                        onChange={(event) =>
                          onItemChange(item.id, 'unitPrice', formatCurrencyInput(event.target.value))
                        }
                        placeholder="0,00"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Subtotal</Label>
                      <Input
                        value={
                          formatCurrency(
                            (Number(item.unitPrice.replace(/\D/g, '')) / 100 || 0) *
                              Number(item.quantity || 0),
                          ) ?? 'R$ 0,00'
                        }
                        disabled
                      />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <Label>Descrição do item</Label>
                    <Textarea
                      rows={2}
                      value={item.description}
                      onChange={(event) => onItemChange(item.id, 'description', event.target.value)}
                      placeholder="Detalhes opcionais do item."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumo da proposta</p>
                <p className="text-sm text-muted-foreground">
                  O total abaixo é calculado em tempo real pelos itens preenchidos.
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 text-left lg:items-end lg:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {hasFinalPriceOverride ? 'Preço final' : 'Total calculado'}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(displayTotal) ?? 'R$ 0,00'}
                </p>
                {hasFinalPriceOverride ? (
                  <p className="text-xs text-muted-foreground">
                    Base calculada: {formatCurrency(total) ?? 'R$ 0,00'}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" className="gap-2" onClick={onSubmit} disabled={isPending}>
              {isPending ? 'Salvando...' : mode === 'create' ? 'Criar proposta' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
