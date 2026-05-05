import type { RecoveryBillingType } from '@/modules/recovery/services/RecoveryService';
import type { RecoverySource, RecoveryStatus } from '@/shared/types';

export const recoveryStatusLabels: Record<RecoveryStatus, string> = {
  READY_TO_CONTACT: 'Pronto para contato',
  CONTACTED: 'Contato feito',
  NEGOTIATING: 'Negociando',
  PROMISE_TO_PAY: 'Promessa de pagamento',
  PAID: 'Pago',
  NO_RESPONSE: 'Sem resposta',
  INVALID_CONTACT: 'Contato inválido',
  STOPPED: 'Parado',
};

export const recoverySourceLabels: Record<RecoverySource, string> = {
  CRM: 'CRM',
  MANUAL: 'Manual',
  IMPORT: 'Importado',
};

export const recoveryChargeTypeLabels: Record<string, string> = {
  MONTHLY_FEE: 'Mensalidade',
  SERVICE_INVOICE: 'Fatura de serviço',
  RENTAL: 'Locação',
  PRODUCT_ORDER: 'Pedido',
  CONSULTATION: 'Consulta',
  INSTALLMENT: 'Parcela',
  MENTORSHIP: 'Mentoria',
  OTHER: 'Outros',
};

export const recoveryBillingTypeLabels: Record<RecoveryBillingType, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  UNDEFINED: 'Checkout flexível',
};
