import React from 'react';
import { Clock, Headphones, MessageSquare, Users } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface MessagingKPIsProps {
  stats: {
    newItems: number;
    ownedItems: number;
    waitingItems: number;
    pendingHumanItems: number;
  };
}

export const MessagingKPIs: React.FC<MessagingKPIsProps> = ({ stats }) => {
  return (
    <div className="card-grid">
      <KPICard
        title="Novas Mensagens"
        value={stats.newItems}
        subtitle="Aguardando classificação"
        icon={MessageSquare}
      />
      <KPICard
        title="Meus Atendimentos"
        value={stats.ownedItems}
        subtitle="Conversas assumidas por você"
        icon={Users}
      />
      <KPICard
        title="Atendimento Humano"
        value={stats.pendingHumanItems}
        subtitle="Fila total da equipe"
        icon={Headphones}
      />
      <KPICard
        title="Aguardando Retorno"
        value={stats.waitingItems}
        subtitle="Dependem de resposta do cliente"
        icon={Clock}
      />
    </div>
  );
};
