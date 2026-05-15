import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  onNewProposal: () => void;
};

export function ProposalsHeader({ onNewProposal }: Props) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">
          Propostas
        </h1>
        <p className="page-description mt-1 max-w-3xl">
          Crie, revise e agende propostas comerciais com o mesmo padrão visual das demais telas.
          A geração do PDF acontece na API e o envio segue pela fila quando o horário é definido.
        </p>
      </div>

      <Button size="sm" className="gap-2 w-fit" onClick={onNewProposal}>
        <Plus className="h-4 w-4" />
        Nova proposta
      </Button>
    </div>
  );
}
