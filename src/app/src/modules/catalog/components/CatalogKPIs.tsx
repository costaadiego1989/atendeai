import { Boxes, FolderKanban, Package, Tag } from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';

interface CatalogKPIsProps {
  activeItemsCount: number;
  categoriesCount: number;
  servicesCount: number;
  productsCount: number;
}

export function CatalogKPIs({
  activeItemsCount,
  categoriesCount,
  servicesCount,
  productsCount,
}: CatalogKPIsProps) {
  return (
    <div className="card-grid">
      <KPICard
        title="Itens ativos"
        value={activeItemsCount}
        subtitle="Ofertas prontas para a operação"
        icon={Package}
      />
      <KPICard
        title="Categorias"
        value={categoriesCount}
        subtitle="Estrutura base do catálogo"
        icon={FolderKanban}
      />
      <KPICard
        title="Serviços"
        value={servicesCount}
        subtitle="Itens usados por agenda e IA"
        icon={Tag}
      />
      <KPICard
        title="Produtos"
        value={productsCount}
        subtitle="Itens prontos para estoque e venda"
        icon={Boxes}
      />
    </div>
  );
}
