import { useState } from "react";
import { useAuthMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function AuthPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useAuthMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Auth" subtitle="Eventos de autenticação">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Total eventos" value={(m.totalEvents ?? 0).toLocaleString("pt-BR")} />
            <KpiCard title="Usuários únicos" value={m.uniqueUsers ?? 0} />
            <KpiCard title="Logins falhos" value={m.failedLogins ?? 0} />
            <KpiCard title="Tipos de evento" value={Object.keys(m.eventsByType ?? {}).length} />
          </MetricsGrid>

          {m.eventsByType && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Eventos por tipo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(m.eventsByType).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1">
                    <span className="text-xs text-gray-700">{k}</span>
                    <span className="text-xs font-medium">{v as number}</span>
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
