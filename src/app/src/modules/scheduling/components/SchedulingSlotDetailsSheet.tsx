import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { SchedulingSlotBillingType } from '@/modules/scheduling/services/scheduling-service';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatCurrency, formatScheduleDate } from './scheduling-view-helpers';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingSlotDetailsSheet({ vm }: Props) {
  const [paymentBillingType, setPaymentBillingType] =
    useState<SchedulingSlotBillingType>('PIX');

  return (
    <Sheet open={vm.slotDetailsOpen} onOpenChange={vm.setSlotDetailsOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do horário</SheetTitle>
          <SheetDescription>
            Ajuste a reserva, veja o cliente vinculado ou libere o horário novamente.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
            <p className="font-medium text-foreground">
              {vm.selectedSlotDetails
                ? `${formatScheduleDate(vm.selectedDate)} - ${vm.selectedSlotDetails.startsAt} - ${vm.selectedSlotDetails.endsAt}`
                : 'Nenhum horário selecionado'}
            </p>
            {vm.selectedSlotDetails?.customPrice ? (
              <p className="mt-1 text-muted-foreground">
                {formatCurrency(vm.selectedSlotDetails.customPrice)}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                {formatCurrency(vm.selectedSlotDetails?.customPrice || 0)}
              </p>
            )}
          </div>

          {vm.selectedSlotDetails?.status === 'RESERVED' ||
            vm.selectedSlotDetails?.status === 'PRE_RESERVED' ||
            vm.selectedSlotDetails?.status === 'COMPLETED' ||
            vm.selectedSlotDetails?.status === 'NO_SHOW' ? (
            <>
              <div className="space-y-2">
                <Label>Contato</Label>
                <p className="rounded-2xl border border-border/60 bg-muted/15 p-3 text-sm">
                  {vm.selectedSlotDetails.reservedFor?.contactName || 'Cliente não identificado'}
                </p>
              </div>
              {vm.selectedSlotDetails.payment ? (
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {vm.selectedSlotDetails.status === 'PRE_RESERVED'
                      ? 'Pagamento pendente'
                      : 'Pagamento do agendamento'}
                  </p>
                  <p className="mt-1">
                    Status: {vm.selectedSlotDetails.payment.status === 'PAID' ? 'Pago' : 'Pendente'}
                  </p>
                  <p className="mt-1">
                    Valor: {formatCurrency(vm.selectedSlotDetails.payment.amount)}
                  </p>
                  {vm.selectedSlotDetails.payment.linkUrl ? (
                    <Button asChild size="sm" className="mt-3 rounded-xl">
                      <a
                        href={vm.selectedSlotDetails.payment.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir link de pagamento
                      </a>
                    </Button>
                  ) : null}
                  {vm.selectedSlotDetails.payment.expiresAt ? (
                    <p className="mt-1">
                      Expira em{' '}
                      {vm.selectedSlotDetails.payment.expiresAt.slice(0, 16).replace('T', ' ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {(vm.selectedSlotDetails.status === 'RESERVED' ||
                vm.selectedSlotDetails.status === 'PRE_RESERVED') &&
              (!vm.selectedSlotDetails.payment ||
                vm.selectedSlotDetails.payment.status === 'PENDING') ? (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <Label htmlFor="slot-payment-billing">Forma de cobrança</Label>
                  <Select
                    value={paymentBillingType}
                    onValueChange={(value) =>
                      setPaymentBillingType(value as SchedulingSlotBillingType)
                    }
                  >
                    <SelectTrigger id="slot-payment-billing">
                      <SelectValue placeholder="Escolha a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                      <SelectItem value="UNDEFINED">Automático</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={vm.createSlotPaymentLinkMutation.isPending}
                    onClick={() =>
                      vm.createSlotPaymentLinkMutation.mutate(paymentBillingType)
                    }
                  >
                    {vm.createSlotPaymentLinkMutation.isPending
                      ? 'Gerando...'
                      : 'Gerar link de pagamento'}
                  </Button>
                </div>
              ) : null}
              {vm.selectedSlotDetails.reservedFor?.meetingUrl ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Atendimento online</p>
                  <p className="mt-1 break-all">
                    {vm.selectedSlotDetails.reservedFor.meetingUrl}
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <a
                      href={vm.selectedSlotDetails.reservedFor.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir Meet
                    </a>
                  </Button>
                </div>
              ) : vm.selectedSlotDetails.reservedFor?.isOnline ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Atendimento online</p>
                  <p className="mt-1">
                    Link do Meet ainda nao foi gerado. Verifique a conexao com Google Calendar.
                  </p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="edit-reservation-category">Categoria</Label>
                <Select
                  value={vm.editReservationForm.categoryId}
                  onValueChange={(value) =>
                    vm.setEditReservationForm((current) => ({
                      ...current,
                      categoryId: value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-reservation-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {vm.selectedProfessionalCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reservation-notes">Observações</Label>
                <Textarea
                  id="edit-reservation-notes"
                  value={vm.editReservationForm.notes}
                  onChange={(event) =>
                    vm.setEditReservationForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este horário esta bloqueado e pode ser liberado quando quiser.
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {vm.selectedSlotDetails?.status === 'RESERVED' ||
              vm.selectedSlotDetails?.status === 'PRE_RESERVED' ? (
              <>
                <Button variant="outline" onClick={() => vm.openRescheduleReservation()}>
                  Remarcar
                </Button>
                {vm.selectedSlotDetails.status === 'RESERVED' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        vm.selectedSlotDetails &&
                        vm.markReservationCompleted(vm.selectedSlotDetails.id)
                      }
                    >
                      Concluir
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        vm.selectedSlotDetails && vm.markReservationNoShow(vm.selectedSlotDetails.id)
                      }
                    >
                      No-show
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() =>
                    vm.selectedSlotDetails && vm.cancelReservation(vm.selectedSlotDetails.id)
                  }
                >
                  Cancelar reserva
                </Button>
              </>
            ) : vm.selectedSlotDetails?.status === 'BLOCKED' ? (
              <Button
                variant="outline"
                onClick={() =>
                  vm.selectedSlotDetails && vm.unblockSlot(vm.selectedSlotDetails.id)
                }
              >
                Desbloquear
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => vm.setSlotDetailsOpen(false)}>
              Fechar
            </Button>
            {vm.selectedSlotDetails?.status === 'RESERVED' ||
              vm.selectedSlotDetails?.status === 'PRE_RESERVED' ? (
              <Button
                onClick={() =>
                  vm.selectedSlotDetails && vm.updateReservation(vm.selectedSlotDetails.id)
                }
                disabled={vm.updateSlotMutation.isPending}
              >
                Salvar ajustes
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
