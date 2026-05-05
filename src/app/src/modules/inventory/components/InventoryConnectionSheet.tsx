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
import { Textarea } from '@/components/ui/textarea';

interface ConnectionForm {
  sourceType:
    | 'MANUAL_SNAPSHOT'
    | 'CSV_IMPORT'
    | 'ERP_SYNC'
    | 'PDV_SYNC'
    | 'ECOMMERCE_SYNC'
    | 'BLING'
    | 'TINY';
  providerName: string;
  configSummary: string;
}

interface InventoryConnectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ConnectionForm;
  onFormChange: React.Dispatch<React.SetStateAction<ConnectionForm>>;
  onSubmit: () => void;
  isPending: boolean;
}

export function InventoryConnectionSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: InventoryConnectionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova conexão de estoque</SheetTitle>
          <SheetDescription>
            Registre a origem que no futuro faremos sincronizar automaticamente.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de conexão</Label>
            <Select
              value={form.sourceType}
              onValueChange={(value: ConnectionForm['sourceType']) =>
                onFormChange((current) => ({ ...current, sourceType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ERP_SYNC">ERP</SelectItem>
                <SelectItem value="BLING">Bling</SelectItem>
                <SelectItem value="TINY">Tiny</SelectItem>
                <SelectItem value="PDV_SYNC">PDV</SelectItem>
                <SelectItem value="ECOMMERCE_SYNC">E-commerce</SelectItem>
                <SelectItem value="CSV_IMPORT">CSV</SelectItem>
                <SelectItem value="MANUAL_SNAPSHOT">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nome do provedor</Label>
            <Input
              value={form.providerName}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, providerName: event.target.value }))
              }
              placeholder="Ex: Bling ERP"
            />
          </div>
          <div className="space-y-2">
            <Label>Resumo da configuração</Label>
            <Textarea
              rows={4}
              value={form.configSummary}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, configSummary: event.target.value }))
              }
              placeholder="Ex: sincronizar SKU, preço e quantidade a cada 15 minutos."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !form.providerName.trim()}
          >
            {isPending ? 'Salvando...' : 'Salvar conexão'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
