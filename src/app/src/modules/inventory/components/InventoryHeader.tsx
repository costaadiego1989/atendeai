import { Button } from '@/components/ui/button';
import { PlugZap, Plus } from 'lucide-react';

interface InventoryHeaderProps {
  onNewConnection: () => void;
  onNewSnapshot: () => void;
}

export function InventoryHeader({
  onNewConnection,
  onNewSnapshot,
}: InventoryHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Estoque</h1>
        <p className="page-description">
          Controle snapshots, disponibilidade e conexoes operacionais com dados reais.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewConnection}>
          <PlugZap className="h-4 w-4" />
          Integrações
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onNewSnapshot}>
          <Plus className="h-4 w-4" />
          Novo snapshot
        </Button>
      </div>
    </div>
  );
}
