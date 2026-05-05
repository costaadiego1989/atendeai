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

interface CatalogCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  currentCategoryId?: string;
  categories: any[];
  form: {
    name: string;
    description: string;
    parentCategoryId: string;
  };
  onFormChange: (data: any) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CatalogCategorySheet({
  open,
  onOpenChange,
  isEditing,
  currentCategoryId,
  categories,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: CatalogCategorySheetProps) {
  const parentOptions = categories.filter((category) => category.id !== currentCategoryId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</SheetTitle>
          <SheetDescription>
            Organize serviços, produtos e locações em grupos reutilizáveis.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Nome da categoria</Label>
            <Input
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              placeholder="Ex: Procedimentos premium"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria pai</Label>
            <Select
              value={form.parentCategoryId || 'none'}
              onValueChange={(value) =>
                onFormChange({ ...form, parentCategoryId: value === 'none' ? '' : value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Categoria raiz</SelectItem>
                {parentOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {Array.isArray(category.path) && category.path.length > 0
                      ? category.path.join(' / ')
                      : category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              placeholder="Explique quando essa categoria deve aparecer na operação."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !form.name.trim()}
          >
            {isPending ? 'Salvando...' : isEditing ? 'Salvar ajustes' : 'Salvar categoria'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
