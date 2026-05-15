import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatPhone } from '@/shared/lib/masks';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingCreateProfessionalSheet({ vm }: Props) {
  return (
    <Sheet open={vm.createProfessionalOpen} onOpenChange={vm.setCreateProfessionalOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo profissional</SheetTitle>
          <SheetDescription>
            Cadastre um profissional para começar a distribuir categorias e horários.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="professional-name">Nome</Label>
            <Input
              id="professional-name"
              value={vm.createProfessionalForm.name}
              onChange={(event) =>
                vm.setCreateProfessionalForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="professional-phone">Telefone do profissional</Label>
            <Input
              id="professional-phone"
              inputMode="tel"
              value={formatPhone(vm.createProfessionalForm.phone)}
              onChange={(event) =>
                vm.setCreateProfessionalForm((current) => ({
                  ...current,
                  phone: formatPhone(event.target.value),
                }))
              }
              placeholder="Ex: (21) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              O número do usuário logado entra como base, mas você pode trocar para o celular
              que deve receber as confirmações da agenda.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setCreateProfessionalOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={vm.submitCreateProfessional}
            disabled={vm.createProfessionalMutation.isPending}
          >
            Criar profissional
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
