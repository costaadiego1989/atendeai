import { useState } from "react";
import { useSocialMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function SocialPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useSocialMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Social" subtitle="Contas e comentários">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={3}>
            <KpiCard title="Contas conectadas" value={m.totalAccounts ?? 0} />
            <KpiCard title="Comentários recebidos" value={m.commentsReceived ?? 0} />
            <KpiCard title="Pendentes resposta" value={m.commentsByStatus?.PENDING ?? 0} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por plataforma</h3>
              {m.accountsByPlatform && Object.entries(m.accountsByPlatform).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Sentimento</h3>
              {m.commentsBySentiment && Object.entries(m.commentsBySentiment).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Status comentários</h3>
              {m.commentsByStatus && Object.entries(m.commentsByStatus).map(([k, v]) => (
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
