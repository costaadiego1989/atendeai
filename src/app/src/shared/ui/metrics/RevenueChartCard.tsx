import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';

const chartConfig = {
  receita: { label: 'Receita estimada', color: 'hsl(var(--primary))' },
  intents: { label: 'Intenções', color: '#5aa6c4' },
  links: { label: 'Checkouts', color: '#9ec5d4' },
};

function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export interface RevenueChartDatum {
  date: string;
  receita: number;
  intents: number;
  links: number;
}

export interface RevenueChartCardProps {
  data: RevenueChartDatum[];
  description: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function RevenueChartCard({
  data,
  description,
  emptyTitle = 'Sem métricas comerciais',
  emptyDescription = 'Ainda não há métricas suficientes para exibir o gráfico de ritmo comercial.',
  className,
}: RevenueChartCardProps) {
  return (
    <Card className={['glass-card', className].filter(Boolean).join(' ')}>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Ritmo comercial</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={BarChart3}
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <ComposedChart data={data} margin={{ left: 4, right: 8, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="revenue"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatChartCurrency(Number(value))}
                width={84}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === 'Receita estimada')
                        return formatChartCurrency(Number(value));
                      return Number(value).toLocaleString('pt-BR');
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                yAxisId="revenue"
                dataKey="receita"
                fill="var(--color-receita)"
                radius={[10, 10, 4, 4]}
                maxBarSize={36}
              />
              <Line
                yAxisId="volume"
                type="monotone"
                dataKey="intents"
                stroke="var(--color-intents)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                yAxisId="volume"
                type="monotone"
                dataKey="links"
                stroke="var(--color-links)"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

