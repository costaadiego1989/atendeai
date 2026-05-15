import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScissorsSquare } from 'lucide-react';
import { formatCategoryMeta } from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingAssignCategoriesSheet({ vm }: Props) {
  return (
    <Sheet open={vm.assignCategoriesOpen} onOpenChange={vm.setAssignCategoriesOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Vincular categorias</SheetTitle>
          <SheetDescription>
            Defina quais serviços esse profissional pode atender.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {vm.categories.length ? (
            vm.categories.map((category) => {
              const checked = vm.selectedAssignmentCategoryIds.includes(category.id);
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(state) =>
                      vm.toggleAssignmentCategory(category.id, Boolean(state))
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCategoryMeta(category)}
                    </p>
                  </div>
                </label>
              );
            })
          ) : (
            <EmptyState
              icon={ScissorsSquare}
              title="Sem categorias disponíveis"
              description="Crie categorias antes de vincular serviços aos profissionais."
              actionLabel="Criar nova categoria"
              onAction={() => {
                vm.setAssignCategoriesOpen(false);
                setTimeout(() => vm.setCreateCategoryOpen(true), 200);
              }}
            />
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setAssignCategoriesOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitAssignCategories}
            disabled={vm.assignCategoriesMutation.isPending}
          >
            Vincular categoria
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
