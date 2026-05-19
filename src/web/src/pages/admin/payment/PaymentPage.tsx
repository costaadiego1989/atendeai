import { useState } from "react";
import { usePaymentMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";

export default function PaymentPage() {
  const [period, setPeriod] = useState("30d");
  const { data } = usePaymentMetrics({ period });
  const m = data as any;

  return (
    <div>
      <PageHeader title="Pagamentos" subtitle="Contas financeiras e webhooks">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Contas financeiras" value={m.totalAccounts ?? 0} />
            <KpiCard title="Sem conta" value={m.tenantsWithoutAccount ?? 0} subtitle="tenants ativos" />
            <KpiCard title="Webhooks recebidos" value={m.webhooksReceived ?? 0} />
            <KpiCard title="Status contas" value={Object.keys(m.accountsByStatus ?? {}).length} subtitle="tipos" />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Webhooks por status</h3>
              {m.webhooksByStatus && Object.entries(m.webhooksByStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Contas por status</h3>
              {m.accountsByStatus && Object.entries(m.accountsByStatus).map(([k, v]) => (
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
