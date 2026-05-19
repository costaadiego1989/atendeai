import { useState } from "react";
import { useContactsMetrics, useContactsList } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector, Pagination } from "@/components/admin";
import { Badge } from "@/components/ui/badge";

export default function ContactsPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: metrics } = useContactsMetrics({ period });
  const { data: contacts } = useContactsList({ page, limit });

  const m = metrics as any;
  const c = contacts as any;

  return (
    <div>
      <PageHeader title="Contatos" subtitle="Base de contatos cross-tenant">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Total" value={(m.totalContacts ?? 0).toLocaleString("pt-BR")} />
            <KpiCard title="Novos no período" value={m.newInPeriod ?? 0} />
            <KpiCard title="Opt-out prospecção" value={m.prospectingOptOut ?? 0} />
            <KpiCard title="Inativos >30d" value={m.inactiveOver30d ?? 0} />
          </MetricsGrid>

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Por estágio</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {m.byStage && Object.entries(m.byStage).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400">{k}</p>
                  <p className="text-xl font-bold">{v as number}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Contatos</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estágio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {!c?.items?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum contato</td></tr>
            ) : (
              c.items.map((ct: any) => (
                <tr key={ct.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ct.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ct.companyName}</td>
                  <td className="px-4 py-3 text-gray-600">{ct.phone}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{ct.stage}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(ct.createdAt).toLocaleDateString("pt-BR")}</td>
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
