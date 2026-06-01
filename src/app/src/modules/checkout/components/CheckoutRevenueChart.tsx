import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/shared/ui/EmptyState';
import type { DailyRevenuePoint } from '@/modules/checkout/view-models/useCheckoutAnalyticsViewModel';

const chartConfig = {
  revenue: { label: 'Receita', color: 'hsl(var(--primary))' },
};

function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

interface CheckoutRevenueChartProps {
  data: DailyRevenuePoint[];
}

export const CheckoutRevenueChart: React.FC<CheckoutRevenueChartProps> = ({ data }) => {
  return (
    <Card className="glass-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold">Receita diária</CardTitle>
        <p className="text-sm text-muted-foreground">
          Faturamento de pedidos pagos e entregues ao longo do período selecionado.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={BarChart3}
              title="Sem receita no período"
              description="Assim que houver pedidos pagos, a evolução diária aparecerá aqui."
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={data} margin={{ left: 4, right: 8, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatChartCurrency(Number(value))}
                width={84}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatChartCurrency(Number(value))}
                  />
                }
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[10, 10, 4, 4]}
                maxBarSize={48}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
