import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { dashboardStageLabels } from '@/modules/dashboard/components/dashboard-labels';
import { EmptyState } from '@/shared/ui/EmptyState';

const chartConfig = {
  total: { label: 'Contatos', color: '#7ab4ca' },
};

export function DashboardPipelineChart({
  data,
}: {
  data: Array<{ stage: string; total: number }>;
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: dashboardStageLabels[item.stage] ?? item.stage,
  }));

  const isEmpty = data.length === 0 || data.every((item) => item.total === 0);

  return (
    <Card className="glass-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Pipeline do CRM</CardTitle>
        <p className="text-sm text-muted-foreground">
          Distribuição atual dos contatos por etapa comercial.
        </p>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="py-8">
            <EmptyState
              icon={Users}
              title="Sem contatos no pipeline"
              description="A distribuição por etapa aparecerá conforme seus contatos forem classificados."
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={92}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
