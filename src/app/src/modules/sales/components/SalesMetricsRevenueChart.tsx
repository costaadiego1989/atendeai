import { RevenueChartCard } from '@/shared/ui/metrics/RevenueChartCard';

export function SalesMetricsRevenueChart({
  data,
}: {
  data: Array<{ date: string; receita: number; intents: number; links: number }>;
}) {
  return (
    <RevenueChartCard
      data={data}
      description="Receita prevista, intenções detectadas e checkouts emitidos no período."
    />
  );
}
