import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Calendar, Clock3, Lock, Search, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import type { useSchedulingProfessionalsTabViewModel } from '@/modules/scheduling/view-models/useSchedulingProfessionalsTabViewModel';
import { formatDateTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency, formatSlotTime, getSlotTone } from '../view-models/scheduling-formatters';

type TabViewModel = ReturnType<typeof useSchedulingProfessionalsTabViewModel>;

type Props = {
  vm: SchedulingPageViewModel;
  tab: TabViewModel;
};

export function SchedulingDaySlotsTabs({ vm, tab }: Props) {
  return (
    <Tabs
      value={tab.slotsDayTab}
      onValueChange={(value) => tab.setSlotsDayTab(value as 'open' | 'reserved')}
      className="space-y-4"
    >
      <PageTabsList
        tabs={[
          { value: 'open', label: `Agenda aberta (${tab.openSlots.length})`, icon: Unlock },
          { value: 'reserved', label: `Reservados (${tab.reservedSlots.length})`, icon: Lock },
        ]}
      />

      <TabsContent value="open" className="space-y-4">
        {tab.openSlots.length ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {tab.openSlots.slice(0, tab.openSlotsVisible).map((slot) => {
              const tone = getSlotTone(slot.status);
              const ToneIcon = tone.Icon;

              return (
                <div
                  key={slot.id}
                  className={cn(
                    'self-start rounded-2xl border p-5 transition-shadow duration-200 hover:shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)]',
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
                        <p className="text-sm font-semibold text-foreground">
                          {formatSlotTime(slot)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {slot.label || 'Horário da agenda'}
                        </p>
                        {slot.customPrice ? (
                          <p className="mt-2 text-xs font-medium text-foreground">
                            {formatCurrency(slot.customPrice)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
                        tone.badgeClass,
                      )}
                    >
                      {tone.label}
                    </Badge>
                  </div>

                  {slot.status === 'BLOCKED' ? (
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
                        onClick={() => vm.unblockSlot(slot.id)}
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
                          vm.openReserveSlot({
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
                        onClick={() => vm.blockSlot(slot.id)}
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Clock3}
            title="Sem slots abertos neste dia"
            description="Os horários disponíveis e bloqueados aparecem aqui."
          />
        )}
        {tab.openSlots.length > tab.openSlotsVisible ? (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => tab.setOpenSlotsVisible((v) => v + tab.slotsPageSize)}
            >
              Ver mais ({tab.openSlots.length - tab.openSlotsVisible} restantes)
            </Button>
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="reserved" className="space-y-4">
        {tab.reservedSlots.length ? (
          <>
            <div className="glass-card p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={tab.reservedSearch}
                  onChange={(e) => {
                    tab.setReservedSearch(e.target.value);
                    tab.setReservedSlotsVisible(tab.slotsPageSize);
                  }}
                  placeholder="Buscar por cliente, celular, email ou categoria..."
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {tab.filteredReservedSlots.slice(0, tab.reservedSlotsVisible).map((slot) => {
                const tone = getSlotTone(slot.status);
                const ToneIcon = tone.Icon;

                return (
                  <div
                    key={slot.id}
                    className={cn(
                      'self-start rounded-2xl border p-5 transition-shadow duration-200 hover:shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)]',
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
                          <p className="text-sm font-semibold text-foreground">
                            {formatSlotTime(slot)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {slot.label || 'Horário da agenda'}
                          </p>
                          {slot.customPrice ? (
                            <p className="mt-2 text-xs font-medium text-foreground">
                              Preço do horário: {formatCurrency(slot.customPrice)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold',
                          tone.badgeClass,
                        )}
                      >
                        {tone.label}
                      </Badge>
                    </div>

                    <div
                      className={cn(
                        'mt-4 rounded-2xl border p-3.5 text-xs text-muted-foreground',
                        tone.detailClass,
                      )}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <p className="font-medium text-foreground">
                          {slot.reservedFor?.contactName || 'Cliente não identificado'}
                        </p>
                        {slot.reservedFor?.categoryName ? (
                          <p className="mt-1 text-xs text-emerald-600">
                            {slot.reservedFor.categoryName}
                          </p>
                        ) : null}
                      </div>
                      {slot.reservedFor?.contactPhone ? (
                        <p className="mt-1">{formatPhone(slot.reservedFor.contactPhone)}</p>
                      ) : null}
                      {slot.reservedFor?.contactEmail ? (
                        <p className="mt-1">{slot.reservedFor.contactEmail}</p>
                      ) : null}
                      {slot.payment ? (
                        <p className="mt-1">
                          {slot.status === 'PRE_RESERVED'
                            ? `Pagamento pendente até ${slot.payment.expiresAt?.slice(11, 16) ?? 'o prazo configurado'}.`
                            : `Pagamento ${slot.payment.status === 'PAID' ? 'confirmado' : 'registrado'}.`}
                        </p>
                      ) : null}
                      <p className="mt-1">
                        {slot.reservedFor?.notes || 'Horário reservado para atendimento.'}
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
                          onClick={() => vm.openSlotDetails(slot)}
                        >
                          Ver detalhes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => vm.cancelReservation(slot.id)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {tab.filteredReservedSlots.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nenhum resultado para esta busca"
                description="Tente buscar por outro nome, celular, email ou categoria."
              />
            ) : null}
            {tab.filteredReservedSlots.length > tab.reservedSlotsVisible ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => tab.setReservedSlotsVisible((v) => v + tab.slotsPageSize)}
                >
                  Ver mais ({tab.filteredReservedSlots.length - tab.reservedSlotsVisible} restantes)
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={Calendar}
            title="Sem slots reservados neste dia"
            description="As reservas ficam separadas aqui para manter a agenda principal mais limpa."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
