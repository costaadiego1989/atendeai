import { Badge } from '@/components/ui/badge';

type StatusVariant = 'active' | 'pending' | 'closed' | 'success' | 'warning' | 'info' | 'draft';

const variantStyles: Record<StatusVariant, string> = {
  active: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  success: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  pending: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  warning: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  closed: 'bg-muted text-muted-foreground border-border hover:bg-muted',
  info: 'bg-info/10 text-info border-info/20 hover:bg-info/10',
  draft: 'bg-secondary text-secondary-foreground border-border hover:bg-secondary',
};

const labelMap: Record<string, { label: string; variant: StatusVariant }> = {
  ACTIVE: { label: 'Ativo', variant: 'active' },
  PENDING_HUMAN: { label: 'Atendimento humano', variant: 'pending' },
  ARCHIVED: { label: 'Encerrado', variant: 'closed' },
  CLOSED: { label: 'Fechado', variant: 'closed' },
  SNOOZED: { label: 'Pausado', variant: 'info' },
  LEAD: { label: 'Lead', variant: 'info' },
  PROSPECT: { label: 'Prospect', variant: 'active' },
  OPPORTUNITY: { label: 'Oportunidade', variant: 'warning' },
  CUSTOMER: { label: 'Cliente', variant: 'success' },
  INACTIVE: { label: 'Inativo', variant: 'closed' },
  NEW: { label: 'Novo', variant: 'info' },
  QUALIFIED: { label: 'Qualificado', variant: 'active' },
  NEGOTIATION: { label: 'Negociação', variant: 'warning' },
  WON: { label: 'Ganho', variant: 'success' },
  LOST: { label: 'Perdido', variant: 'closed' },
  DRAFT: { label: 'Rascunho', variant: 'draft' },
  SCHEDULED: { label: 'Agendada', variant: 'pending' },
  PAUSED: { label: 'Pausado', variant: 'warning' },
  COMPLETED: { label: 'Concluído', variant: 'success' },
  PENDING: { label: 'Pendente', variant: 'pending' },
  RUNNING: { label: 'Executando', variant: 'info' },
  FAILED: { label: 'Falhou', variant: 'closed' },
  QUEUED: { label: 'Na fila', variant: 'pending' },
  SENT: { label: 'Enviado', variant: 'active' },
  DELIVERED: { label: 'Entregue', variant: 'success' },
  READ: { label: 'Lido', variant: 'success' },
  PAID: { label: 'Pago', variant: 'success' },
  OVERDUE: { label: 'Em atraso', variant: 'warning' },
  REFUNDED: { label: 'Estornado', variant: 'info' },
  DELETED: { label: 'Excluido', variant: 'closed' },
  EXPIRED: { label: 'Expirado', variant: 'closed' },
  ACCEPTED: { label: 'Aceita', variant: 'success' },
  REJECTED: { label: 'Rejeitada', variant: 'closed' },
  CANCELLED: { label: 'Cancelada', variant: 'closed' },
  READY_TO_CONTACT: { label: 'Pronto para contato', variant: 'info' },
  CONTACTED: { label: 'Contato feito', variant: 'active' },
  NEGOTIATING: { label: 'Negociando', variant: 'warning' },
  PROMISE_TO_PAY: { label: 'Promessa de pagamento', variant: 'pending' },
  NO_RESPONSE: { label: 'Sem resposta', variant: 'draft' },
  INVALID_CONTACT: { label: 'Contato invalido', variant: 'closed' },
  RESPONDED: { label: 'Respondeu', variant: 'success' },
  STOPPED: { label: 'Parado', variant: 'closed' },
  AVAILABLE: { label: 'Disponivel', variant: 'success' },
  LOW_STOCK: { label: 'Estoque baixo', variant: 'warning' },
  OUT_OF_STOCK: { label: 'Sem estoque', variant: 'closed' },
  UNAVAILABLE: { label: 'Indisponivel', variant: 'closed' },
  RESERVED: { label: 'Reservado', variant: 'pending' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const mapped = labelMap[status] || { label: status, variant: 'draft' as StatusVariant };
  return (
    <Badge
      variant="outline"
      className={`${variantStyles[mapped.variant]} inline-flex whitespace-nowrap text-[11px] font-medium ${className}`}
    >
      {mapped.label}
    </Badge>
  );
}
