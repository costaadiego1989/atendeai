import { DatabaseZap, PackageSearch, PlugZap, Warehouse } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface InventoryKPIsProps {
  itemCount: number;
  totalQuantity: number;
  alertCount: number;
  connectionCount: number;
}

export function InventoryKPIs({
  itemCount,
  totalQuantity,
  alertCount,
  connectionCount,
}: InventoryKPIsProps) {
  return (
    <div className="card-grid mb-6">
      <KPICard
        title="Itens monitorados"
        value={itemCount}
        subtitle="SKUs operacionais do tenant"
        icon={Warehouse}
      />
      <KPICard
        title="Quantidade total"
        value={totalQuantity}
        subtitle="Soma das unidades disponíveis"
        icon={DatabaseZap}
      />
      <KPICard
        title="Alertas"
        value={alertCount}
        subtitle="Baixo saldo, reserva ou indisponibilidade"
        icon={PackageSearch}
      />
      <KPICard
        title="Conexões"
        value={connectionCount}
        subtitle="Canais preparados para sync futuro"
        icon={PlugZap}
      />
    </div>
  );
}
