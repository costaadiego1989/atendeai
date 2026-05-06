import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/shared/lib/formatters';
import { formatCurrencyInput } from '@/shared/lib/masks';
import type { Contact } from '@/shared/types';
import type { ProposalFormState, ProposalItemDraft } from '../types';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  form: ProposalFormState;
  contacts: Contact[];
  contactLabelMap: Record<string, string>;
  isPending: boolean;
  currentUserName?: string;
  onOpenChange: (open: boolean) => void;
  onFieldChange: <K extends keyof ProposalFormState>(field: K, value: ProposalFormState[K]) => void;
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

function parseCurrencyField(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

export function ProposalEditorSheet({
  open,
  mode,
  form,
  contacts,
  contactLabelMap,
  isPending,
  currentUserName,
  onOpenChange,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: Props) {
  const total = computeFormTotal(form);
  const finalPriceValue = parseCurrencyField(form.finalPrice);
  const hasFinalPriceOverride = finalPriceValue > 0;
  const displayTotal = hasFinalPriceOverride ? finalPriceValue : total;

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
              <Select
                value={form.contactId}
                onValueChange={(value) => onFieldChange('contactId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.length ? (
                    contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contactLabelMap[contact.id] ?? contact.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Nenhum contato disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
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
              <Textarea
                rows={3}
                value={form.benefits}
                onChange={(event) => onFieldChange('benefits', event.target.value)}
                placeholder="Liste os benefícios comerciais e operacionais."
              />
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
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumo da proposta</p>
                <p className="text-sm text-muted-foreground">
                  O total abaixo é calculado em tempo real pelos itens preenchidos.
                </p>
              </div>
              <div className="text-right">
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
