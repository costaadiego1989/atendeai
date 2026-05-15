import { CalendarClock, CircleDollarSign, FileText } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { formatCurrency } from '@/shared/lib/formatters';

type Props = {
  total: number;
  draft: number;
  scheduled: number;
  sent: number;
  totalValue: number;
};

export function ProposalsKPIs({ total, draft, scheduled, sent, totalValue }: Props) {
  return (
    <div className="card-grid">
      <KPICard
        title="Propostas"
        value={total}
        subtitle="Registros carregados na tela"
        icon={FileText}
      />
      <KPICard
        title="Rascunhos"
        value={draft}
        subtitle="Ainda em preparação"
        icon={FileText}
      />
      <KPICard
        title="Agendadas"
        value={scheduled}
        subtitle="Enviadas pela fila no horário definido"
        icon={CalendarClock}
      />
      <KPICard
        title="Enviadas"
        value={sent}
        subtitle={formatCurrency(totalValue) ?? 'R$ 0,00'}
        icon={CircleDollarSign}
      />
    </div>
  );
}
