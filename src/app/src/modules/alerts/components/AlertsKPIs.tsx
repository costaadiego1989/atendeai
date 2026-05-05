import { Bell, Clock3, PauseCircle, PhoneIncoming } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { formatPhone } from '@/shared/lib/masks';

interface AlertsKPIsProps {
  resolvedPhone?: string;
  activeCount: number;
  pausedCount: number;
  sentCount: number;
}

export function AlertsKPIs({
  resolvedPhone,
  activeCount,
  pausedCount,
  sentCount,
}: AlertsKPIsProps) {
  return (
    <div className="card-grid mb-8">
      <KPICard
        title="Seu WhatsApp"
        value={resolvedPhone ? formatPhone(resolvedPhone) : 'Não encontrado'}
        subtitle="Onde você recebe os alertas"
        icon={PhoneIncoming}
      />
      <KPICard
        title="Alertas Ativos"
        value={activeCount}
        subtitle="Lembretes na fila de disparo"
        icon={Bell}
      />
      <KPICard
        title="Pausados"
        value={pausedCount}
        subtitle="Aguardando reativação"
        icon={PauseCircle}
      />
      <KPICard
        title="Concluídos"
        value={sentCount}
        subtitle="Alertas já disparados"
        icon={Clock3}
      />
    </div>
  );
}
