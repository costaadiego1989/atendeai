import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactsHeaderProps {
  onNewContact: () => void;
  onOpenImport: () => void;
}

export function ContactsHeader({
  onNewContact,
  onOpenImport,
}: ContactsHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="page-title">Contatos</h1>
        <p className="page-description max-w-3xl">
          Centralize a base do CRM, organize listas para atendimento e acompanhe importações
          e exportações sem travar a operação.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenImport}>
          <Upload className="h-4 w-4" />
          Importar lista
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onNewContact}>
          <Plus className="h-4 w-4" />
          Novo contato
        </Button>
      </div>
    </div>
  );
}
