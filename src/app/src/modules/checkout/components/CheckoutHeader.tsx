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
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight">Checkout e Pedidos</h1>
        <p className="page-description text-muted-foreground">
          Acompanhe os pedidos conversacionais, os links enviados e a conversão em receita em tempo real.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ModuleAgentRuleButton
          moduleId="checkout"
          buttonSize="default"
          className="h-11 rounded-xl px-5"
        />
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-xl px-5"
          onClick={onOpenAbandonmentConfig}
        >
          <MessageSquareText className="h-4 w-4" />
          Carrinho Abandonado
        </Button>
        <Button
          className="h-11 gap-2 rounded-xl px-5"
          onClick={onOpenShippingPolicy}
        >
          <Settings2 className="h-4 w-4" />
          Configurações de Entrega
        </Button>
      </div>
    </div>
  );
};
