export type PaymentTone =
  | 'active'
  | 'pending'
  | 'success'
  | 'warning'
  | 'info'
  | 'closed'
  | 'draft';

export const paymentToneClasses: Record<PaymentTone, string> = {
  active: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  pending: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  success: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  warning: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  info: 'bg-info/10 text-info border-info/20 hover:bg-info/10',
  closed: 'bg-muted text-muted-foreground border-border hover:bg-muted',
  draft: 'bg-secondary text-secondary-foreground border-border hover:bg-secondary',
};

const paymentStatusMeta: Record<
  string,
  { label: string; tone: PaymentTone }
> = {
  ACTIVE: { label: 'Ativo', tone: 'active' },
  PAUSED: { label: 'Pausado', tone: 'warning' },
  PENDING: { label: 'Pendente', tone: 'pending' },
  PAID: { label: 'Pago', tone: 'success' },
  OVERDUE: { label: 'Em atraso', tone: 'warning' },
  REFUNDED: { label: 'Estornado', tone: 'info' },
  EXPIRED: { label: 'Expirado', tone: 'closed' },
  DELETED: { label: 'Excluido', tone: 'closed' },
};

export const PAYMENT_LINK_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'ACTIVE', label: paymentStatusMeta.ACTIVE.label },
  { value: 'PAUSED', label: paymentStatusMeta.PAUSED.label },
  { value: 'PAID', label: paymentStatusMeta.PAID.label },
  { value: 'OVERDUE', label: paymentStatusMeta.OVERDUE.label },
  { value: 'REFUNDED', label: paymentStatusMeta.REFUNDED.label },
  { value: 'EXPIRED', label: paymentStatusMeta.EXPIRED.label },
  { value: 'DELETED', label: paymentStatusMeta.DELETED.label },
] as const;

export function getPaymentStatusLabel(
  status?: string | null,
  fallback = 'Pendente',
) {
  return status ? paymentStatusMeta[status]?.label ?? status : fallback;
}

export function getPaymentStatusTone(status?: string | null) {
  return paymentStatusMeta[status ?? 'PENDING']?.tone ?? 'draft';
}

export function getPaymentStatusClassName(status?: string | null) {
  return paymentToneClasses[getPaymentStatusTone(status)];
}

export function formatPaymentBillingType(value?: string | null) {
  if (value === 'CREDIT_CARD') return 'Cartao';
  if (value === 'BOLETO') return 'Boleto';
  if (value === 'UNDEFINED') return 'Cliente escolhe';
  return 'Pix';
}
