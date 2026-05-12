import { Download, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/shared/ui/EmptyState';

export function DashboardUsagePanel({
  usageSeries,
  plan,
  billingCycle,
  onExportCsv,
}: {
  usageSeries: Array<{
    id: string;
    label: string;
    used: number;
    quota: number;
    percentage: number;
  }>;
  plan?: string;
  billingCycle?: { start: string; end: string };
  onExportCsv?: () => void;
}) {
  return (
    <Card className="glass-card">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Consumo do plano</CardTitle>
          {onExportCsv && usageSeries.length > 0 ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onExportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {plan ? `Plano ${plan}` : 'Uso atual da operação'}{' '}
          {billingCycle?.start && billingCycle?.end
            ? `- ciclo de ${new Date(billingCycle.start).toLocaleDateString('pt-BR')} ate ${new Date(billingCycle.end).toLocaleDateString('pt-BR')}`
            : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {usageSeries.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Consumo indisponível"
            description="Os dados de uso do plano ainda não estão disponíveis para este usuário."
          />
        ) : (
          usageSeries.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.used.toLocaleString('pt-BR')} / {item.quota.toLocaleString('pt-BR')}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round(item.percentage)}%
                </span>
              </div>
              <Progress value={item.percentage} className="h-2.5 bg-primary/10" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
