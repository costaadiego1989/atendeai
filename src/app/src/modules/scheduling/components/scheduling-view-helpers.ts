import { Ban, CalendarCheck2, CalendarDays, Clock3, UserX } from 'lucide-react';
import { formatDate } from '@/shared/lib/formatters';

export { formatCurrency } from '@/shared/lib/formatters';

export function formatSlotTime(slot: {
  startsAt?: string;
  startTime?: string;
  endsAt?: string;
  endTime?: string;
}) {
  return `${slot.startsAt ?? slot.startTime} - ${slot.endsAt ?? slot.endTime}`;
}

export function formatScheduleDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return formatDate(date, options);
}

export function formatRecurrenceDateRange(startDate: string, endDate?: string | null) {
  const formattedStart = formatScheduleDate(startDate, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedEnd = formatScheduleDate(endDate ?? startDate, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (!formattedStart || !formattedEnd) {
    return '--';
  }

  if (formattedStart === formattedEnd) {
    return formattedStart;
  }

  return `${formattedStart} ate ${formattedEnd}`;
}

export function getRecurrenceStatusLabel(
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED',
) {
  const labels = {
    ACTIVE: 'Ativa',
    COMPLETED: 'Concluida',
    CANCELLED: 'Cancelada',
    FAILED: 'Falhou',
  } as const;

  return labels[status];
}

export function getCategoryUnitLabel(
  unit?: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION',
) {
  if (unit === 'PER_SESSION') {
    return 'Por sessão';
  }

  if (unit === 'PER_CONSULTATION') {
    return 'Por consulta';
  }

  return 'Por minuto';
}

export function formatCategoryMeta(category: {
  unit?: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
  durationMinutes?: number | null;
  duration?: number;
}) {
  const durationMinutes = category.durationMinutes ?? category.duration;

  if (category.unit === 'PER_MINUTE' && durationMinutes) {
    return `${getCategoryUnitLabel(category.unit)} - ${durationMinutes} min`;
  }

  if (durationMinutes) {
    return `${getCategoryUnitLabel(category.unit)} - ${durationMinutes} min opcional`;
  }

  return getCategoryUnitLabel(category.unit);
}

export function getSlotTone(
  status?: 'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED',
) {
  if (status === 'PRE_RESERVED') {
    return {
      label: 'Pre-agendado',
      cardClass:
        'border-amber-500/25 bg-amber-500/[0.08] shadow-[0_20px_46px_-30px_rgba(217,119,6,0.22)]',
      iconClass: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
      badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
      detailClass: 'border-amber-500/15 bg-background/60',
      Icon: CalendarDays,
    };
  }

  if (status === 'RESERVED') {
    return {
      label: 'Reservado',
      cardClass:
        'border-primary/25 bg-primary/[0.08] shadow-[0_20px_46px_-30px_rgba(12,116,148,0.2)]',
      iconClass: 'border-primary/20 bg-primary/10 text-primary',
      badgeClass: 'border-primary/20 bg-primary/10 text-primary',
      detailClass: 'border-primary/10 bg-background/60',
      Icon: CalendarDays,
    };
  }

  if (status === 'COMPLETED') {
    return {
      label: 'Concluido',
      cardClass:
        'border-emerald-500/25 bg-emerald-500/[0.08] shadow-[0_20px_46px_-30px_rgba(16,185,129,0.2)]',
      iconClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
      badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
      detailClass: 'border-emerald-500/10 bg-background/60',
      Icon: CalendarCheck2,
    };
  }

  if (status === 'NO_SHOW') {
    return {
      label: 'No-show',
      cardClass:
        'border-rose-500/25 bg-rose-500/[0.08] shadow-[0_20px_46px_-30px_rgba(244,63,94,0.2)]',
      iconClass: 'border-rose-500/20 bg-rose-500/10 text-rose-500',
      badgeClass: 'border-rose-500/20 bg-rose-500/10 text-rose-500',
      detailClass: 'border-rose-500/10 bg-background/60',
      Icon: UserX,
    };
  }

  if (status === 'BLOCKED') {
    return {
      label: 'Bloqueado',
      cardClass: 'border-border/70 bg-muted/[0.14]',
      iconClass: 'border-border/60 bg-background/70 text-muted-foreground',
      badgeClass: 'border-border/70 bg-background/70 text-muted-foreground',
      detailClass: 'border-border/60 bg-background/60',
      Icon: Ban,
    };
  }

  return {
    label: 'Disponivel',
    cardClass:
      'border-success/25 bg-success/[0.08] shadow-[0_20px_46px_-30px_rgba(22,163,74,0.2)]',
    iconClass: 'border-success/20 bg-success/10 text-success',
    badgeClass: 'border-success/20 bg-success/10 text-success',
    detailClass: 'border-success/15 bg-background/60',
    Icon: Clock3,
  };
}
