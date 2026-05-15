import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquareText, Settings2 } from 'lucide-react';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';

interface CheckoutHeaderProps {
  onOpenShippingPolicy: () => void;
  onOpenAbandonmentConfig: () => void;
}

export const CheckoutHeader: React.FC<CheckoutHeaderProps> = ({
  onOpenShippingPolicy,
  onOpenAbandonmentConfig,
}) => {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Checkout e Pedidos</h1>
        <p className="page-description text-muted-foreground">
          Acompanhe os pedidos conversacionais, os links enviados e a conversão em receita em tempo real.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ModuleAgentRuleButton
          moduleId="checkout"
          buttonSize="sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2 whitespace-nowrap"
          onClick={onOpenAbandonmentConfig}
        >
          <MessageSquareText className="h-4 w-4" />
          Carrinho Abandonado
        </Button>
        <Button
          size="sm"
          className="gap-2 whitespace-nowrap"
          onClick={onOpenShippingPolicy}
        >
          <Settings2 className="h-4 w-4" />
          Config. Entrega
        </Button>
      </div>
    </div>
  );
};
