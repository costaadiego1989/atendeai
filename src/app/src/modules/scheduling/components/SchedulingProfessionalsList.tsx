import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2, Plus, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatPhone } from '@/shared/lib/masks';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingProfessionalsList({ vm }: Props) {
  return (
    <Card className="glass-card lg:col-span-1 h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Profissionais</CardTitle>
        <Button size="icon" onClick={() => vm.setCreateProfessionalOpen(true)} className="rounded-lg shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all text-primary-foreground">
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {vm.professionals.length ? (
          vm.professionals.map((professional) => (
            <button
              key={professional.id}
              onClick={() => vm.setSelectedProfessionalId(professional.id)}
              className={cn(
                'w-full rounded-2xl border p-4 text-left transition-all',
                vm.selectedProfessionalId === professional.id
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/60 hover:bg-muted/20',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{professional.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {professional.phone
                      ? formatPhone(professional.phone)
                      : 'Telefone para confirmacoes não definido'}
                  </p>
                </div>
                <StatusBadge status={professional.active ? 'ACTIVE' : 'CLOSED'} />
              </div>
              {vm.professionalCategoryMap[professional.id]?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {vm.professionalCategoryMap[professional.id]
                    .slice(0, 3)
                    .map((category) => (
                      <Badge
                        key={category.id}
                        variant="secondary"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        {category.name}
                      </Badge>
                    ))}
                  {vm.professionalCategoryMap[professional.id].length > 3 ? (
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                      +{vm.professionalCategoryMap[professional.id].length - 3}
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Nenhuma categoria vinculada ainda.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={(event) => {
                    event.stopPropagation();
                    vm.openAssignCategories(professional.id);
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Vincular categorias
                </Button>
              </div>
            </button>
          ))
        ) : (
          <EmptyState
            icon={UserRound}
            title="Nenhum profissional"
            description="Cadastre o primeiro profissional para montar sua agenda."
          />
        )}
      </CardContent>
    </Card>
  );
}
