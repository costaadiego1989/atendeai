import React from 'react';
import { ShoppingCart, CreditCard, Truck, PackageCheck } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { formatCurrency } from '@/shared/lib/formatters';

interface CheckoutKPIDeltas {
  openCount?: number;
  awaitingPaymentCount?: number;
  waitingRevenue?: number;
  paidRevenue?: number;
}

interface CheckoutKPIsProps {
  summary: {
    openCount: number;
    awaitingPaymentCount: number;
    waitingRevenue: number;
    paidRevenue: number;
  };
  deltas?: CheckoutKPIDeltas;
}

function toTrend(delta?: number) {
  if (delta == null) return undefined;
  return { value: delta, positive: delta >= 0 };
}

export const CheckoutKPIs: React.FC<CheckoutKPIsProps> = ({ summary, deltas }) => {
  return (
    <div className="card-grid">
      <KPICard
        title="Pedidos em aberto"
        value={summary.openCount}
        subtitle="Exigem atuação ou acompanhamento"
        icon={ShoppingCart}
        trend={toTrend(deltas?.openCount)}
      />
      <KPICard
        title="Aguardando pagamento"
        value={summary.awaitingPaymentCount}
        subtitle="Links de checkout enviados"
        icon={CreditCard}
        trend={toTrend(deltas?.awaitingPaymentCount)}
      />
      <KPICard
        title="Receita aguardando"
        value={formatCurrency(summary.waitingRevenue) ?? 'R$ 0,00'}
        subtitle="Total em links pendentes"
        icon={Truck}
        trend={toTrend(deltas?.waitingRevenue)}
      />
      <KPICard
        title="Receita paga"
        value={formatCurrency(summary.paidRevenue) ?? 'R$ 0,00'}
        subtitle="Pedidos convertidos em caixa"
        icon={PackageCheck}
        trend={toTrend(deltas?.paidRevenue)}
      />
    </div>
  );
};
