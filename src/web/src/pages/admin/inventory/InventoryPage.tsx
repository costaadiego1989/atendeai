import { useInventoryMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader } from "@/components/admin";

export default function InventoryPage() {
  const { data } = useInventoryMetrics({});
  const m = data as any;

  return (
    <div>
      <PageHeader title="Estoque" subtitle="Itens e conexões de sync" />

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Total SKUs" value={m.totalItems ?? 0} />
            <KpiCard title="Sem estoque" value={m.itemsOutOfStock ?? 0} />
            <KpiCard title="Indisponíveis" value={m.itemsUnavailable ?? 0} />
            <KpiCard title="Conexões ativas" value={m.activeConnections ?? 0} />
          </MetricsGrid>

          <MetricsGrid columns={2}>
            <KpiCard title="Sync atrasado >24h" value={m.connectionsSyncOver24h ?? 0} subtitle="conexões" />
            <KpiCard title="Top tenants" value={m.topTenantsBySkus?.length ?? 0} subtitle="com mais SKUs" />
          </MetricsGrid>
        </>
      )}
    </div>
  );
}
