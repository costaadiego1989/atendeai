import React from 'react';
import { ShoppingCart, CreditCard, Truck, PackageCheck } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { formatCurrency } from '@/shared/lib/formatters';

interface CheckoutKPIsProps {
  summary: {
    openCount: number;
    awaitingPaymentCount: number;
    waitingRevenue: number;
    paidRevenue: number;
  };
}

export const CheckoutKPIs: React.FC<CheckoutKPIsProps> = ({ summary }) => {
  return (
    <div className="card-grid">
      <KPICard
        title="Pedidos em aberto"
        value={summary.openCount}
        subtitle="Exigem atuação ou acompanhamento"
        icon={ShoppingCart}
      />
      <KPICard
        title="Aguardando pagamento"
        value={summary.awaitingPaymentCount}
        subtitle="Links de checkout enviados"
        icon={CreditCard}
      />
      <KPICard
        title="Receita aguardando"
        value={formatCurrency(summary.waitingRevenue) ?? 'R$ 0,00'}
        subtitle="Total em links pendentes"
        icon={Truck}
      />
      <KPICard
        title="Receita paga"
        value={formatCurrency(summary.paidRevenue) ?? 'R$ 0,00'}
        subtitle="Pedidos convertidos em caixa"
        icon={PackageCheck}
      />
    </div>
  );
};
