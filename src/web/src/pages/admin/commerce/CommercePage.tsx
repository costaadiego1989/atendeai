import { useState } from "react";
import { useCommerceMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function CommercePage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useCommerceMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Commerce" subtitle="Sessões, checkouts e pedidos">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Sessões iniciadas" value={m.sessionsStarted ?? 0} />
            <KpiCard title="Checkouts" value={m.checkoutsCreated ?? 0} />
            <KpiCard title="Pedidos pagos" value={m.ordersPaid ?? 0} />
            <KpiCard title="Taxa abandono" value={`${m.abandonmentRate ?? 0}%`} />
          </MetricsGrid>

          <MetricsGrid columns={2}>
            <KpiCard title="Configs abandono ativas" value={m.abandonmentConfigsActive ?? 0} />
            <KpiCard title="Eventos no período" value={Object.values(m.eventsByType ?? {}).reduce((a: number, b: any) => a + b, 0) as number} />
          </MetricsGrid>

          {m.topTenantsByOrders?.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Top tenants (pedidos pagos)</h3>
              {m.topTenantsByOrders.map((t: any, i: number) => (
                <div key={t.tenantId} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{i + 1}. {t.companyName}</span>
                  <span className="text-sm font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
