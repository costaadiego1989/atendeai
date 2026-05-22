import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { CalendarDays, Plus, ScissorsSquare, Users } from 'lucide-react';
import {
  formatCategoryMeta,
  formatCurrency,
  formatSlotTime,
} from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingCategoriesTab({ vm }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-4 pt-1">
      <Card className="glass-card lg:col-span-1 h-fit">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Categorias</CardTitle>
          <Button size="icon" onClick={() => vm.setCreateCategoryOpen(true)} className="rounded-lg shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all text-primary-foreground">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {vm.categories.length ? (
            vm.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => vm.setSelectedCategoryId(category.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-all',
                  vm.selectedCategoryId === category.id
                    ? 'border-primary/30 bg-primary/[0.05]'
                    : 'border-border/60 hover:bg-muted/20',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{category.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCategoryMeta(category)}
                    </p>
                    {formatCurrency(category.basePrice) ? (
                      <p className="mt-1 text-xs font-medium text-foreground">
                        Preço base: {formatCurrency(category.basePrice)}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={category.active ? 'ACTIVE' : 'CLOSED'} />
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              icon={ScissorsSquare}
              title="Nenhuma categoria"
              description="Crie serviços ou procedimentos para organizar a agenda."
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-5 lg:col-span-3">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Profissionais da categoria</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vm.selectedCategory
                    ? `Veja quem atende ${vm.selectedCategory.name}.`
                    : 'Selecione uma categoria para ver os profissionais vinculados.'}
                </p>
              </div>
              <Input
                type="date"
                value={vm.selectedDate}
                onChange={(event) => vm.setSelectedDate(event.target.value)}
                className="h-10 w-full rounded-xl lg:w-[180px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            {vm.categoryProfessionals.length ? (
              <div className="flex flex-wrap gap-2">
                {vm.categoryProfessionals.map((professional) => (
                  <Badge
                    key={professional.id}
                    variant="secondary"
                    className="rounded-full px-3 py-1"
                  >
                    {professional.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="Sem profissionais vinculados"
                description="Abra um profissional e vincule categorias para começar a oferecer horários por serviço."
              />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Disponibilidade por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {vm.categoryAvailability.length ? (
              <div className="space-y-4">
                {vm.categoryAvailability.map((entry) => (
                  <div
                    key={entry.professionalId}
                    className="rounded-2xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {entry.professionalName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.slots.length} horários disponíveis
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.slots.map((slot) => (
                        <Badge
                          key={slot.id}
                          variant={
                            slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="rounded-full px-3 py-1 text-[11px]"
                        >
                          {formatSlotTime(slot)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Sem disponibilidade para esta categoria"
                description="Assim que os profissionais vinculados tiverem grade no dia escolhido, os horários aparecerão aqui."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
