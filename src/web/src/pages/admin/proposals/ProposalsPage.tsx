import { useState } from "react";
import { useProposalMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ProposalsPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = useProposalMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Propostas" subtitle="Propostas comerciais">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Criadas" value={m.totalCreated ?? 0} />
            <KpiCard title="Valor ativo" value={formatCurrency(m.totalValueActive ?? 0)} />
            <KpiCard title="Valor médio" value={formatCurrency(m.averageValue ?? 0)} />
            <KpiCard title="Conversão" value={`${m.conversionRate ?? 0}%`} />
          </MetricsGrid>

          {m.proposalsByStatus && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(m.proposalsByStatus).map(([k, v]) => (
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
