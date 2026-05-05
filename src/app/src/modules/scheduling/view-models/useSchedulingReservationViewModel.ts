import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import { pickDefaultProfessionalCategoryId } from './scheduling-view-model-helpers';

type ReserveForm = {
  contactId: string;
  categoryId: string;
  isFree: boolean;
  isOnline: boolean;
  paymentTimeoutHours: string;
  notes: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
};

type Category = {
  id: string;
  name: string;
  basePrice?: number | null;
};

type SelectedSlot = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
} | null;

type ProfessionalCategoryMap = Record<string, Array<{ id: string; name: string }>>;

type Args = {
  tenantId?: string;
  activeBranchId?: string | null;
  selectedDate: string;
  selectedProfessionalId: string | null;
  selectedProfessionalCategories: Array<{ id: string; name: string }>;
  selectedSlot: SelectedSlot;
  setSelectedSlot: (value: SelectedSlot) => void;
  reserveForm: ReserveForm;
  setReserveForm: Dispatch<SetStateAction<ReserveForm>>;
  setReserveSlotOpen: (open: boolean) => void;
  setReserveContactSearch: (value: string) => void;
  contacts: Contact[];
  categories: Category[];
  professionalCategoryMap: ProfessionalCategoryMap;
};

export function useSchedulingReservationViewModel({
  tenantId,
  activeBranchId,
  selectedDate,
  selectedProfessionalId,
  selectedProfessionalCategories,
  selectedSlot,
  setSelectedSlot,
  reserveForm,
  setReserveForm,
  setReserveSlotOpen,
  setReserveContactSearch,
  contacts,
  categories,
  professionalCategoryMap,
}: Args) {
  const queryClient = useQueryClient();

  const selectedReserveContact =
    contacts.find((contact) => contact.id === reserveForm.contactId) ?? null;

  const selectedReserveProfessionalCategories =
    selectedSlot?.professionalId
      ? professionalCategoryMap[selectedSlot.professionalId] ?? []
      : selectedProfessionalCategories;

  const selectedReserveCategory =
    categories.find(
      (category) =>
        category.id ===
        (reserveForm.categoryId !== 'none'
          ? reserveForm.categoryId
          : pickDefaultProfessionalCategoryId(selectedReserveProfessionalCategories)),
    ) ?? null;

  const reserveSlotMutation = useMutation({
    mutationFn: () =>
      schedulingService.reserveSlot(
        tenantId!,
        selectedSlot!.professionalId,
        {
          date: selectedDate,
          slotId: selectedSlot!.id,
          contactId:
            reserveForm.contactId && reserveForm.contactId !== 'none'
              ? reserveForm.contactId
              : undefined,
          categoryId:
            reserveForm.categoryId && reserveForm.categoryId !== 'none'
              ? reserveForm.categoryId
              : pickDefaultProfessionalCategoryId(selectedReserveProfessionalCategories) !== 'none'
                ? pickDefaultProfessionalCategoryId(selectedReserveProfessionalCategories)
                : undefined,
          isFree: reserveForm.isFree,
          isOnline: reserveForm.isOnline,
          paymentTimeoutHours: reserveForm.isFree
            ? undefined
            : Number.parseInt(reserveForm.paymentTimeoutHours, 10) || 3,
          notes: reserveForm.notes.trim() || undefined,
        },
        activeBranchId,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenantId, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
      ]);
      setReserveSlotOpen(false);
      setReserveForm({
        contactId: 'none',
        categoryId: pickDefaultProfessionalCategoryId(selectedReserveProfessionalCategories),
        isFree: false,
        isOnline: false,
        paymentTimeoutHours: '3',
        notes: '',
      });
      setSelectedSlot(null);
      toast({
        title: 'horário reservado',
        description: 'A reserva foi registrada e a confirmação foi enviada ao cliente no WhatsApp.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao reservar horário',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel reservar este horário agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  function openReserveSlot(slot: NonNullable<SelectedSlot>) {
    const professionalCategories = professionalCategoryMap[slot.professionalId] ?? [];

    setSelectedSlot(slot);
    setReserveForm({
      contactId: 'none',
      categoryId: pickDefaultProfessionalCategoryId(professionalCategories),
      isFree: false,
      isOnline: false,
      paymentTimeoutHours: '3',
      notes: '',
    });
    setReserveContactSearch('');
    setReserveSlotOpen(true);
  }

  function submitReserveSlot() {
    if (!selectedSlot) {
      return;
    }

    if (!reserveForm.isFree && reserveForm.contactId === 'none') {
      toast({
        title: 'Selecione um contato',
        description:
          'Para cobrar esse horário, escolha um contato do CRM para receber o link no WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    if (!reserveForm.isFree && (Number.parseInt(reserveForm.paymentTimeoutHours, 10) || 0) < 1) {
      toast({
        title: 'Prazo invalido',
        description: 'Informe em quantas horas o pré-agendamento deve expirar.',
        variant: 'destructive',
      });
      return;
    }

    reserveSlotMutation.mutate();
  }

  return {
    selectedReserveContact,
    selectedReserveProfessionalCategories,
    selectedReserveCategory,
    reserveSlotMutation,
    openReserveSlot,
    submitReserveSlot,
  };
}
