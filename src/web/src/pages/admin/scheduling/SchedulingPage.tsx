import { useState } from "react";
import { useSchedulingMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function SchedulingPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useSchedulingMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Agendamento" subtitle="Recorrências e reservas">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={3}>
            <KpiCard title="Recorrências ativas" value={m.activeRecurrences ?? 0} />
            <KpiCard title="Ocorrências criadas" value={m.totalOccurrencesCreated ?? 0} />
            <KpiCard title="Runs no período" value={Object.values(m.runsByStatus ?? {}).reduce((a: number, b: any) => a + b, 0) as number} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Recorrências por status</h3>
              {m.recurrencesByStatus && Object.entries(m.recurrencesByStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Runs por status</h3>
              {m.runsByStatus && Object.entries(m.runsByStatus).map(([k, v]) => (
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
