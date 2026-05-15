import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentLinksHeaderProps {
  onNewLink: () => void;
  isAccountConfigured: boolean;
}

export function PaymentLinksHeader({ onNewLink, isAccountConfigured }: PaymentLinksHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Cobranças</h1>
        <p className="page-description mt-1">
          Crie cobranças com split para a empresa, envie pelo WhatsApp e acompanhe o status do checkout como parte da operação financeira.
        </p>
      </div>
      <Button size="sm" className="gap-2 w-fit" onClick={onNewLink}>
        <Plus className="h-4 w-4" />
        {isAccountConfigured ? 'Nova cobrança' : 'Habilitar recebimentos'}
      </Button>
    </div>
  );
}
