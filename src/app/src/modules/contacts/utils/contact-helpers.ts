import {
  Bot,
  CalendarClock,
  CreditCard,
  MessageSquare,
  MessageSquareText,
  NotebookPen,
  UserRound,
} from 'lucide-react';

import { formatDateTime } from '@/shared/lib/formatters';
import type { ContactTimelineEntry } from '@/shared/types';

export const timelineIcons = {
  CONTACT_CREATED: UserRound,
  CONTACT_STAGE: UserRound,
  CONTACT_NOTE: NotebookPen,
  RECOVERY_CASE_CREATED: CreditCard,
  RECOVERY_STATUS: CreditCard,
  CONVERSATION_STARTED: MessageSquare,
  MESSAGE_INBOUND: MessageSquareText,
  MESSAGE_OUTBOUND: MessageSquareText,
  PAYMENT_CONFIRMED: CreditCard,
  PAYMENT_OVERDUE: CreditCard,
  PAYMENT_REFUNDED: CreditCard,
  SCHEDULING_RESERVED: CalendarClock,
  FOLLOW_UP_SCHEDULED: CalendarClock,
  FOLLOW_UP_CANCELLED: CalendarClock,
  FOLLOW_UP_TRIGGERED: CalendarClock,
  FOLLOW_UP_SKIPPED: CalendarClock,
  HANDOFF_HUMAN: Bot,
  PAYMENT: CreditCard,
} as const;

export const stageToneMap: Record<
  string,
  { ring: string; dot: string; surface: string; text: string }
> = {
  LEAD: {
    ring: 'ring-info/20',
    dot: 'bg-info text-white',
    surface: 'border-info/20 bg-info/5',
    text: 'text-info',
  },
  PROSPECT: {
    ring: 'ring-success/20',
    dot: 'bg-success text-white',
    surface: 'border-success/20 bg-success/5',
    text: 'text-success',
  },
  OPPORTUNITY: {
    ring: 'ring-warning/20',
    dot: 'bg-warning text-white',
    surface: 'border-warning/20 bg-warning/5',
    text: 'text-warning',
  },
  CUSTOMER: {
    ring: 'ring-primary/20',
    dot: 'bg-primary text-white',
    surface: 'border-primary/20 bg-primary/[0.06]',
    text: 'text-primary',
  },
  INACTIVE: {
    ring: 'ring-border',
    dot: 'bg-muted text-muted-foreground',
    surface: 'border-border bg-muted/30',
    text: 'text-muted-foreground',
  },
};

export function formatContactSync(value?: string | null) {
  return (
    formatDateTime(value ?? undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) ?? 'Sem interação ainda'
  );
}

export function describeTimelineEntry(entry: ContactTimelineEntry) {
  if (typeof entry.details.text === 'string' && entry.details.text.trim()) {
    return entry.details.text;
  }

  if (typeof entry.details.notes === 'string' && entry.details.notes.trim()) {
    return entry.details.notes;
  }

  if (typeof entry.details.stage === 'string') {
    return `Estágio registrado: ${entry.details.stage}`;
  }

  if (typeof entry.details.channel === 'string') {
    return `Canal: ${entry.details.channel}`;
  }

  if (typeof entry.details.interval === 'string') {
    return `Intervalo: ${entry.details.interval}`;
  }

  if (typeof entry.details.deliveryStatus === 'string') {
    return `Status de entrega: ${entry.details.deliveryStatus}`;
  }

  if (typeof entry.details.professionalName === 'string') {
    const startsAt =
      typeof entry.details.startsAt === 'string' ? entry.details.startsAt : '--:--';
    const date = typeof entry.details.date === 'string' ? entry.details.date : '';
    return `Horário reservado com ${entry.details.professionalName} em ${date} às ${startsAt}.`;
  }

  if (typeof entry.details.chargeTitle === 'string') {
    return `Cobrança relacionada a ${entry.details.chargeTitle}.`;
  }

  if (typeof entry.details.paymentReference === 'string') {
    return `Pagamento vinculado à referência ${entry.details.paymentReference}.`;
  }

  return 'Evento registrado no histórico do contato.';
}
