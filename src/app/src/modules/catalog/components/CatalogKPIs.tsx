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
    <div className="card-grid mb-6">
      <KPICard
        title="Itens ativos"
        value={activeItemsCount}
        subtitle="Ofertas prontas para a operação"
        icon={Package}
      />
      <KPICard
        title="Categorias"
        value={categoriesCount}
        subtitle="Estrutura base do catalogo"
        icon={FolderKanban}
      />
      <KPICard
        title="serviços"
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
