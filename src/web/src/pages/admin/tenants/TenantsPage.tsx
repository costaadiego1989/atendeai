import { useState } from "react";
import { useTenantsMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function TenantsPage() {
  const [period, setPeriod] = useState("30d");
  const { data, isLoading } = useTenantsMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Tenants" subtitle="Crescimento e distribuição de tenants">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Total ativos" value={m.totalActive ?? 0} />
            <KpiCard title="Novos no período" value={m.newInPeriod ?? 0} />
            <KpiCard title="Em trial" value={m.inTrial ?? 0} />
            <KpiCard title="Churn" value={m.churned ?? 0} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Distribution by plan */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por plano</h3>
              {m.byPlan && Object.entries(m.byPlan).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>

            {/* Top tenants */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Top tenants (por uso)</h3>
              {m.topTenants?.map((t: any, i: number) => (
                <div key={t.tenantId} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{i + 1}. {t.companyName}</span>
                  <span className="text-sm font-medium">{t.score ?? t.messagesUsed ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel */}
          {m.funnel && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Funil</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(m.funnel).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400">{k}</p>
                    <p className="text-xl font-bold">{v as number}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
