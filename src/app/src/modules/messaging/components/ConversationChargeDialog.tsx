import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard, Loader2 } from 'lucide-react';
import type { useConversationsPageViewModel } from '../view-models/useConversationsPageViewModel';

type ConversationsPageViewModel = ReturnType<typeof useConversationsPageViewModel>;

interface ConversationChargeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chargeForm: ConversationsPageViewModel['chargeForm'];
  setChargeForm: ConversationsPageViewModel['setChargeForm'];
  formatConversationChargeValue: ConversationsPageViewModel['formatConversationChargeValue'];
  createConversationChargeMutation: ConversationsPageViewModel['createConversationChargeMutation'];
  submitConversationCharge: ConversationsPageViewModel['submitConversationCharge'];
}

export function ConversationChargeDialog({
  open,
  onOpenChange,
  chargeForm,
  setChargeForm,
  formatConversationChargeValue,
  createConversationChargeMutation,
  submitConversationCharge,
}: ConversationChargeDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold tracking-tight">Enviar cobrança</SheetTitle>
              <SheetDescription className="text-sm mt-0.5">
                Crie uma cobrança para a conversa atual e envie o link no WhatsApp do cliente.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conversation-charge-name">Título</Label>
              <Input
                id="conversation-charge-name"
                value={chargeForm.name}
                onChange={(event) =>
                  setChargeForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex: Mensalidade, consulta, serviço recorrente"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conversation-charge-value">Valor</Label>
                <Input
                  id="conversation-charge-value"
                  inputMode="decimal"
                  value={chargeForm.value}
                  onChange={(event) => formatConversationChargeValue(event.target.value)}
                  placeholder="R$ 120,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversation-charge-billing">Pagamento</Label>
                <Select
                  value={chargeForm.billingType}
                  onValueChange={(value) =>
                    setChargeForm((current) => ({
                      ...current,
                      billingType: value as typeof chargeForm.billingType,
                    }))
                  }
                >
                  <SelectTrigger id="conversation-charge-billing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conversation-charge-document">CPF/CNPJ</Label>
                <Input
                  id="conversation-charge-document"
                  value={chargeForm.customerDocument}
                  onChange={(event) =>
                    setChargeForm((current) => ({
                      ...current,
                      customerDocument: event.target.value,
                    }))
                  }
                  placeholder="Obrigatório no primeiro pagamento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversation-charge-due">Vencimento</Label>
                <Input
                  id="conversation-charge-due"
                  type="date"
                  value={chargeForm.dueDate}
                  onChange={(event) =>
                    setChargeForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conversation-charge-description">Descrição</Label>
              <Textarea
                id="conversation-charge-description"
                rows={3}
                value={chargeForm.description}
                onChange={(event) =>
                  setChargeForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalhe o serviço, assinatura ou item vendido."
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <Label htmlFor="conversation-charge-recurring">Recorrente</Label>
                <p className="text-xs text-muted-foreground">
                  Define frequência, início e fim para cobranças recorrentes.
                </p>
              </div>
              <Switch
                id="conversation-charge-recurring"
                checked={chargeForm.recurring}
                onCheckedChange={(checked) =>
                  setChargeForm((current) => ({
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

            {chargeForm.recurring ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={chargeForm.recurrenceFrequency}
                    onValueChange={(value) =>
                      setChargeForm((current) => ({
                        ...current,
                        recurrenceFrequency: value as typeof chargeForm.recurrenceFrequency,
                      }))
                    }
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="conversation-charge-start">Início</Label>
                  <Input
                    id="conversation-charge-start"
                    type="date"
                    value={chargeForm.recurrenceStartDate}
                    onChange={(event) =>
                      setChargeForm((current) => ({
                        ...current,
                        recurrenceStartDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversation-charge-end">Fim</Label>
                  <Input
                    id="conversation-charge-end"
                    type="date"
                    value={chargeForm.recurrenceEndDate}
                    onChange={(event) =>
                      setChargeForm((current) => ({
                        ...current,
                        recurrenceEndDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 p-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="px-4 text-sm font-medium"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={createConversationChargeMutation.isPending}
            onClick={() => submitConversationCharge()}
            className="px-6 text-sm font-bold"
          >
            {createConversationChargeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Criar e enviar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
