import { Contact2, UserCheck, Users, UserX } from 'lucide-react';
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
        title="Total no CRM"
        value={total}
        subtitle="Base atual de contatos"
        icon={Users}
      />
      <KPICard
        title="Funil ativo"
        value={pipeline}
        subtitle="Lead, prospect e oportunidade"
        icon={Contact2}
      />
      <KPICard
        title="Clientes"
        value={customers}
        subtitle="Relacionamentos convertidos"
        icon={UserCheck}
      />
      <KPICard
        title="Inativos"
        value={inactive}
        subtitle="Contatos fora do fluxo"
        icon={UserX}
      />
    </div>
  );
}
