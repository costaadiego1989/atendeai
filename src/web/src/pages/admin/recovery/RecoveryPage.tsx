import { useState } from "react";
import { useRecoveryMetrics, useRecoveryCases } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector, Pagination } from "@/components/admin";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function RecoveryPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: metrics } = useRecoveryMetrics({ period });
  const { data: cases } = useRecoveryCases({ page, limit });

  const m = metrics as any;
  const c = cases as any;

  return (
    <div>
      <PageHeader title="Cobrança" subtitle="Recuperação de inadimplentes">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Casos ativos" value={m.totalActiveCases ?? 0} />
            <KpiCard title="Valor em aberto" value={formatCurrency(m.totalAmountDue ?? 0)} />
            <KpiCard title="Recuperado" value={formatCurrency(m.recoveredValue ?? 0)} />
            <KpiCard title="Taxa recuperação" value={`${m.recoveryRate ?? 0}%`} />
          </MetricsGrid>
          <MetricsGrid columns={2}>
            <KpiCard title="Sem contato >7d" value={m.casesWithoutContact7d ?? 0} />
            <KpiCard title="Total no período" value={Object.values(m.casesByStatus ?? {}).reduce((a: number, b: any) => a + b, 0) as number} />
          </MetricsGrid>
        </>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Casos</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Devedor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {!c?.items?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum caso</td></tr>
            ) : (
              c.items.map((rc: any) => (
                <tr key={rc.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rc.debtorName}</td>
                  <td className="px-4 py-3 text-gray-600">{rc.companyName}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{rc.status}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium">{rc.amountDue ? formatCurrency(rc.amountDue) : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{rc.dueDate ? new Date(rc.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={c?.totalPages ?? 0} onPageChange={setPage} />
    </div>
  );
}
