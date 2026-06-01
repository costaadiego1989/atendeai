import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  User,
  Video,
  Tag,
  FileText,
} from 'lucide-react';
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { SchedulingSlotBillingType } from '@/modules/scheduling/services/scheduling-service';
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { formatCurrency, formatScheduleDate } from '../view-models/scheduling-formatters';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/hooks/use-toast';

type Props = {
  vm: SchedulingPageViewModel;
};

function resolveSlotPrice(
  vm: SchedulingPageViewModel,
): number | null {
  const slot = vm.selectedSlotDetails;
  if (!slot) return null;
  if (slot.payment?.amount != null) return slot.payment.amount;
  if (slot.customPrice != null) return slot.customPrice;
  const categoryPrice = vm.categories.find(
    (c) => c.id === slot.reservedFor?.categoryId,
  )?.basePrice;
  if (categoryPrice != null) return categoryPrice;
  return null;
}

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

  const isFreeSlot =
    vm.selectedSlotDetails?.status === 'RESERVED' && !vm.selectedSlotDetails?.payment;
  const slotPrice = resolveSlotPrice(vm);
  const isReserved =
    vm.selectedSlotDetails?.status === 'RESERVED' ||
    vm.selectedSlotDetails?.status === 'PRE_RESERVED' ||
    vm.selectedSlotDetails?.status === 'COMPLETED' ||
    vm.selectedSlotDetails?.status === 'NO_SHOW';

  return (
    <Sheet open={vm.slotDetailsOpen} onOpenChange={vm.setSlotDetailsOpen}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/40">
          <SheetTitle className="text-lg">Detalhes do agendamento</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* --- Header card: date/time + price --- */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {vm.selectedSlotDetails
                    ? formatScheduleDate(vm.selectedDate)
                    : 'Nenhum horário selecionado'}
                </p>
                {vm.selectedSlotDetails && (
                  <p className="text-xs text-muted-foreground">
                    {vm.selectedSlotDetails.startsAt} – {vm.selectedSlotDetails.endsAt}
                  </p>
                )}
              </div>
            </div>
            {slotPrice != null && (
              <span className="text-base font-semibold text-foreground">
                {formatCurrency(slotPrice)}
              </span>
            )}
          </div>

          {isReserved ? (
            <>
              {/* --- Contact --- */}
              <div className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contato</p>
                  <p className="text-sm font-medium text-foreground">
                    {vm.selectedSlotDetails?.reservedFor?.contactName || 'Cliente não identificado'}
                  </p>
                </div>
              </div>

              {/* --- Payment status --- */}
              {vm.selectedSlotDetails?.payment ? (
                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Pagamento</span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        vm.selectedSlotDetails.payment.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {vm.selectedSlotDetails.payment.status === 'PAID' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-medium">{formatCurrency(vm.selectedSlotDetails.payment.amount)}</p>
                    </div>
                    {vm.selectedSlotDetails.payment.expiresAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Expira em</p>
                        <p className="font-medium">
                          {(() => {
                            const d = new Date(vm.selectedSlotDetails!.payment!.expiresAt!);
                            return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                  {vm.selectedSlotDetails.payment.linkUrl && (
                    <Button asChild variant="outline" size="sm" className="w-full rounded-lg">
                      <a
                        href={vm.selectedSlotDetails.payment.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Abrir link de pagamento
                      </a>
                    </Button>
                  )}
                </div>
              ) : isFreeSlot ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-900">Atendimento gratuito</p>
                    <p className="text-xs text-emerald-700">
                      Confirmado sem cobrança.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* --- Generate payment link --- */}
              {(vm.selectedSlotDetails?.status === 'RESERVED' ||
                vm.selectedSlotDetails?.status === 'PRE_RESERVED') &&
              !isFreeSlot &&
              !vm.selectedSlotDetails?.payment ? (
                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Forma de cobrança</span>
                  </div>
                  <Select
                    value={paymentBillingType}
                    onValueChange={(value) =>
                      setPaymentBillingType(value as SchedulingSlotBillingType)
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Escolha a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-lg"
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

              {/* --- Online meeting --- */}
              {vm.selectedSlotDetails?.reservedFor?.meetingUrl ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-700" />
                    <span className="text-sm font-medium text-foreground">Consulta online</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatScheduleDate(vm.selectedDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {vm.selectedSlotDetails.startsAt} – {vm.selectedSlotDetails.endsAt}
                    </span>
                  </div>
                  <p className="break-all text-xs text-muted-foreground font-mono bg-muted/30 rounded-md px-2 py-1.5">
                    {vm.selectedSlotDetails.reservedFor.meetingUrl}
                  </p>
                  <Button
                    size="sm"
                    className="w-full rounded-lg"
                    disabled={joiningMeeting}
                    onClick={handleJoinMeeting}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    {joiningMeeting ? 'Entrando...' : 'Acessar sala'}
                  </Button>
                </div>
              ) : vm.selectedSlotDetails?.reservedFor?.isOnline ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40">
                    <Video className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Atendimento online</p>
                    <p className="text-xs text-muted-foreground">
                      Link da sala ainda não foi gerado. Verifique a conexão com o Google Calendar.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* --- Category & Notes --- */}
              <div className="rounded-xl border border-border/50 p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="edit-reservation-category" className="text-sm font-medium">
                      Categoria
                    </Label>
                  </div>
                  <Select
                    value={vm.editReservationForm.categoryId}
                    onValueChange={(value) =>
                      vm.setEditReservationForm((current) => ({
                        ...current,
                        categoryId: value,
                      }))
                    }
                  >
                    <SelectTrigger id="edit-reservation-category" className="rounded-lg">
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
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="edit-reservation-notes" className="text-sm font-medium">
                      Observações
                    </Label>
                  </div>
                  <Textarea
                    id="edit-reservation-notes"
                    className="rounded-lg resize-none"
                    rows={3}
                    value={vm.editReservationForm.notes}
                    onChange={(event) =>
                      vm.setEditReservationForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este horário está bloqueado e pode ser liberado quando quiser.
            </p>
          )}
        </div>

        {/* --- Actions footer --- */}
        <div className="mt-6 flex flex-col gap-3 border-t border-border/40 pt-4">
          {vm.selectedSlotDetails?.status === 'RESERVED' ||
            vm.selectedSlotDetails?.status === 'PRE_RESERVED' ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => vm.openRescheduleReservation()}>
                Remarcar
              </Button>
              {vm.selectedSlotDetails.status === 'RESERVED' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      vm.selectedSlotDetails &&
                      vm.markReservationCompleted(vm.selectedSlotDetails.id)
                    }
                  >
                    Concluir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      vm.selectedSlotDetails && vm.markReservationNoShow(vm.selectedSlotDetails.id)
                    }
                  >
                    Não compareceu
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-destructive hover:text-destructive"
                onClick={() =>
                  vm.selectedSlotDetails && vm.cancelReservation(vm.selectedSlotDetails.id)
                }
              >
                Cancelar reserva
              </Button>
            </div>
          ) : vm.selectedSlotDetails?.status === 'BLOCKED' ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() =>
                vm.selectedSlotDetails && vm.unblockSlot(vm.selectedSlotDetails.id)
              }
            >
              Desbloquear
            </Button>
          ) : null}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => vm.setSlotDetailsOpen(false)}>
              Fechar
            </Button>
            {(vm.selectedSlotDetails?.status === 'RESERVED' ||
              vm.selectedSlotDetails?.status === 'PRE_RESERVED') && (
              <Button
                size="sm"
                className="rounded-lg"
                onClick={() =>
                  vm.selectedSlotDetails && vm.updateReservation(vm.selectedSlotDetails.id)
                }
                disabled={vm.updateSlotMutation.isPending}
              >
                Salvar ajustes
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
