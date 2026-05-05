import { BriefcaseBusiness, CalendarDays, Clock3, Users } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingOverviewCards({ vm }: Props) {
  return (
    <div className="card-grid">
      <KPICard
        title="Profissionais"
        value={vm.professionals.length}
        subtitle="Equipe ativa na agenda"
        icon={Users}
      />
      <KPICard
        title="Categorias"
        value={vm.categories.length}
        subtitle="Serviços ou procedimentos"
        icon={BriefcaseBusiness}
      />
      <KPICard
        title="Slots do dia"
        value={vm.availabilitySlots.length}
        subtitle="Grade do profissional selecionado"
        icon={Clock3}
      />
      <KPICard
        title="Reservas"
        value={
          vm.availabilitySlots.filter(
            (slot) =>
              slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED',
          ).length
        }
        subtitle="Horários ocupados no dia"
        icon={CalendarDays}
      />
    </div>
  );
}
