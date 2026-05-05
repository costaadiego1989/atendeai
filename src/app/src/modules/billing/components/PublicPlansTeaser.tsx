import { Loader2 } from 'lucide-react';
import { usePublicBillingPlansQuery } from '@/modules/billing/view-models/usePublicBillingPlansQuery';
import { formatCurrency } from '@/shared/lib/formatters';

export function PublicPlansTeaser() {
  const { data: plans, isLoading, isError } = usePublicBillingPlansQuery();

  if (isError) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center border-t border-border/60 pt-5">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const visible = (plans ?? []).filter((plan) => plan.code !== 'TRIAL');

  if (!visible.length) {
    return null;
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Planos base (mensal)
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {visible.map((plan) => (
          <li
            key={plan.code}
            className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
          >
            <p className="text-sm font-semibold text-foreground">{plan.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(plan.monthlyPrice) ?? '—'} / mês
            </p>
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Valores públicos; add-ons e nichos podem alterar o total após o cadastro.
      </p>
    </div>
  );
}
