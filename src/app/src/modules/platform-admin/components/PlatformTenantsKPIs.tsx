import { Building2, CreditCard, Users } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import type { PlatformTenantOverviewItemDto } from '../types/platform-admin.types';

interface PlatformTenantsKPIsProps {
  items: PlatformTenantOverviewItemDto[];
  totalAcrossPages: number;
}

export function PlatformTenantsKPIs({ items, totalAcrossPages }: PlatformTenantsKPIsProps) {
  const withSub = items.filter((i) => i.subscription !== null).length;

  function approxUsagePctAvg(): number {
    if (!items.length) return 0;
    let sum = 0;
    let n = 0;
    for (const row of items) {
      const qm = row.quotas.messages.limit;
      const um = row.usage.messages.used;
      if (qm > 0) {
        sum += Math.min(100, Math.round((um / qm) * 100));
        n += 1;
      }
    }
    return n === 0 ? 0 : Math.round(sum / n);
  }

  const avgMsg = approxUsagePctAvg();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KPICard
        title="Tenants cadastrados"
        value={String(totalAcrossPages)}
        subtitle="Total no banco"
        icon={Building2}
      />
      <KPICard
        title="Com assinatura (esta página)"
        value={`${withSub} / ${items.length}`}
        subtitle="Linhas onde subscription existe"
        icon={CreditCard}
      />
      <KPICard
        title="Uso médio msgs (esta página)"
        value={`${avgMsg}%`}
        subtitle="Dos tenants com quota mensagens maior que zero"
        icon={Users}
      />
    </div>
  );
}
