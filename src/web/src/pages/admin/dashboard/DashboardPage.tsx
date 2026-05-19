import { useState } from "react";
import { useDashboardOverview } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader, PeriodSelector } from "@/components/admin";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const { data, isLoading } = useDashboardOverview({ period });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando dashboard...</p>
      </div>
    );
  }

  const d = data as any;
  if (!d) return null;

  const planData = d.revenue?.byPlan
    ? Object.entries(d.revenue.byPlan).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão executiva da plataforma">
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {/* Tenants KPIs */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Tenants</h2>
      <MetricsGrid columns={4}>
        <KpiCard title="Ativos" value={d.tenants?.totalActive ?? 0} />
        <KpiCard title="Novos no período" value={d.tenants?.newInPeriod ?? 0} />
        <KpiCard title="Em trial" value={d.tenants?.inTrial ?? 0} />
        <KpiCard title="Churn" value={d.tenants?.churned ?? 0} />
      </MetricsGrid>

      {/* Revenue KPIs */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Receita</h2>
      <MetricsGrid columns={3}>
        <KpiCard title="MRR" value={formatCurrency(d.revenue?.mrr ?? 0)} />
        <KpiCard title="ARR" value={formatCurrency(d.revenue?.arr ?? 0)} />
        <KpiCard
          title="ARPU"
          value={formatCurrency(
            d.tenants?.totalActive > 0 ? d.revenue?.mrr / d.tenants.totalActive : 0
          )}
        />
      </MetricsGrid>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* MRR by Plan */}
        {planData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-4">MRR por Plano</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {planData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Operations */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Operações</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Mensagens</p>
              <p className="text-xl font-bold">{(d.operations?.totalMessages ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Tokens AI</p>
              <p className="text-xl font-bold">{(d.operations?.totalAiTokens ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Conversas ativas</p>
              <p className="text-xl font-bold">{d.operations?.activeConversations ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Contatos usados</p>
              <p className="text-xl font-bold">{(d.operations?.totalContacts ?? 0).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales & Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Vendas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Receita total</p>
              <p className="text-xl font-bold">{formatCurrency(d.sales?.totalRevenue ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Intenções de compra</p>
              <p className="text-xl font-bold">{d.sales?.purchaseIntents ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Links gerados</p>
              <p className="text-xl font-bold">{d.sales?.paymentLinksGenerated ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Taxa conversão</p>
              <p className="text-xl font-bold">{d.sales?.conversionRate ?? 0}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Suporte</h3>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-400">Tickets abertos</p>
              <p className="text-3xl font-bold text-amber-600">{d.support?.openTickets ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
