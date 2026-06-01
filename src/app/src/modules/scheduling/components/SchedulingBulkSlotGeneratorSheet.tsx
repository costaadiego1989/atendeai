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
import { formatCurrency } from '../view-models/scheduling-formatters';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingBulkSlotGeneratorSheet({ vm }: Props) {
  return (
    <Sheet open={vm.bulkSlotGeneratorOpen} onOpenChange={vm.setBulkSlotGeneratorOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gerar horários em lote</SheetTitle>
          <SheetDescription>
            Preencha um período e a agenda cria os slots automaticamente, respeitando o horário
            de funcionamento da empresa quando ele existir.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-professional">Profissional</Label>
            <Select
              value={vm.bulkSlotGeneratorForm.professionalId}
              onValueChange={(value) =>
                vm.setBulkSlotGeneratorForm((current) => ({
                  ...current,
                  professionalId: value,
                }))
              }
            >
              <SelectTrigger id="bulk-professional">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {vm.professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vm.selectedBulkGenerationProfessional ? (
              <p className="text-xs text-muted-foreground">
                Os slots serao gerados para {vm.selectedBulkGenerationProfessional.name}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Escolha o profissional que vai receber essa grade de horários.
              </p>
            )}
          </div>

          {vm.bulkGenerationProfessionalCategories.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="bulk-category">Categoria vinculada</Label>
              <Select
                value={vm.bulkSlotGeneratorForm.categoryId}
                onValueChange={(value) =>
                  vm.setBulkSlotGeneratorForm((current) => {
                    const nextCategory = vm.categories.find((category) => category.id === value);

                    return {
                      ...current,
                      categoryId: value,
                      slotDurationMinutes: String(nextCategory?.durationMinutes ?? 30),
                    };
                  })
                }
              >
                <SelectTrigger id="bulk-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {vm.bulkGenerationProfessionalCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {vm.selectedBulkGenerationCategory ? (
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
              Slots orientados por{' '}
              <strong className="text-foreground">{vm.selectedBulkGenerationCategory.name}</strong>
              {vm.selectedBulkGenerationCategory.durationMinutes
                ? ` - ${vm.selectedBulkGenerationCategory.durationMinutes} min`
                : ''}
              {vm.selectedBulkGenerationCategory.basePrice
                ? ` - ${formatCurrency(vm.selectedBulkGenerationCategory.basePrice)}`
                : ''}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-start-date">Data inicial</Label>
              <Input
                id="bulk-start-date"
                type="date"
                value={vm.bulkSlotGeneratorForm.startDate}
                onChange={(event) =>
                  vm.setBulkSlotGeneratorForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-end-date">Data final</Label>
              <Input
                id="bulk-end-date"
                type="date"
                value={vm.bulkSlotGeneratorForm.endDate}
                onChange={(event) =>
                  vm.setBulkSlotGeneratorForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bulk-day-start">horário inicial</Label>
              <Input
                id="bulk-day-start"
                type="time"
                value={vm.bulkSlotGeneratorForm.dayStartsAt}
                onChange={(event) =>
                  vm.setBulkSlotGeneratorForm((current) => ({
                    ...current,
                    dayStartsAt: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-day-end">horário final</Label>
              <Input
                id="bulk-day-end"
                type="time"
                value={vm.bulkSlotGeneratorForm.dayEndsAt}
                onChange={(event) =>
                  vm.setBulkSlotGeneratorForm((current) => ({
                    ...current,
                    dayEndsAt: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-slot-duration">Duração do slot</Label>
              <Input
                id="bulk-slot-duration"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={vm.bulkSlotGeneratorForm.slotDurationMinutes}
                onChange={(event) =>
                  vm.setBulkSlotGeneratorForm((current) => ({
                    ...current,
                    slotDurationMinutes: event.target.value.replace(/\D/g, ''),
                  }))
                }
                placeholder="Ex: 30"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
            Quando o horário do dia atingir o limite configurado no funcionamento da empresa, a
            agenda pula automaticamente para o próximo dia útil do período.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setBulkSlotGeneratorOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitBulkSlotGeneration}
            disabled={vm.generateBulkSlotsMutation.isPending}
          >
            Gerar slots
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
