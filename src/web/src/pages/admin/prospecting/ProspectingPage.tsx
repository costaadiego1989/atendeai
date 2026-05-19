import { useState } from "react";
import { useProspectingMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function ProspectingPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useProspectingMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Prospecção" subtitle="Campanhas, execuções e leads">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Campanhas ativas" value={m.activeCampaigns ?? 0} />
            <KpiCard title="Execuções" value={m.totalExecutions ?? 0} />
            <KpiCard title="Taxa stop" value={`${m.stopRate ?? 0}%`} />
            <KpiCard title="Google Ads" value={m.googleAdsConnections ?? 0} subtitle="conexões" />
          </MetricsGrid>

          <MetricsGrid columns={3}>
            <KpiCard title="Leads capturados" value={m.leadsCaptures ?? 0} />
            <KpiCard title="Leads importados" value={m.leadsImported ?? 0} />
            <KpiCard title="Resultados busca" value={m.searchResults ?? 0} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Campanhas por status</h3>
              {m.campaignsByStatus && Object.entries(m.campaignsByStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Execuções por status</h3>
              {m.executionsByStatus && Object.entries(m.executionsByStatus).map(([k, v]) => (
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
