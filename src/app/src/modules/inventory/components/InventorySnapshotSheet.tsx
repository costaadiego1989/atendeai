import { Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface SyncForm {
  catalogItemId: string;
  sku: string;
  externalReference: string;
  name: string;
  availableQuantity: string;
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice: string;
  source: 'MANUAL_SNAPSHOT' | 'CSV_IMPORT' | 'IMPORT_SNAPSHOT' | 'ERP_SYNC' | 'PDV_SYNC' | 'ECOMMERCE_SYNC';
}

interface InventorySnapshotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SyncForm;
  onFormChange: React.Dispatch<React.SetStateAction<SyncForm>>;
  onPriceChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  prefillCatalogItemId: string;
  isEditing?: boolean;
}

export function InventorySnapshotSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  onPriceChange,
  onSubmit,
  isPending,
  prefillCatalogItemId,
  isEditing = false,
}: InventorySnapshotSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Atualizar estoque' : 'Novo snapshot de estoque'}</SheetTitle>
          <SheetDescription>
            Use este fluxo para registrar disponibilidade e preço mesmo antes do sync automático.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do item</Label>
            <Input
              value={form.name}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ex: Café torrado 500g"
            />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, sku: event.target.value }))
              }
              placeholder="SKU-0001"
            />
          </div>
          <div className="space-y-2">
            <Label>Referência externa</Label>
            <Input
              value={form.externalReference}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  externalReference: event.target.value,
                }))
              }
              placeholder="ERP-ITEM-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Quantidade disponível</Label>
            <Input
              type="number"
              min="0"
              value={form.availableQuantity}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  availableQuantity: event.target.value,
                }))
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.availabilityStatus}
              onValueChange={(value: SyncForm['availabilityStatus']) =>
                onFormChange((current) => ({ ...current, availabilityStatus: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Disponível</SelectItem>
                <SelectItem value="LOW_STOCK">Estoque baixo</SelectItem>
                <SelectItem value="UNAVAILABLE">Indisponível</SelectItem>
                <SelectItem value="RESERVED">Reservado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preço atual</Label>
            <Input
              value={form.currentPrice}
              onChange={(event) => onPriceChange(event.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select
              value={form.source}
              onValueChange={(value: SyncForm['source']) =>
                onFormChange((current) => ({ ...current, source: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL_SNAPSHOT">Manual</SelectItem>
                <SelectItem value="CSV_IMPORT">CSV</SelectItem>
                <SelectItem value="IMPORT_SNAPSHOT">Import snapshot</SelectItem>
                <SelectItem value="ERP_SYNC">ERP</SelectItem>
                <SelectItem value="PDV_SYNC">PDV</SelectItem>
                <SelectItem value="ECOMMERCE_SYNC">E-commerce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !form.name.trim() || !form.sku.trim()}
          >
            {isPending ? 'Salvando...' : isEditing ? 'Atualizar estoque' : 'Salvar snapshot'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
