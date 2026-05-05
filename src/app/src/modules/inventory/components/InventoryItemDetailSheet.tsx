import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency, formatSource } from '../utils/inventory-helpers';
import type { InventoryItemRecord } from '@/shared/types';

interface InventoryItemDetailSheetProps {
  item: InventoryItemRecord | null;
  onClose: () => void;
  onUpdateSnapshot: () => void;
}

export function InventoryItemDetailSheet({
  item,
  onClose,
  onUpdateSnapshot,
}: InventoryItemDetailSheetProps) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px]">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>{item.name}</SheetTitle>
              <SheetDescription>
                Detalhe operacional do snapshot atual do item.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      SKU
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {item.sku}
                    </p>
                  </div>
                  <StatusBadge status={item.availabilityStatus} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.externalReference || 'Sem referência externa registrada.'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Quantidade
                    </p>
                    <p className="mt-2 text-xl font-bold text-foreground">
                      {item.availableQuantity}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Preço atual
                    </p>
                    <p className="mt-2 text-xl font-bold text-foreground">
                      {formatCurrency(item.currentPrice)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Origem operacional
                </p>
                <p className="text-sm text-foreground">{formatSource(item.source)}</p>
                <p className="text-xs text-muted-foreground">
                  {item.lastSyncedAt
                    ? `Última sincronização em ${new Date(item.lastSyncedAt).toLocaleString('pt-BR')}`
                    : 'Sem sincronização registrada'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={onUpdateSnapshot}
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar estoque do item
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
