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
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatCurrencyInput } from '@/shared/lib/masks';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingCreateCategorySheet({ vm }: Props) {
  return (
    <Sheet open={vm.createCategoryOpen} onOpenChange={vm.setCreateCategoryOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova categoria</SheetTitle>
          <SheetDescription>
            Crie um serviço ou procedimento para organizar a agenda.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              value={vm.createCategoryForm.name}
              onChange={(event) =>
                vm.setCreateCategoryForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-unit">Como vai cobrar por esse serviço?</Label>
            <Select
              value={vm.createCategoryForm.unit}
              onValueChange={(value) =>
                vm.setCreateCategoryForm((current) => ({
                  ...current,
                  unit: value as 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION',
                }))
              }
            >
              <SelectTrigger id="category-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_MINUTE">Por minuto</SelectItem>
                <SelectItem value="PER_SESSION">Por sessão</SelectItem>
                <SelectItem value="PER_CONSULTATION">Por consulta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-duration">
              Tempo em minutos
              {vm.createCategoryForm.unit === 'PER_MINUTE' ? ' *' : ' (opcional)'}
            </Label>
            <Input
              id="category-duration"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={vm.createCategoryForm.durationMinutes}
              placeholder={vm.createCategoryForm.unit === 'PER_MINUTE' ? 'Ex: 30' : 'Ex: 50'}
              onChange={(event) =>
                vm.setCreateCategoryForm((current) => ({
                  ...current,
                  durationMinutes: event.target.value.replace(/\D/g, ''),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {vm.createCategoryForm.unit === 'PER_MINUTE'
                ? 'Obrigatorio para categorias cobradas por minuto.'
                : 'Opcional para sessao ou consulta.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-base-price">preço base</Label>
            <Input
              id="category-base-price"
              inputMode="decimal"
              value={vm.createCategoryForm.basePrice}
              placeholder="Ex: 120,00"
              onChange={(event) =>
                vm.setCreateCategoryForm((current) => ({
                  ...current,
                  basePrice: formatCurrencyInput(event.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Esse preço pode ser sobrescrito em horários especificos.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setCreateCategoryOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitCreateCategory}
            disabled={vm.createCategoryMutation.isPending}
          >
            Criar categoria
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
