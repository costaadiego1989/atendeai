import { BriefcaseBusiness, CalendarDays, Clock3, Users } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';

type Props = {
  vm: SchedulingPageViewModel;
};

const valueSkeleton = <Skeleton className="mt-2 h-7 w-12" />;

export function SchedulingOverviewCards({ vm }: Props) {
  const professionalsLoading = vm.professionalsQuery.isLoading;
  const categoriesLoading = vm.categoriesQuery.isLoading;
  const availabilityLoading = vm.availabilityQuery.isLoading;

  return (
    <div className="card-grid">
      <KPICard
        title="Profissionais"
        value={professionalsLoading ? valueSkeleton : vm.professionals.length}
        subtitle="Equipe ativa na agenda"
        icon={Users}
      />
      <KPICard
        title="Categorias"
        value={categoriesLoading ? valueSkeleton : vm.categories.length}
        subtitle="Serviços ou procedimentos"
        icon={BriefcaseBusiness}
      />
      <KPICard
        title="Slots do dia"
        value={availabilityLoading ? valueSkeleton : vm.availabilitySlots.length}
        subtitle="Grade do profissional selecionado"
        icon={Clock3}
      />
      <KPICard
        title="Reservas"
        value={availabilityLoading ? valueSkeleton : vm.reservationsCount}
        subtitle="Horários ocupados no dia"
        icon={CalendarDays}
      />
    </div>
  );
}
