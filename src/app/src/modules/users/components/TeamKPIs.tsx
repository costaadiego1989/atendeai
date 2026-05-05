import { UserCheck, Users, ShieldCheck, UserCog } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface TeamKPIsProps {
  total: number;
  admins: number;
  agents: number;
  active: number;
}

export function TeamKPIs({ total, admins, agents, active }: TeamKPIsProps) {
  return (
    <div className="card-grid mb-8">
      <KPICard
        title="Total da Equipe"
        value={total}
        subtitle="Colaboradores no tenant"
        icon={Users}
      />
      <KPICard
        title="Administradores"
        value={admins}
        subtitle="Gestão total da conta"
        icon={ShieldCheck}
      />
      <KPICard
        title="Agentes"
        value={agents}
        subtitle="Foco em atendimento"
        icon={UserCog}
      />
      <KPICard
        title="Ativos"
        value={active}
        subtitle="Acessos já validados"
        icon={UserCheck}
      />
    </div>
  );
}
