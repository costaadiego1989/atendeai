import React from 'react';
import { MessageSquare, Users, Clock, ArrowRight } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface MessagingKPIsProps {
  stats: {
    newItems: number;
    ownedItems: number;
    waitingItems: number;
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
        title="Aguardando Retorno"
        value={stats.waitingItems}
        subtitle="Dependem de resposta do cliente"
        icon={Clock}
      />
    </div>
  );
};
