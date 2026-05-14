import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarDays, Clock, ExternalLink, Video } from 'lucide-react';
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
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatCurrency, formatScheduleDate } from './scheduling-view-helpers';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/hooks/use-toast';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingSlotDetailsSheet({ vm }: Props) {
  const [paymentBillingType, setPaymentBillingType] =
    useState<SchedulingSlotBillingType>('PIX');
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const { tenant, activeBranchId } = useAuthStore();

  const handleJoinMeeting = async () => {
    if (!vm.selectedSlotDetails?.reservedFor?.meetingUrl || !tenant) return;

    setJoiningMeeting(true);
    try {
      const result = await schedulingService.joinMeeting(
        tenant.id,
        vm.selectedProfessionalId || '',
        vm.selectedSlotDetails.id,
        vm.selectedDate || '',
        activeBranchId,
        vm.selectedProfessional?.name,
      );

      // Open the meeting URL
      window.open(result.meetingUrl, '_blank');

      if (result.messageSent) {
        toast({
          title: 'Sala acessada',
          description: 'O cliente foi notificado via WhatsApp que você entrou na sala.',
        });
      } else {
        toast({
          title: 'Sala acessada',
          description: 'Não foi possível notificar o cliente, mas a sala está aberta.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível acessar a sala.',
        variant: 'destructive',
      });
    } finally {
      setJoiningMeeting(false);
    }
  };

  const isFreeSlot = vm.selectedSlotDetails?.status === 'RESERVED' && !vm.selectedSlotDetails?.payment;

  return (
    <Sheet open={vm.slotDetailsOpen} onOpenChange={vm.setSlotDetailsOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do agendamento</SheetTitle>
          <SheetDescription>
            Ajuste a reserva, veja o cliente vinculado ou libere o horário novamente.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm">
            <p className="font-medium text-foreground">
              {vm.selectedSlotDetails
                ? `${formatScheduleDate(vm.selectedDate)} das ${vm.selectedSlotDetails.startsAt} às ${vm.selectedSlotDetails.endsAt}`
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
              ) : isFreeSlot ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                  <p className="font-medium">Atendimento gratuito</p>
                  <p className="mt-1 text-emerald-700">
                    Este horário foi confirmado sem cobrança.
                  </p>
                </div>
              ) : null}
              {(vm.selectedSlotDetails.status === 'RESERVED' ||
                vm.selectedSlotDetails.status === 'PRE_RESERVED') &&
              !isFreeSlot &&
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
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-700" />
                    <p className="font-medium text-foreground">Consulta online</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatScheduleDate(vm.selectedDate)}</span>
                    <span>•</span>
                    <Clock className="h-3.5 w-3.5" />
                    <span>{vm.selectedSlotDetails.startsAt} – {vm.selectedSlotDetails.endsAt}</span>
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {vm.selectedSlotDetails.reservedFor.meetingUrl}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 rounded-xl"
                    disabled={joiningMeeting}
                    onClick={handleJoinMeeting}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    {joiningMeeting ? 'Entrando...' : 'Acessar sala'}
                  </Button>
                </div>
              ) : vm.selectedSlotDetails.reservedFor?.isOnline ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-amber-700" />
                    <p className="font-medium text-foreground">Atendimento online</p>
                  </div>
                  <p className="mt-1">
                    Link do Meet ainda não foi gerado. Verifique a conexão com Google Calendar.
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
