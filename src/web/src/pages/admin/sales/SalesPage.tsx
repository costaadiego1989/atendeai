import { useState } from "react";
import { useSalesMetrics, useSalesPaymentLinks } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector, Pagination } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function SalesPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: metrics, isLoading: loadingMetrics } = useSalesMetrics({ period });
  const { data: links, isLoading: loadingLinks } = useSalesPaymentLinks({ page, limit, period });

  const m = metrics as any;
  const l = links as any;

  return (
    <div>
      <PageHeader title="Vendas" subtitle="GMV, conversão e links de pagamento">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {loadingMetrics ? (
        <p className="text-gray-500">Carregando...</p>
      ) : m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="GMV Total" value={formatCurrency(m.gmvTotal ?? 0)} />
            <KpiCard title="Intenções" value={m.purchaseIntents ?? 0} />
            <KpiCard title="Links gerados" value={m.paymentLinksGenerated ?? 0} />
            <KpiCard title="Conversão" value={`${m.conversionRate ?? 0}%`} />
          </MetricsGrid>

          {/* Daily revenue chart */}
          {m.dailyRevenue?.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-4">Receita diária</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={m.dailyRevenue}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Payment links table */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Links de pagamento</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contato</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
            </tr>
          </thead>
          <tbody>
            {loadingLinks ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando...</td></tr>
            ) : !l?.items?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum link</td></tr>
            ) : (
              l.items.map((link: any) => (
                <tr key={link.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{link.name}</td>
                  <td className="px-4 py-3 text-gray-600">{link.companyName}</td>
                  <td className="px-4 py-3 text-gray-600">{link.contactName || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={link.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {link.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(link.value ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(link.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={l?.totalPages ?? 0} onPageChange={setPage} />
    </div>
  );
}
