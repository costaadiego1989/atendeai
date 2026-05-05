import { Siren } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Pie, PieChart } from 'recharts';
import { dashboardRecoveryLabels } from '@/modules/dashboard/components/dashboard-labels';
import { EmptyState } from '@/shared/ui/EmptyState';

const COLORS = ['#176f84', '#5aa6c4', '#8ed0a7', '#f0b24b', '#aab8c5', '#1f9d69'];

const chartConfig = {
  READY_TO_CONTACT: { label: 'Pronto para contato', color: COLORS[0] },
  CONTACTED: { label: 'Contato feito', color: COLORS[1] },
  NEGOTIATING: { label: 'Negociando', color: COLORS[2] },
  PROMISE_TO_PAY: { label: 'Promessa', color: COLORS[3] },
  NO_RESPONSE: { label: 'Sem resposta', color: COLORS[4] },
  PAID: { label: 'Pago', color: COLORS[5] },
};

export function DashboardRecoveryChart({
  data,
}: {
  data: Array<{ status: string; total: number }>;
}) {
  const chartData = data.map((item) => ({
    ...item,
    name: dashboardRecoveryLabels[item.status] ?? item.status,
    fill:
      chartConfig[item.status as keyof typeof chartConfig]?.color ??
      COLORS[0],
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Carteira de cobrança</CardTitle>
        <p className="text-sm text-muted-foreground">
          Leitura rapida das etapas da carteira de recuperação.
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Siren}
              title="Carteira limpa"
              description="Nenhum caso em cobrança ou recuperação ativa no momento."
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="status"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={3}
              />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
