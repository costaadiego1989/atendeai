import { useState } from "react";
import { useAIMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function AIPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useAIMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="AI" subtitle="Sessões, tokens e confiança">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Sessões" value={m.totalSessions ?? 0} />
            <KpiCard title="Tokens consumidos" value={(m.totalTokensConsumed ?? 0).toLocaleString("pt-BR")} />
            <KpiCard title="Confiança média" value={`${((m.averageConfidence ?? 0) * 100).toFixed(0)}%`} />
            <KpiCard title="Taxa handoff" value={`${m.handoffRate ?? 0}%`} />
          </MetricsGrid>

          <MetricsGrid columns={2}>
            <KpiCard title="Tenants sem AI config" value={m.tenantsWithoutAIConfig ?? 0} />
            <KpiCard title="Sessões baixa confiança" value={Math.round((m.handoffRate ?? 0) * (m.totalSessions ?? 0) / 100)} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por intent</h3>
              {m.sessionsByIntent && Object.entries(m.sessionsByIntent).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por sentimento</h3>
              {m.sessionsBySentiment && Object.entries(m.sessionsBySentiment).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
