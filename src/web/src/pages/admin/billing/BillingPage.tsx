import { useState } from "react";
import { useBillingMetrics, useBillingSubscriptions } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector, Pagination } from "@/components/admin";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function BillingPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: metrics, isLoading: loadingMetrics } = useBillingMetrics({ period });
  const { data: subs, isLoading: loadingSubs } = useBillingSubscriptions({ page, limit, period });

  const m = metrics as any;
  const s = subs as any;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Receita, assinaturas e uso">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {loadingMetrics ? (
        <p className="text-gray-500">Carregando...</p>
      ) : m && (
        <>
          <MetricsGrid columns={5}>
            <KpiCard title="MRR" value={formatCurrency(m.mrr ?? 0)} />
            <KpiCard title="ARR" value={formatCurrency(m.arr ?? 0)} />
            <KpiCard title="ARPU" value={formatCurrency(m.arpu ?? 0)} />
            <KpiCard title="Churn Rate" value={`${m.churnRate ?? 0}%`} />
            <KpiCard title="Addons" value={formatCurrency(m.addonsRevenue ?? 0)} />
          </MetricsGrid>

          <MetricsGrid columns={4}>
            <KpiCard title="Upgrades" value={m.upgrades ?? 0} />
            <KpiCard title="Downgrades" value={m.downgrades ?? 0} />
            <KpiCard title="Cancelamentos" value={m.cancellations ?? 0} />
            <KpiCard title="Acima 90% quota" value={m.tenantsAbove90Quota ?? 0} subtitle="tenants" />
          </MetricsGrid>
        </>
      )}

      {/* Subscriptions table */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Assinaturas</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Plano</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ciclo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor/mês</th>
            </tr>
          </thead>
          <tbody>
            {loadingSubs ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Carregando...</td></tr>
            ) : !s?.items?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhuma assinatura</td></tr>
            ) : (
              s.items.map((sub: any) => (
                <tr key={sub.tenantId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.companyName}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{sub.plan}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge className={sub.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {sub.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{sub.billingCycleType}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(sub.totalMonthlyPrice ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={s?.totalPages ?? 0} onPageChange={setPage} />
    </div>
  );
}
