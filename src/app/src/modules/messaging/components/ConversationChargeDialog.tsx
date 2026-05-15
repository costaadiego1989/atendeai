import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Enviar cobranca</DialogTitle>
          <DialogDescription>
            Crie uma cobranca para a conversa atual e envie o link no WhatsApp do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="conversation-charge-name">Titulo</Label>
            <Input
              id="conversation-charge-name"
              value={chargeForm.name}
              onChange={(event) =>
                setChargeForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Ex: Mensalidade, consulta, servico recorrente"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="conversation-charge-value">Valor</Label>
              <Input
                id="conversation-charge-value"
                inputMode="decimal"
                value={chargeForm.value}
                onChange={(event) => formatConversationChargeValue(event.target.value)}
                placeholder="R$ 120,00"
              />
            </div>
            <div className="grid gap-2">
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
                  <SelectItem value="CREDIT_CARD">Cartao</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
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
                placeholder="Obrigatorio no primeiro pagamento"
              />
            </div>
            <div className="grid gap-2">
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

          <div className="grid gap-2">
            <Label htmlFor="conversation-charge-description">Descricao</Label>
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
              placeholder="Detalhe o servico, assinatura ou item vendido."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <div>
              <Label htmlFor="conversation-charge-recurring">Recorrente</Label>
              <p className="text-xs text-muted-foreground">
                Define frequência, inicio e fim para cobrancas recorrentes.
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
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
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
              <div className="grid gap-2">
                <Label htmlFor="conversation-charge-start">Inicio</Label>
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
              <div className="grid gap-2">
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={createConversationChargeMutation.isPending}
            onClick={() => submitConversationCharge()}
          >
            {createConversationChargeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Criar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
