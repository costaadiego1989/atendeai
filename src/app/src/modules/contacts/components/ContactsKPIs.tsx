import { Activity, UserCheck, UserMinus, Users } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface ContactsKPIsProps {
  total: number;
  pipeline: number;
  customers: number;
  inactive: number;
}

export function ContactsKPIs({ total, pipeline, customers, inactive }: ContactsKPIsProps) {
  return (
    <div className="card-grid">
      <KPICard
        title="Base de contatos"
        value={total.toLocaleString('pt-BR')}
        subtitle="Total de contatos cadastrados"
        icon={Users}
      />
      <KPICard
        title="Funil ativo"
        value={pipeline.toLocaleString('pt-BR')}
        subtitle="Em negociação no período"
        icon={Activity}
      />
      <KPICard
        title="Clientes"
        value={customers.toLocaleString('pt-BR')}
        subtitle="Contatos já convertidos"
        icon={UserCheck}
      />
      <KPICard
        title="Inativos"
        value={inactive.toLocaleString('pt-BR')}
        subtitle="Sem interação recente"
        icon={UserMinus}
      />
    </div>
  );
}
