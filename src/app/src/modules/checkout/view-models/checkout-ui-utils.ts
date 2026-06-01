import {
  getPaymentStatusClassName,
  getPaymentStatusLabel,
} from '@/shared/payment/payment-ui';

export function getOrderTone(status: string) {
  switch (status) {
    case 'PAID':
      return 'bg-success/10 text-success border-success/20';
    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'AWAITING_PAYMENT':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-primary/10 text-primary border-primary/20';
  }
}

export function getOrderLabel(status: string) {
  const labels: Record<string, string> = {
    AWAITING_PAYMENT: 'Aguardando Pagamento',
    PAID: 'Pedido Pago',
    PREPARING: 'Em Preparação',
    READY_FOR_PICKUP: 'Pronto para Retirada',
    OUT_FOR_DELIVERY: 'Em Rota de Entrega',
    DELIVERED: 'Pedido Entregue',
    CANCELLED: 'Cancelado',
  };
  return labels[status] || status;
}

export function getPaymentTone(status?: string | null) {
  return getPaymentStatusClassName(status);
}

export function getPaymentLabel(status?: string | null) {
  return status === 'PAID' ? 'Confirmado' : getPaymentStatusLabel(status, 'Pendente');
}

export function getShippingLabel(mode?: string | null) {
  return mode === 'PER_KM' ? 'Frete por KM' : mode === 'FIXED' ? 'Taxa Fixa' : 'Retirada Local';
}

export function getFulfillmentLabel(type?: string | null) {
  return type === 'DELIVERY' ? 'Entrega em Casa' : 'Retirada Presencial';
}

export function getWeekdayLabel(value: string) {
  const labels: Record<string, string> = {
    MONDAY: 'Segunda',
    TUESDAY: 'Terça',
    WEDNESDAY: 'Quarta',
    THURSDAY: 'Quinta',
    FRIDAY: 'Sexta',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
  };
  return labels[value] || value;
}

export function getCheckoutStageLabel(step?: string | null) {
  const labels: Record<string, string> = {
    IDENTIFYING_NEED: 'Qualificação',
    SELECTING_ITEM: 'Escolha de Itens',
    AWAITING_QUANTITY: 'Definição de Qtd',
    ASKING_MORE_ITEMS: 'Adicionais',
    AWAITING_FULFILLMENT: 'Logística',
    AWAITING_DELIVERY_ADDRESS: 'Endereço',
    AWAITING_FREIGHT_REVIEW: 'Cálculo Frete',
    AWAITING_ORDER_NOTE: 'Detalhes Finais',
    READY_FOR_CHECKOUT: 'Pronto para Faturar',
    AWAITING_PAYMENT: 'Pagamento',
    PAID: 'Venda Concluída',
    CANCELLED: 'Abandono/Cancelado',
  };
  return labels[step || ''] || 'Em Negociação';
}

export function getCheckoutStageOrder(step?: string | null): number {
  const stages: Record<string, number> = {
    IDENTIFYING_NEED: 1,
    SELECTING_ITEM: 1,
    AWAITING_QUANTITY: 1,
    ASKING_MORE_ITEMS: 1,
    AWAITING_FULFILLMENT: 2,
    AWAITING_DELIVERY_ADDRESS: 2,
    AWAITING_FREIGHT_REVIEW: 2,
    AWAITING_ORDER_NOTE: 3,
    READY_FOR_CHECKOUT: 4,
    AWAITING_PAYMENT: 4,
    PAID: 5,
  };
  return stages[step || ''] || 1;
}
