import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/shared/lib/formatters';
import { CalendarDays, ExternalLink, Lock, Unlock } from 'lucide-react';
import { formatCurrency, formatSlotTime, getSlotTone } from './scheduling-view-helpers';

type SchedulingSlotCard = {
  id: string;
  professionalId: string;
  startsAt?: string;
  startTime?: string;
  endsAt?: string;
  endTime?: string;
  status?: 'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
  label?: string;
  customPrice?: number | null;
  reservedFor?: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    categoryName?: string;
    notes?: string;
    meetingUrl?: string;
  };
  reservedAt?: string;
  payment?: {
    status: 'PENDING' | 'PAID';
    expiresAt?: string;
  };
};

type Props = {
  slot: SchedulingSlotCard;
  mode: 'open' | 'reserved';
  onReserve: (slot: {
    id: string;
    professionalId: string;
    startsAt: string;
    endsAt: string;
  }) => void;
  onBlock: (slotId: string) => void;
  onUnblock: (slotId: string) => void;
  onOpenDetails: (slot: SchedulingSlotCard) => void;
  onCancelReservation: (slotId: string) => void;
};

function getStatusSummary(slot: SchedulingSlotCard) {
  if (slot.status === 'PRE_RESERVED') {
    return 'Esse horário esta separado temporariamente e depende do pagamento para ser confirmado.';
  }

  if (slot.status === 'RESERVED') {
    return 'horário confirmado e pronto para atendimento.';
  }

  if (slot.status === 'BLOCKED') {
    return 'horário fechado manualmente para impedir novos encaixes.';
  }

  return 'horário livre para reservar ou bloquear.';
}

export function SchedulingDaySlotCard({
  slot,
  mode,
  onReserve,
  onBlock,
  onUnblock,
  onOpenDetails,
  onCancelReservation,
}: Props) {
  const tone = getSlotTone(slot.status);
  const ToneIcon = tone.Icon;
  const paymentBadge =
    slot.status === 'PRE_RESERVED'
      ? 'Pagamento pendente'
      : slot.payment?.status === 'PAID'
        ? 'Pagamento confirmado'
        : null;

  return (
    <div
      role={mode === 'reserved' ? 'button' : undefined}
      tabIndex={mode === 'reserved' ? 0 : undefined}
      onClick={() => {
        if (mode === 'reserved') {
          onOpenDetails(slot);
        }
      }}
      onKeyDown={(event) => {
        if (mode === 'reserved' && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpenDetails(slot);
        }
      }}
      className={cn(
        'self-start rounded-3xl border p-5 transition-shadow duration-200 hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]',
        mode === 'reserved' ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40' : '',
        tone.cardClass,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              tone.iconClass,
            )}
          >
            <ToneIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{formatSlotTime(slot)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {slot.label || 'horário operacional da agenda'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{getStatusSummary(slot)}</p>
            {slot.customPrice ? (
              <p className="mt-2 text-xs font-medium text-foreground">
                preço do horário: {formatCurrency(slot.customPrice)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant="outline"
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
              tone.badgeClass,
            )}
          >
            {tone.label}
          </Badge>
          {paymentBadge ? (
            <Badge
              variant="outline"
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
                slot.status === 'PRE_RESERVED'
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-600'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
              )}
            >
              {paymentBadge}
            </Badge>
          ) : null}
        </div>
      </div>

      {mode === 'open' ? (
        slot.status === 'BLOCKED' ? (
          <div
            className={cn(
              'mt-4 rounded-2xl border p-3.5 text-xs text-muted-foreground',
              tone.detailClass,
            )}
          >
            <p>horário bloqueado manualmente para evitar novos encaixes.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => onUnblock(slot.id)}
            >
              <Unlock className="mr-2 h-4 w-4" />
              Desbloquear
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={() =>
                onReserve({
                  id: slot.id,
                  professionalId: slot.professionalId,
                  startsAt: slot.startsAt ?? slot.startTime ?? '',
                  endsAt: slot.endsAt ?? slot.endTime ?? '',
                })
              }
            >
              Reservar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 rounded-xl px-3"
              onClick={() => onBlock(slot.id)}
            >
              <Lock className="h-4 w-4" />
            </Button>
          </div>
        )
      ) : (
        <div
          className={cn(
            'mt-4 rounded-2xl border p-3.5 text-xs text-muted-foreground',
            tone.detailClass,
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">
              {slot.reservedFor?.contactName || 'Cliente não identificado'}
            </p>
            {slot.status === 'PRE_RESERVED' ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-600"
              >
                Aguardando pagamento
              </Badge>
            ) : null}
            {slot.payment?.status === 'PAID' ? (
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-600"
              >
                Pago
              </Badge>
            ) : null}
          </div>
          {slot.reservedFor?.categoryName ? (
            <p className="mt-1">Categoria: {slot.reservedFor.categoryName}</p>
          ) : null}
          {slot.reservedFor?.contactPhone ? (
            <p className="mt-1">Celular: {slot.reservedFor.contactPhone}</p>
          ) : null}
          {slot.reservedFor?.contactEmail ? (
            <p className="mt-1">Email: {slot.reservedFor.contactEmail}</p>
          ) : null}
          {slot.payment ? (
            <p className="mt-1">
              {slot.status === 'PRE_RESERVED'
                ? `Pagamento pendente ate ${slot.payment.expiresAt?.slice(11, 16) ?? 'o prazo configurado'}.`
                : `Pagamento ${slot.payment.status === 'PAID' ? 'confirmado' : 'registrado'}.`}
            </p>
          ) : null}
          {slot.reservedFor?.meetingUrl ? (
            <Button
              asChild
              type="button"
              size="sm"
              className="mt-3 rounded-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <a href={slot.reservedFor.meetingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Entrar no Meet
              </a>
            </Button>
          ) : null}
          <p className="mt-1">
            {slot.reservedFor?.notes || 'horário reservado para atendimento.'}
          </p>
          {slot.reservedAt ? (
            <p className="mt-1">Registrado em {formatDateTime(slot.reservedAt)}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails(slot);
              }}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Ver detalhes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={(event) => {
                event.stopPropagation();
                onCancelReservation(slot.id);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
