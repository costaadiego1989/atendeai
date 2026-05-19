import { useCatalogMetrics } from "@/services/platformApi";
import { KpiCard, MetricsGrid, PageHeader } from "@/components/admin";

export default function CatalogPage() {
  const { data } = useCatalogMetrics({});
  const m = data as any;

  return (
    <div>
      <PageHeader title="Catálogo" subtitle="Itens e categorias" />

      {m && (
        <>
          <MetricsGrid columns={4}>
            <KpiCard title="Total itens" value={m.totalItems ?? 0} />
            <KpiCard title="Ativos" value={m.activeItems ?? 0} />
            <KpiCard title="Inativos" value={m.inactiveItems ?? 0} />
            <KpiCard title="Categorias" value={m.totalCategories ?? 0} />
          </MetricsGrid>

          <MetricsGrid columns={3}>
            <KpiCard title="Com imagem" value={m.itemsWithImage ?? 0} />
            <KpiCard title="Sem preço" value={m.itemsWithoutPrice ?? 0} />
            <KpiCard title="Tipos" value={Object.keys(m.itemsByType ?? {}).length} />
          </MetricsGrid>

          {m.itemsByType && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Por tipo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(m.itemsByType).map(([k, v]) => (
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
