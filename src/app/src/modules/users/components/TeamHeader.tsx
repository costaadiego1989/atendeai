import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TeamHeaderProps {
  onNewMember: () => void;
}

export function TeamHeader({ onNewMember }: TeamHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Equipe</h1>
        <p className="page-description mt-1">
          Convide administradores e agentes. A senha provisória é enviada por e-mail e a troca ocorre no primeiro login.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5 w-fit" onClick={onNewMember}>
          <Plus className="h-4 w-4" /> Novo membro
        </Button>
      </div>
    </div>
  );
}
