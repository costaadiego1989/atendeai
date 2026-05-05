import { ArrowDownRight, ArrowRight, GitBranchPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/shared/ui/EmptyState';

export interface DynamicFunnelStep {
  id: string;
  label: string;
  count: number;
  helper?: string;
  amountLabel?: string;
}

interface DynamicFunnelProps {
  title: string;
  description: string;
  steps: DynamicFunnelStep[];
  emptyMessage?: string;
  gridClassName?: string;
}

export function DynamicFunnel({
  title,
  description,
  steps,
  emptyMessage = 'Ainda não existem dados suficientes para montar o funil.',
  gridClassName = 'md:grid-cols-2 2xl:grid-cols-4',
}: DynamicFunnelProps) {
  const maxCount = Math.max(...steps.map((step) => step.count), 0);
  const hasData = maxCount > 0;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4">
            <EmptyState
              icon={GitBranchPlus}
              title="Funil ainda sem movimentação"
              description={emptyMessage}
            />
          </div>
        ) : (
          <div className={`grid gap-3 ${gridClassName}`}>
            {steps.map((step, index) => {
              const previousCount = index > 0 ? steps[index - 1]?.count ?? 0 : 0;
              const shareOfPeak = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
              const conversionFromPrevious =
                index > 0 && previousCount > 0
                  ? (step.count / previousCount) * 100
                  : null;

              return (
                <div
                  key={step.id}
                  className="rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Etapa {index + 1}
                      </p>
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    </div>

                    {index > 0 ? (
                      <Badge variant="outline" className="gap-1 whitespace-nowrap">
                        <ArrowDownRight className="h-3 w-3" />
                        {conversionFromPrevious?.toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="whitespace-nowrap">
                        Base
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="text-3xl font-bold text-foreground">
                      {step.count.toLocaleString('pt-BR')}
                    </p>
                    {step.amountLabel ? (
                      <p className="text-xs text-muted-foreground">{step.amountLabel}</p>
                    ) : null}
                  </div>

                  <Progress value={shareOfPeak} className="mt-4 h-2.5" />

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{step.helper ?? 'Sem observações adicionais.'}</span>
                    {index < steps.length - 1 ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
