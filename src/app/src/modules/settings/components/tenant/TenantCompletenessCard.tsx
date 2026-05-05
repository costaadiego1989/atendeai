import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tenant, TenantOwner } from '@/shared/types';
import { getTenantCompleteness } from './tenant-view-helpers';

function getCompletenessTone(percent: number) {
  if (percent >= 85) {
    return {
      badge: 'secondary' as const,
      text: 'text-emerald-300',
      bar: 'bg-emerald-400',
      label: 'Conta bem configurada',
    };
  }

  if (percent >= 50) {
    return {
      badge: 'outline' as const,
      text: 'text-amber-300',
      bar: 'bg-amber-400',
      label: 'Configuração em progresso',
    };
  }

  return {
    badge: 'outline' as const,
    text: 'text-rose-300',
    bar: 'bg-rose-400',
    label: 'Conta incompleta',
  };
}

export function TenantCompletenessCard({
  tenantData,
  owner,
}: {
  tenantData?: Tenant;
  owner?: TenantOwner;
}) {
  const completeness = getTenantCompleteness(tenantData, owner);
  const tone = getCompletenessTone(completeness.percent);
  const pendingItems = completeness.items.filter((item) => !item.done);

  return (
    <div className="mb-6 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Completude da conta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quanto mais completa esta configuração, melhor a IA, o suporte e a operação do
            produto funcionam.
          </p>
        </div>
        <Badge variant={tone.badge} className={cn('px-3 py-1 text-xs', tone.text)}>
          {tone.label}
        </Badge>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-foreground">{completeness.percent}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {completeness.completed} de {completeness.total} blocos configurados
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-background/70">
        <div
          className={cn('h-2 rounded-full transition-all', tone.bar)}
          style={{ width: `${completeness.percent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {completeness.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              item.done
                ? 'border-emerald-500/20 bg-emerald-500/5 text-foreground'
                : 'border-border/60 bg-background/60 text-muted-foreground',
            )}
          >
            {item.label}
          </div>
        ))}
      </div>

      {pendingItems.length ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Proximos passos
          </p>
          <p className="mt-2 text-sm text-foreground">
            {pendingItems.slice(0, 3).map((item) => item.label).join(' • ')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
