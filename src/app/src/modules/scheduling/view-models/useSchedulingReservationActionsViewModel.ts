import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { schedulingService, type SchedulingSlotBillingType } from '@/modules/scheduling/services/scheduling-service';
import { sortSlots } from './scheduling-date-utils';
import type { SchedulingSelectedSlotDetails } from './useSchedulingPageState';

export function useSchedulingReservationActionsViewModel(params: {
  tenantId: string | undefined;
  activeBranchId: string | null | undefined;
  selectedDate: string;
  selectedProfessionalId: string | null | undefined;
  selectedSlotDetails: SchedulingSelectedSlotDetails;
  setSelectedSlotDetails: (slot: SchedulingSelectedSlotDetails) => void;
  setSlotDetailsOpen: (open: boolean) => void;
  setRescheduleReservationOpen: (open: boolean) => void;
  rescheduleReservationOpen: boolean;
  rescheduleReservationForm: { targetDate: string; targetSlotId: string };
  setRescheduleReservationForm: (form: { targetDate: string; targetSlotId: string }) => void;
  editReservationForm: { contactId: string; categoryId: string; notes: string };
}) {
  const {
    tenantId,
    activeBranchId,
    selectedDate,
    selectedProfessionalId,
    selectedSlotDetails,
    setSelectedSlotDetails,
    setSlotDetailsOpen,
    setRescheduleReservationOpen,
    rescheduleReservationOpen,
    rescheduleReservationForm,
    setRescheduleReservationForm,
    editReservationForm,
  } = params;

  const queryClient = useQueryClient();

  const rescheduleAvailabilityQuery = useQuery({
    queryKey: [
      'scheduling-reschedule-availability',
      tenantId,
      selectedSlotDetails?.professionalId,
      rescheduleReservationForm.targetDate,
    ],
    queryFn: () =>
      schedulingService.getAvailability(
        tenantId!,
        selectedSlotDetails!.professionalId,
        rescheduleReservationForm.targetDate,
      ),
    enabled:
      !!tenantId &&
      !!selectedSlotDetails?.professionalId &&
      rescheduleReservationOpen,
  });

  const rescheduleAvailableSlots = sortSlots(
    (rescheduleAvailabilityQuery.data ?? []).filter(
      (slot) =>
        slot.status === 'AVAILABLE' &&
        !(
          rescheduleReservationForm.targetDate === selectedDate &&
          slot.id === selectedSlotDetails?.id
        ),
    ),
  );

  const updateSlotMutation = useMutation({
    mutationFn: (payload: {
      slotId: string;
      action:
      | 'BLOCK'
      | 'UNBLOCK'
      | 'CANCEL_RESERVATION'
      | 'UPDATE_RESERVATION'
      | 'MARK_COMPLETED'
      | 'MARK_NO_SHOW';
      contactId?: string;
      categoryId?: string;
      notes?: string;
    }) => {
      const professionalId = selectedSlotDetails?.professionalId ?? selectedProfessionalId;

      if (!tenantId || !professionalId) {
        return Promise.reject(new Error('Selecione um profissional antes de atualizar a agenda.'));
      }

      return schedulingService.updateSlot(
        tenantId,
        professionalId,
        payload.slotId,
        {
          date: selectedDate,
          action: payload.action,
          contactId: payload.contactId,
          categoryId: payload.categoryId,
          notes: payload.notes,
        },
        activeBranchId,
      );
    },
    onSuccess: async (_, payload) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenantId, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
      ]);
      setSlotDetailsOpen(false);
      setSelectedSlotDetails(null);
      toast({
        title:
          payload.action === 'BLOCK'
            ? 'horário bloqueado'
            : payload.action === 'UNBLOCK'
              ? 'horário desbloqueado'
              : payload.action === 'CANCEL_RESERVATION'
                ? 'Reserva cancelada'
                : payload.action === 'MARK_COMPLETED'
                  ? 'Atendimento concluido'
                  : payload.action === 'MARK_NO_SHOW'
                    ? 'No-show registrado'
                    : 'Reserva atualizada',
        description: 'A agenda foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar horário',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível atualizar este horário agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const rescheduleReservationMutation = useMutation({
    mutationFn: () =>
      schedulingService.rescheduleReservation(
        tenantId!,
        selectedSlotDetails!.professionalId,
        selectedSlotDetails!.id,
        {
          sourceDate: selectedDate,
          targetDate: rescheduleReservationForm.targetDate,
          targetSlotId: rescheduleReservationForm.targetSlotId,
        },
        activeBranchId,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenantId, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'scheduling-availability',
            tenantId,
            selectedProfessionalId,
            rescheduleReservationForm.targetDate,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
      ]);
      setRescheduleReservationOpen(false);
      setSlotDetailsOpen(false);
      setSelectedSlotDetails(null);
      setRescheduleReservationForm({
        targetDate: selectedDate,
        targetSlotId: '',
      });
      toast({
        title: 'Reserva remarcada',
        description: 'O horário foi movido e a agenda foi sincronizada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao remarcar reserva',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível remarcar este horário agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createSlotPaymentLinkMutation = useMutation({
    mutationFn: (billingType: SchedulingSlotBillingType) => {
      if (!tenantId || !selectedSlotDetails) {
        return Promise.reject(new Error('Selecione um horário com reserva.'));
      }

      return schedulingService.createSlotPaymentLink(
        tenantId,
        selectedSlotDetails.professionalId,
        selectedSlotDetails.id,
        selectedDate,
        billingType,
        activeBranchId,
      );
    },
    onSuccess: async (slot) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenantId, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
      ]);

      setSelectedSlotDetails((prev) => {
        if (!prev || prev.id !== slot.id) {
          return prev;
        }

        return {
          ...prev,
          status: slot.status ?? prev.status,
          payment: slot.payment ?? prev.payment,
          reservedFor: slot.reservedFor ?? prev.reservedFor,
          reservedAt: slot.reservedAt ?? prev.reservedAt,
          startsAt: slot.startsAt ?? prev.startsAt,
          endsAt: slot.endsAt ?? prev.endsAt,
          customPrice: slot.customPrice ?? prev.customPrice,
        };
      });

      const url = slot.payment?.linkUrl;
      toast({
        title: 'Link de pagamento criado',
        description: url
          ? 'O link foi copiado para a área de transferência quando possível.'
          : 'Pagamento associado ao horário.',
      });

      if (url && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(url).catch(() => {});
      }
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar link',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar o link de pagamento agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    rescheduleAvailabilityQuery,
    rescheduleAvailableSlots,
    updateSlotMutation,
    rescheduleReservationMutation,
    createSlotPaymentLinkMutation,
  };
}
