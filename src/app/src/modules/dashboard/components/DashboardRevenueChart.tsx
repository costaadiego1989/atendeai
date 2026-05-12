import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RevenueChartCard } from '@/shared/ui/metrics/RevenueChartCard';

export function DashboardRevenueChart({
  data,
  onExportCsv,
}: {
  data: Array<{ date: string; receita: number; intents: number; links: number }>;
  onExportCsv?: () => void;
}) {
  return (
    <div className="relative">
      <RevenueChartCard
        data={data}
        description="Receita estimada, intenções e checkouts gerados no período selecionado."
      />
      {onExportCsv && data.length > 0 ? (
        <div className="absolute right-5 top-5">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onExportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      ) : null}
    </div>
  );
}
