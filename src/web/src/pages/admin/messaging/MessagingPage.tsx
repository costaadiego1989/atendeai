import { useState } from "react";
import { useMessagingMetrics, useMessagingConversations } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector, Pagination } from "@/components/admin";
import { Badge } from "@/components/ui/badge";

export default function MessagingPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: metrics, isLoading: loadingMetrics } = useMessagingMetrics({ period });
  const { data: convs, isLoading: loadingConvs } = useMessagingConversations({ page, limit, period });

  const m = metrics as any;
  const c = convs as any;

  return (
    <div>
      <PageHeader title="Messaging" subtitle="Conversas e mensagens cross-tenant">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {loadingMetrics ? (
        <p className="text-gray-500">Carregando...</p>
      ) : m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Conversas ativas" value={m.totalActiveConversations ?? 0} />
            <KpiCard title="Msgs enviadas" value={(m.totalMessagesSent ?? 0).toLocaleString("pt-BR")} />
            <KpiCard title="Msgs recebidas" value={(m.totalMessagesReceived ?? 0).toLocaleString("pt-BR")} />
            <KpiCard title="Sem resposta >1h" value={m.unansweredOver1h ?? 0} />
          </MetricsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por canal</h3>
              {m.conversationsByChannel && Object.entries(m.conversationsByChannel).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por remetente</h3>
              {m.messagesBySentBy && Object.entries(m.messagesBySentBy).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">{k}</span>
                  <span className="text-sm font-medium">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Conversations table */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Conversas</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contato</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Canal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Última msg</th>
            </tr>
          </thead>
          <tbody>
            {loadingConvs ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Carregando...</td></tr>
            ) : !c?.items?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhuma conversa</td></tr>
            ) : (
              c.items.map((conv: any) => (
                <tr key={conv.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{conv.contactName}</td>
                  <td className="px-4 py-3 text-gray-600">{conv.companyName}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{conv.channel}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge className={conv.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {conv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{conv.lastMessagePreview}</td>
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
