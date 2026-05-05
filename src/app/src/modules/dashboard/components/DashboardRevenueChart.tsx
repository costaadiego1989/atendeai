import { RevenueChartCard } from '@/shared/ui/metrics/RevenueChartCard';

export function DashboardRevenueChart({
  data,
}: {
  data: Array<{ date: string; receita: number; intents: number; links: number }>;
}) {
  return (
    <RevenueChartCard
      data={data}
      description="Receita estimada, intenções e checkouts gerados no período selecionado."
    />
  );
}
