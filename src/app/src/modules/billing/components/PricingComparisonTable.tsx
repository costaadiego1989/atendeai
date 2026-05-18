import { useState } from 'react';
import { Check, Info, Minus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BillingPlan } from '@/shared/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/shared/lib/formatters';
import {
  type BillingCycle,
  calculateMonthlyPrice,
  calculateAnnualSavings,
  getPromoDiscountPercent,
  isPromoActive,
} from '@/modules/billing/view-models/billing-pricing-helpers';

interface PricingComparisonTableProps {
  plans: BillingPlan[];
  currentPlanCode: string;
  onSelectPlan: (plan: BillingPlan, cycle: BillingCycle) => void;
  isLoading?: boolean;
  recommendedPlanCode?: BillingPlan['code'] | null;
}

export function PricingComparisonTable({
  plans,
  currentPlanCode,
  onSelectPlan,
  isLoading,
  recommendedPlanCode,
}: PricingComparisonTableProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const promoActive = isPromoActive();
  const promoPercent = getPromoDiscountPercent();

  const sortedPlans = [...plans]
    .filter((p) => p.code !== 'TRIAL')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const uniqueFeatures = Array.from(new Set(sortedPlans.flatMap((plan) => plan.features || [])));

  const quotaRows = [
    {
      name: 'Conversas / mês',
      tooltip: 'Capacidade mensal de conversas atendidas no WhatsApp.',
      getValue: (plan: BillingPlan) => plan.messagesQuota.toLocaleString('pt-BR'),
    },
    {
      name: 'Tokens IA / mês',
      tooltip: 'Franquia de inteligência artificial para automação de conversas.',
      getValue: (plan: BillingPlan) => plan.aiTokensQuota.toLocaleString('pt-BR'),
    },
    {
      name: 'Capacidade CRM (contatos)',
      tooltip: 'Total de clientes únicos armazenados na base.',
      getValue: (plan: BillingPlan) => plan.contactsQuota.toLocaleString('pt-BR'),
    },
    {
      name: 'Filiais ativas',
      tooltip: 'Quantidade de filiais/unidades incluídas no plano.',
      getValue: (plan: BillingPlan) => String(plan.config?.limits?.branches ?? 1),
    },
    {
      name: 'WhatsApps conectados',
      tooltip: 'Quantidade de números de WhatsApp incluídos no plano.',
      getValue: (plan: BillingPlan) => String(plan.config?.limits?.whatsappNumbers ?? 1),
    },
    {
      name: 'Usuários operacionais',
      tooltip: 'Quantidade de pessoas operando no sistema.',
      getValue: (plan: BillingPlan) => String(plan.config?.limits?.users ?? 1),
    },
    {
      name: 'Prospecções / dia',
      tooltip: 'Limite diário de leads pesquisados no módulo de prospecção.',
      getValue: (plan: BillingPlan) =>
        (plan.config?.limits?.prospectingDaily ?? 150).toLocaleString('pt-BR'),
    },
  ];

  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="mx-auto h-5 w-5 text-primary" />
      ) : (
        <Minus className="mx-auto h-5 w-5 text-muted-foreground/30" />
      );
    }

    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <TooltipProvider>
      {/* Billing cycle toggle */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={cn(
            'rounded-full px-5 py-2 text-sm font-medium transition-all',
            billingCycle === 'monthly'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted',
          )}
        >
          Mensal
          {promoActive && (
            <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
              -{promoPercent}%
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle('annual')}
          className={cn(
            'rounded-full px-5 py-2 text-sm font-medium transition-all',
            billingCycle === 'annual'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted',
          )}
        >
          Anual
        </button>
      </div>

      {promoActive && (
        <p className="mb-4 text-center text-sm text-emerald-600">
          Promoção de lançamento: {promoPercent}% de desconto em todos os planos.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px]">Funcionalidades</TableHead>
              {sortedPlans.map((plan) => {
                const effectiveMonthly = calculateMonthlyPrice(plan.monthlyPrice, billingCycle);
                const savings = billingCycle === 'annual' ? calculateAnnualSavings(plan.monthlyPrice) : 0;

                return (
                  <TableHead
                    key={plan.code}
                    className={cn(
                      'py-8 text-center',
                      plan.code === 'PROFISSIONAL' && 'bg-primary/[0.02]',
                      currentPlanCode === plan.code && 'bg-primary/[0.05]',
                    )}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-lg font-bold">{plan.displayName}</span>
                        {plan.code === 'PROFISSIONAL' && (
                          <Badge className="border-none bg-primary/10 text-primary hover:bg-primary/20">
                            Popular
                          </Badge>
                        )}
                        {recommendedPlanCode === plan.code && (
                          <Badge className="border-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                            Indicado
                          </Badge>
                        )}
                      </div>

                      {promoActive && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatCurrency(plan.monthlyPrice)}/mês
                        </p>
                      )}
                      <p className="text-2xl font-black">
                        {formatCurrency(effectiveMonthly)}
                      </p>
                      <span className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">
                        {billingCycle === 'annual' ? 'por mês no plano anual' : 'por mês'}
                      </span>
                      {billingCycle === 'annual' && savings > 0 && (
                        <Badge className="border-none bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                          Economia de {formatCurrency(savings)}/ano
                        </Badge>
                      )}
                      {currentPlanCode === plan.code && (
                        <Badge variant="secondary" className="mt-1">
                          Atual
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotaRows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {row.name}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">{row.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                {sortedPlans.map((plan) => (
                  <TableCell key={`${plan.code}-${row.name}`} className="text-center">
                    {renderValue(row.getValue(plan))}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {uniqueFeatures.map((feature) => (
              <TableRow key={feature}>
                <TableCell className="font-medium">{feature}</TableCell>
                {sortedPlans.map((plan) => {
                  const hasFeature = sortedPlans
                    .filter((candidate) => (candidate.sortOrder || 0) <= (plan.sortOrder || 0))
                    .some((candidate) => candidate.features?.includes(feature));

                  return (
                    <TableCell key={`${plan.code}-${feature}`} className="text-center">
                      {renderValue(hasFeature)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            <TableRow className="hover:bg-transparent">
              <TableCell className="text-xs text-muted-foreground">
                Módulos extras são contratados separadamente.
              </TableCell>
              {sortedPlans.map((plan) => (
                <TableCell
                  key={`${plan.code}-action`}
                  className={cn(
                    'py-6 text-center',
                    plan.code === 'PROFISSIONAL' && 'bg-primary/[0.02]',
                  )}
                >
                  <Button
                    variant={
                      currentPlanCode === plan.code
                        ? 'outline'
                        : plan.code === 'PROFISSIONAL'
                          ? 'default'
                          : 'outline'
                    }
                    size="sm"
                    disabled={currentPlanCode === plan.code || isLoading}
                    onClick={() => onSelectPlan(plan, billingCycle)}
                  >
                    {currentPlanCode === plan.code ? 'Plano atual' : 'Contratar plano'}
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
