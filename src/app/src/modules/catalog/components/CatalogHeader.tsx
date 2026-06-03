import { Download, FolderKanban, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CatalogHeaderProps {
  onNewCategory: () => void;
  onNewItem: () => void;
  onOpenImport: () => void;
  onOpenReports: () => void;
}

export function CatalogHeader({
  onNewCategory,
  onNewItem,
  onOpenImport,
  onOpenReports,
}: CatalogHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Catálogo</h1>
        <p className="page-description">
          Cadastre produtos, serviços e locações do seu negócio para gerar contexto para IA.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenImport}>
          <Upload className="h-4 w-4" />
          Importar lista
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenReports}>
          <Download className="h-4 w-4" />
          Relatórios
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewCategory}>
          <FolderKanban className="h-4 w-4" />
          Nova categoria
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onNewItem}>
          <Plus className="h-4 w-4" />
          Novo item
        </Button>
      </div>
    </div>
  );
}
