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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShoppingBag } from 'lucide-react';
import type { useConversationsPageViewModel } from '../view-models/useConversationsPageViewModel';
import { formatSaleAmountTyping, parseSaleAmountInput } from '../utils/conversation-ui-helpers';

type ConversationsPageViewModel = ReturnType<typeof useConversationsPageViewModel>;

interface SaleAttributionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleNotes: string;
  setSaleNotes: (v: string) => void;
  saleAmountDisplay: string;
  setSaleAmountDisplay: (v: string) => void;
  saleDialogCopy: { title: string; description: string; submitLabel: string };
  markSaleAttributionMutation: ConversationsPageViewModel['markSaleAttributionMutation'];
  selectedConversation: ConversationsPageViewModel['selectedConversation'];
}

export function SaleAttributionDialog({
  open,
  onOpenChange,
  saleNotes,
  setSaleNotes,
  saleAmountDisplay,
  setSaleAmountDisplay,
  saleDialogCopy,
  markSaleAttributionMutation,
  selectedConversation,
}: SaleAttributionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{saleDialogCopy.title}</DialogTitle>
          <DialogDescription>{saleDialogCopy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sale-amount-input">Valor (opcional)</Label>
            <Input
              id="sale-amount-input"
              inputMode="decimal"
              value={saleAmountDisplay}
              onChange={(event) =>
                setSaleAmountDisplay(formatSaleAmountTyping(event.target.value))
              }
              placeholder="R$ 0,00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sale-notes-input">Notas ou referência (opcional)</Label>
            <Textarea
              id="sale-notes-input"
              rows={3}
              value={saleNotes}
              onChange={(event) => setSaleNotes(event.target.value)}
              placeholder="Ex.: pedido #123, contrato, observações para auditoria."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={
              markSaleAttributionMutation.isPending ||
              selectedConversation?.status === 'ARCHIVED'
            }
            onClick={() => {
              if (!selectedConversation) {
                return;
              }
              const parsed = parseSaleAmountInput(saleAmountDisplay);
              markSaleAttributionMutation.mutate(
                {
                  ...(parsed !== undefined ? { saleAmount: parsed } : {}),
                  notes: saleNotes.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setSaleNotes('');
                    setSaleAmountDisplay('');
                  },
                },
              );
            }}
          >
            {markSaleAttributionMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingBag className="mr-2 h-4 w-4" />
            )}
            {saleDialogCopy.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
