import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { parseCurrencyInput } from '@/shared/lib/masks';
import { useAuthStore } from '@/shared/stores/auth-store';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { schedulingService, type SchedulingSlotBillingType } from '@/modules/scheduling/services/scheduling-service';
import {
  addDays,
  getDefaultProfessionalPhone,
  getMonthDates,
  getOperatingDayKey,
  getWeekDates,
  isoToday,
  minutesToTime,
  normalizePhone,
  pickDefaultProfessionalCategoryId,
  sortSlots,
  timeToMinutes,
} from './scheduling-view-model-helpers';
import { useSchedulingPageState } from './useSchedulingPageState';
import { useSchedulingReportsViewModel } from './useSchedulingReportsViewModel';
import { useSchedulingReservationViewModel } from './useSchedulingReservationViewModel';
import { useSchedulingRosterViewModel } from './useSchedulingRosterViewModel';

export function useSchedulingPageViewModel() {
  const queryClient = useQueryClient();
  const { tenant, user, activeBranchId } = useAuthStore();
  const {
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    calendarView,
    setCalendarView,
    selectedProfessionalId,
    setSelectedProfessionalId,
    selectedCategoryId,
    setSelectedCategoryId,
    createProfessionalOpen,
    setCreateProfessionalOpen,
    createCategoryOpen,
    setCreateCategoryOpen,
    assignCategoriesOpen,
    setAssignCategoriesOpen,
    reserveSlotOpen,
    setReserveSlotOpen,
    bulkSlotGeneratorOpen,
    setBulkSlotGeneratorOpen,
    slotDetailsOpen,
    setSlotDetailsOpen,
    rescheduleReservationOpen,
    setRescheduleReservationOpen,
    recurrenceOpen,
    setRecurrenceOpen,
    reportsOpen,
    setReportsOpen,
    reserveContactSearch,
    setReserveContactSearch,
    availabilityDraft,
    setAvailabilityDraft,
    selectedSlot,
    setSelectedSlot,
    selectedSlotDetails,
    setSelectedSlotDetails,
    selectedProfessionalForAssignment,
    setSelectedProfessionalForAssignment,
    selectedAssignmentCategoryIds,
    setSelectedAssignmentCategoryIds,
    createProfessionalForm,
    setCreateProfessionalForm,
    createCategoryForm,
    setCreateCategoryForm,
    bulkSlotGeneratorForm,
    setBulkSlotGeneratorForm,
    reserveForm,
    setReserveForm,
    recurrenceForm,
    setRecurrenceForm,
    editReservationForm,
    setEditReservationForm,
    rescheduleReservationForm,
    setRescheduleReservationForm,
    reportFilters,
    setReportFilters,
  } = useSchedulingPageState(user?.phone);

  const professionalsQuery = useQuery({
    queryKey: ['scheduling-professionals', tenant?.id, activeBranchId],
    queryFn: () => schedulingService.listProfessionalsByBranch(tenant!.id, activeBranchId),
    enabled: !!tenant?.id,
  });

  const categoriesQuery = useQuery({
    queryKey: ['scheduling-categories', tenant?.id, activeBranchId],
    queryFn: () => schedulingService.listCategoriesByBranch(tenant!.id, activeBranchId),
    enabled: !!tenant?.id,
  });

  const contactsQuery = useQuery({
    queryKey: ['scheduling-contacts', tenant?.id],
    queryFn: () => contactsService.listContacts(tenant!.id),
    enabled: !!tenant?.id,
  });

  useEffect(() => {
    if (!selectedProfessionalId && professionalsQuery.data?.[0]) {
      setSelectedProfessionalId(professionalsQuery.data[0].id);
    }
  }, [professionalsQuery.data, selectedProfessionalId]);

  useEffect(() => {
    if (!selectedCategoryId && categoriesQuery.data?.[0]) {
      setSelectedCategoryId(categoriesQuery.data[0].id);
    }
  }, [categoriesQuery.data, selectedCategoryId]);

  useEffect(() => {
    if (!createProfessionalOpen) {
      return;
    }

    setCreateProfessionalForm((current) => {
      if (current.name.trim() || current.phone.trim()) {
        return current;
      }

      return {
        ...current,
        phone: getDefaultProfessionalPhone(user?.phone),
      };
    });
  }, [createProfessionalOpen, user?.phone]);

  const availabilityQuery = useQuery({
    queryKey: ['scheduling-availability', tenant?.id, selectedProfessionalId, selectedDate],
    queryFn: () =>
      schedulingService.getAvailability(tenant!.id, selectedProfessionalId!, selectedDate),
    enabled: !!tenant?.id && !!selectedProfessionalId && !!selectedDate,
  });

  const categoryProfessionalsQuery = useQuery({
    queryKey: ['scheduling-category-professionals', tenant?.id, activeBranchId, selectedCategoryId],
    queryFn: () =>
      schedulingService.listCategoryProfessionals(tenant!.id, selectedCategoryId!, activeBranchId),
    enabled: !!tenant?.id && !!selectedCategoryId,
  });

  const categoryAvailabilityQuery = useQuery({
    queryKey: ['scheduling-category-availability', tenant?.id, activeBranchId, selectedCategoryId, selectedDate],
    queryFn: () =>
      schedulingService.getCategoryAvailability(
        tenant!.id,
        selectedCategoryId!,
        selectedDate,
        activeBranchId,
      ),
    enabled: !!tenant?.id && !!selectedCategoryId && !!selectedDate,
  });

  const recurrencesQuery = useQuery({
    queryKey: ['scheduling-recurrences', tenant?.id, selectedProfessionalId],
    queryFn: () =>
      schedulingService.listRecurrences(tenant!.id, selectedProfessionalId!),
    enabled: !!tenant?.id && !!selectedProfessionalId,
  });

  const calendarRangeQuery = useQuery({
    queryKey: [
      'scheduling-calendar-range',
      tenant?.id,
      selectedProfessionalId,
      selectedDate,
      calendarView,
    ],
    queryFn: async () => {
      if (!tenant?.id || !selectedProfessionalId) {
        return [];
      }

      const dates =
        calendarView === 'week'
          ? getWeekDates(selectedDate)
          : calendarView === 'month'
            ? getMonthDates(selectedDate)
            : [selectedDate];

      return Promise.all(
        dates.map(async (date) => ({
          date,
          slots: await schedulingService.getAvailability(
            tenant.id,
            selectedProfessionalId,
            date,
          ),
        })),
      );
    },
    enabled: !!tenant?.id && !!selectedProfessionalId,
  });

  const categoryAssignmentsQuery = useQuery({
    queryKey: ['scheduling-category-assignments', tenant?.id, categoriesQuery.data?.length],
    queryFn: async () => {
      if (!tenant?.id || !categoriesQuery.data?.length) {
        return {};
      }

      const pairs = await Promise.all(
        categoriesQuery.data.map(async (category) => {
          const professionals = await schedulingService.listCategoryProfessionals(
            tenant.id,
            category.id,
            activeBranchId,
          );
          return [category.id, professionals.map((professional) => professional.id)] as const;
        }),
      );

      return Object.fromEntries(pairs) as Record<string, string[]>;
    },
    enabled: !!tenant?.id && !!categoriesQuery.data?.length,
  });

  const rescheduleAvailabilityQuery = useQuery({
    queryKey: [
      'scheduling-reschedule-availability',
      tenant?.id,
      selectedSlotDetails?.professionalId,
      rescheduleReservationForm.targetDate,
    ],
    queryFn: () =>
      schedulingService.getAvailability(
        tenant!.id,
        selectedSlotDetails!.professionalId,
        rescheduleReservationForm.targetDate,
      ),
    enabled:
      !!tenant?.id &&
      !!selectedSlotDetails?.professionalId &&
      rescheduleReservationOpen,
  });

  const createProfessionalMutation = useMutation({
    mutationFn: () =>
      schedulingService.createProfessional(tenant!.id, {
        name: createProfessionalForm.name.trim(),
        phone: normalizePhone(createProfessionalForm.phone),
      }, activeBranchId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['scheduling-professionals', tenant?.id],
      });
      setCreateProfessionalOpen(false);
      setCreateProfessionalForm({
        name: '',
        phone: getDefaultProfessionalPhone(user?.phone),
      });
      toast({
        title: 'Profissional criado',
        description: 'O profissional ja esta disponivel para configurar agenda e categorias.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar profissional',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel criar este profissional agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: () => {
      const durationMinutes = Number.parseInt(createCategoryForm.durationMinutes, 10);
      const parsedBasePrice = parseCurrencyInput(createCategoryForm.basePrice);

      return schedulingService.createCategory(tenant!.id, {
        name: createCategoryForm.name.trim(),
        unit: createCategoryForm.unit,
        durationMinutes:
          createCategoryForm.unit === 'PER_MINUTE' ? durationMinutes : undefined,
        basePrice: parsedBasePrice ? Number.parseFloat(parsedBasePrice) : undefined,
      }, activeBranchId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['scheduling-categories', tenant?.id],
      });
      setCreateCategoryOpen(false);
      setCreateCategoryForm({
        name: '',
        unit: 'PER_MINUTE',
        durationMinutes: '30',
        basePrice: '',
      });
      toast({
        title: 'Categoria criada',
        description: 'A categoria ja pode ser vinculada aos profissionais.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar categoria',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel criar esta categoria agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createRecurrenceMutation = useMutation({
    mutationFn: () =>
      schedulingService.createRecurrence(
        tenant!.id,
        {
          professionalId: recurrenceForm.professionalId || selectedProfessionalId!,
          contactId:
            recurrenceForm.contactId !== 'none' ? recurrenceForm.contactId : undefined,
          categoryId:
            recurrenceForm.categoryId !== 'none' ? recurrenceForm.categoryId : undefined,
          startDate: recurrenceForm.startDate,
          endDate:
            recurrenceForm.endDate && recurrenceForm.endDate !== recurrenceForm.startDate
              ? recurrenceForm.endDate
              : undefined,
          maxOccurrences: Number.parseInt(recurrenceForm.occurrences, 10) || 4,
          startsAt: recurrenceForm.startsAt,
          endsAt: recurrenceForm.endsAt,
          frequency: recurrenceForm.frequency,
          interval: Number.parseInt(recurrenceForm.interval, 10) || 1,
          isFree: recurrenceForm.isFree,
          isOnline: recurrenceForm.isOnline,
          paymentTimeoutHours: recurrenceForm.isFree
            ? undefined
            : Number.parseInt(recurrenceForm.paymentTimeoutHours, 10) || 3,
          notes: recurrenceForm.notes.trim() || undefined,
        },
        activeBranchId,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-recurrences', tenant?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenant?.id],
          exact: false,
        }),
      ]);
      setRecurrenceOpen(false);
      setRecurrenceForm((current) => ({
        ...current,
        contactId: 'none',
        categoryId: 'none',
        notes: '',
      }));
      toast({
        title: 'Atendimento recorrente criado',
        description: 'As sessões serao geradas conforme a frequência e o horario contratados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar atendimento recorrente',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'nao foi possivel criar este atendimento recorrente agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const cancelRecurrenceMutation = useMutation({
    mutationFn: (recurrenceId: string) =>
      schedulingService.cancelRecurrence(tenant!.id, recurrenceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['scheduling-recurrences', tenant?.id],
      });
      toast({
        title: 'Atendimento recorrente cancelado',
        description: 'Novas sessoes nao serao geradas para este contrato.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao cancelar atendimento recorrente',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'nao foi possivel cancelar este atendimento recorrente agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteRecurrenceMutation = useMutation({
    mutationFn: (recurrenceId: string) =>
      schedulingService.deleteRecurrence(tenant!.id, recurrenceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['scheduling-recurrences', tenant?.id],
      });
      toast({
        title: 'Atendimento recorrente excluido',
        description: 'O contrato recorrente foi removido da lista.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao excluir atendimento recorrente',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'nao foi possivel excluir este atendimento recorrente agora.',
        }),
        variant: 'destructive',
      });
    },
  });

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

      if (!tenant?.id || !professionalId) {
        return Promise.reject(new Error('Selecione um profissional antes de atualizar a agenda.'));
      }

      return schedulingService.updateSlot(
        tenant.id,
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
          queryKey: ['scheduling-availability', tenant?.id, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenant?.id],
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
          fallbackMessage: 'não foi possivel atualizar este horário agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const rescheduleReservationMutation = useMutation({
    mutationFn: () =>
      schedulingService.rescheduleReservation(
        tenant!.id,
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
          queryKey: ['scheduling-availability', tenant?.id, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'scheduling-availability',
            tenant?.id,
            selectedProfessionalId,
            rescheduleReservationForm.targetDate,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenant?.id],
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
          fallbackMessage: 'não foi possivel remarcar este horário agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createSlotPaymentLinkMutation = useMutation({
    mutationFn: (billingType: SchedulingSlotBillingType) => {
      if (!tenant?.id || !selectedSlotDetails) {
        return Promise.reject(new Error('Selecione um horário com reserva.'));
      }

      return schedulingService.createSlotPaymentLink(
        tenant.id,
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
          queryKey: ['scheduling-availability', tenant?.id, selectedProfessionalId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenant?.id],
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

  const professionals = professionalsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const availabilitySlots = sortSlots(availabilityQuery.data ?? []);
  const recurrences = recurrencesQuery.data ?? [];
  const categoryProfessionals = categoryProfessionalsQuery.data ?? [];
  const categoryAvailability = categoryAvailabilityQuery.data ?? [];
  const calendarRange = calendarRangeQuery.data ?? [];
  const selectedProfessional =
    professionals.find((professional) => professional.id === selectedProfessionalId) ?? null;
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const filteredContacts = useMemo(() => {
    const normalizedQuery = reserveContactSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return contacts.slice(0, 20);
    }

    return contacts
      .filter((contact) =>
        [contact.name, contact.phone, contact.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 20);
  }, [contacts, reserveContactSearch]);
  const professionalCategoryMap = useMemo(() => {
    if (!categoryAssignmentsQuery.data) {
      return {} as Record<string, Array<{ id: string; name: string }>>;
    }

    return professionals.reduce<Record<string, Array<{ id: string; name: string }>>>(
      (accumulator, professional) => {
        accumulator[professional.id] = categories
          .filter((category) =>
            (categoryAssignmentsQuery.data[category.id] ?? []).includes(professional.id),
          )
          .map((category) => ({ id: category.id, name: category.name }));

        return accumulator;
      },
      {},
    );
  }, [categories, categoryAssignmentsQuery.data, professionals]);
  const selectedProfessionalCategories =
    selectedProfessionalId ? professionalCategoryMap[selectedProfessionalId] ?? [] : [];
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
  const rosterVm = useSchedulingRosterViewModel({
    tenantId: tenant?.id,
    tenantOperatingHours: tenant?.operatingHours,
    selectedDate,
    setSelectedDate,
    selectedProfessionalId,
    setSelectedProfessionalId,
    setCalendarView,
    availabilityDraft,
    setAvailabilityDraft,
    availabilitySlots,
    professionals,
    categories,
    professionalCategoryMap,
    categoryAssignmentsData: categoryAssignmentsQuery.data,
    selectedProfessionalForAssignment,
    setSelectedProfessionalForAssignment,
    selectedAssignmentCategoryIds,
    setSelectedAssignmentCategoryIds,
    assignCategoriesOpen,
    setAssignCategoriesOpen,
    bulkSlotGeneratorOpen,
    setBulkSlotGeneratorOpen,
    bulkSlotGeneratorForm,
    setBulkSlotGeneratorForm,
  });
  const reservationVm = useSchedulingReservationViewModel({
    tenantId: tenant?.id,
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
  });
  const reportsVm = useSchedulingReportsViewModel({
    tenantId: tenant?.id,
    branchId: activeBranchId,
    reportsOpen,
    setReportsOpen,
    reportFilters,
    setReportFilters,
  });

  useEffect(() => {
    if (!recurrenceOpen) {
      return;
    }

    setRecurrenceForm((current) => {
      const professionalId = current.professionalId || selectedProfessionalId;
      const linkedCategories =
        professionalId ? professionalCategoryMap[professionalId] ?? [] : [];
      const currentCategoryIsValid =
        current.categoryId === 'none' ||
        linkedCategories.some((category) => category.id === current.categoryId);

      if (currentCategoryIsValid) {
        return current;
      }

      return {
        ...current,
        categoryId: linkedCategories[0]?.id ?? 'none',
      };
    });
  }, [professionalCategoryMap, recurrenceOpen, selectedProfessionalId, setRecurrenceForm]);
  useEffect(() => {
    if (!bulkSlotGeneratorOpen || !bulkSlotGeneratorForm.professionalId) {
      return;
    }

    const linkedCategories =
      professionalCategoryMap[bulkSlotGeneratorForm.professionalId] ?? [];

    setBulkSlotGeneratorForm((current) => {
      const currentCategoryStillValid = linkedCategories.some(
        (category) => category.id === current.categoryId,
      );
      const nextCategoryId = currentCategoryStillValid
        ? current.categoryId
        : linkedCategories[0]?.id ?? 'none';
      const nextCategory =
        categories.find((category) => category.id === nextCategoryId) ?? null;

      return {
        ...current,
        categoryId: nextCategoryId,
        slotDurationMinutes: String(
          nextCategory?.durationMinutes ??
          (Number.parseInt(current.slotDurationMinutes, 10) || 30),
        ),
      };
    });
  }, [
    bulkSlotGeneratorOpen,
    bulkSlotGeneratorForm.professionalId,
    categories,
    professionalCategoryMap,
  ]);

  return {
    tenant,
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    selectedProfessionalId,
    setSelectedProfessionalId,
    selectedCategoryId,
    setSelectedCategoryId,
    createProfessionalOpen,
    setCreateProfessionalOpen,
    createCategoryOpen,
    setCreateCategoryOpen,
    assignCategoriesOpen,
    setAssignCategoriesOpen,
    reserveSlotOpen,
    setReserveSlotOpen,
    bulkSlotGeneratorOpen,
    setBulkSlotGeneratorOpen,
    rescheduleReservationOpen,
    setRescheduleReservationOpen,
    createProfessionalForm,
    setCreateProfessionalForm,
    createCategoryForm,
    setCreateCategoryForm,
    bulkSlotGeneratorForm,
    setBulkSlotGeneratorForm,
    availabilityDraft,
    setAvailabilityDraft,
    reserveForm,
    setReserveForm,
    editReservationForm,
    setEditReservationForm,
    rescheduleReservationForm,
    setRescheduleReservationForm,
    reportFilters: reportsVm.reportFilters,
    setReportFilters: reportsVm.setReportFilters,
    reportsOpen: reportsVm.reportsOpen,
    setReportsOpen: reportsVm.setReportsOpen,
    recurrenceOpen,
    setRecurrenceOpen,
    recurrenceForm,
    setRecurrenceForm,
    schedulingActiveJobItems: reportsVm.activeJobItems,
    schedulingActiveReportJob: reportsVm.activeReportJob,
    calendarView,
    setCalendarView,
    reserveContactSearch,
    setReserveContactSearch,
    selectedSlot,
    setSelectedSlot,
    selectedSlotDetails,
    setSelectedSlotDetails,
    slotDetailsOpen,
    setSlotDetailsOpen,
    rescheduleAvailableSlots,
    professionals,
    categories,
    contacts,
    filteredContacts,
    availabilitySlots,
    recurrences,
    calendarRange,
    categoryProfessionals,
    categoryAvailability,
    selectedProfessional,
    selectedCategory,
    selectedReserveContact: reservationVm.selectedReserveContact,
    selectedReserveCategory: reservationVm.selectedReserveCategory,
    selectedProfessionalCategories,
    bulkGenerationProfessionalCategories: rosterVm.bulkGenerationProfessionalCategories,
    selectedBulkGenerationProfessional: rosterVm.selectedBulkGenerationProfessional,
    selectedBulkGenerationCategory: rosterVm.selectedBulkGenerationCategory,
    professionalCategoryMap,
    selectedAssignmentCategoryIds,
    selectedProfessionalCategoryIds: rosterVm.selectedProfessionalCategoryIds,
    professionalsQuery,
    categoriesQuery,
    contactsQuery,
    availabilityQuery,
    rescheduleAvailabilityQuery,
    categoryProfessionalsQuery,
    categoryAvailabilityQuery,
    calendarRangeQuery,
    recurrencesQuery,
    createProfessionalMutation,
    createCategoryMutation,
    createRecurrenceMutation,
    cancelRecurrenceMutation,
    deleteRecurrenceMutation,
    saveAvailabilityMutation: rosterVm.saveAvailabilityMutation,
    generateBulkSlotsMutation: rosterVm.generateBulkSlotsMutation,
    assignCategoriesMutation: rosterVm.assignCategoriesMutation,
    reserveSlotMutation: reservationVm.reserveSlotMutation,
    updateSlotMutation,
    rescheduleReservationMutation,
    generateReportMutation: reportsVm.generateReportMutation,
    syncReportSummaryMutation: reportsVm.syncReportSummaryMutation,
    createSlotPaymentLinkMutation,
    downloadCurrentReport: reportsVm.downloadCurrentReport,
    openAssignCategories: rosterVm.openAssignCategories,
    toggleAssignmentCategory: rosterVm.toggleAssignmentCategory,
    addAvailabilityRow: rosterVm.addAvailabilityRow,
    updateAvailabilityRow(
      index: number,
      field: 'startsAt' | 'endsAt' | 'label' | 'customPrice' | 'isOnline',
      value: string | boolean,
    ) {
      setAvailabilityDraft((current) =>
        current.map((slot, slotIndex) =>
          slotIndex === index ? { ...slot, [field]: value } : slot,
        ),
      );
    },
    removeAvailabilityRow: rosterVm.removeAvailabilityRow,
    syncAvailabilityDraftFromLoaded: rosterVm.syncAvailabilityDraftFromLoaded,
    saveAvailability: rosterVm.saveAvailability,
    openBulkSlotGenerator: rosterVm.openBulkSlotGenerator,
    submitBulkSlotGeneration: rosterVm.submitBulkSlotGeneration,
    submitCreateProfessional() {
      if (!createProfessionalForm.name.trim()) {
        toast({
          title: 'Informe o nome',
          description: 'O nome do profissional e obrigatorio.',
          variant: 'destructive',
        });
        return;
      }

      if (normalizePhone(createProfessionalForm.phone).length < 10) {
        toast({
          title: 'Informe um celular valido',
          description:
            'Precisamos do telefone do profissional para avisos e confirmacoes da agenda.',
          variant: 'destructive',
        });
        return;
      }

      createProfessionalMutation.mutate();
    },
    submitCreateCategory() {
      const durationMinutes = Number.parseInt(createCategoryForm.durationMinutes, 10);
      const requiresDuration = createCategoryForm.unit === 'PER_MINUTE';
      const parsedBasePrice = parseCurrencyInput(createCategoryForm.basePrice);

      if (
        !createCategoryForm.name.trim() ||
        (requiresDuration && (Number.isNaN(durationMinutes) || durationMinutes < 1))
      ) {
        toast({
          title: 'Dados incompletos',
          description: requiresDuration
            ? 'Informe nome e duração valida para a categoria.'
            : 'Informe ao menos o nome da categoria.',
          variant: 'destructive',
        });
        return;
      }

      if (
        createCategoryForm.basePrice &&
        (Number.isNaN(Number.parseFloat(parsedBasePrice ?? '')) ||
          Number.parseFloat(parsedBasePrice ?? '0') < 0)
      ) {
        toast({
          title: 'preço invalido',
          description: 'Informe um preço base valido para a categoria.',
          variant: 'destructive',
        });
        return;
      }

      createCategoryMutation.mutate();
    },
    openRecurrenceForm() {
      setRecurrenceForm((current) => ({
        ...current,
        professionalId: selectedProfessionalId ?? professionals[0]?.id ?? '',
        categoryId: selectedProfessionalCategories[0]?.id ?? 'none',
        startDate: selectedDate,
        endDate: selectedDate,
        occurrences: '4',
      }));
      setRecurrenceOpen(true);
    },
    submitCreateRecurrence() {
      const startsAt = timeToMinutes(recurrenceForm.startsAt);
      const endsAt = timeToMinutes(recurrenceForm.endsAt);

      if (!(recurrenceForm.professionalId || selectedProfessionalId)) {
        toast({
          title: 'Selecione um profissional',
          description: 'O atendimento recorrente precisa estar vinculado a uma agenda.',
          variant: 'destructive',
        });
        return;
      }

      const occurrences = Number.parseInt(recurrenceForm.occurrences, 10);

      if (Number.isNaN(occurrences) || occurrences < 1 || occurrences > 370) {
        toast({
          title: 'Quantidade invalida',
          description: 'Informe entre 1 e 370 sessoes para este atendimento recorrente.',
          variant: 'destructive',
        });
        return;
      }

      if ((recurrenceForm.endDate && recurrenceForm.endDate < recurrenceForm.startDate) || endsAt <= startsAt) {
        toast({
          title: 'Periodo invalido',
          description: 'Confira a data final e o horario de termino do atendimento.',
          variant: 'destructive',
        });
        return;
      }

      createRecurrenceMutation.mutate();
    },
    submitAssignCategories: rosterVm.submitAssignCategories,
    openReserveSlot: reservationVm.openReserveSlot,
    openSlotDetails(slot: {
      id: string;
      professionalId: string;
      startsAt?: string;
      endsAt?: string;
      status?:
      | 'AVAILABLE'
      | 'PRE_RESERVED'
      | 'RESERVED'
      | 'COMPLETED'
      | 'NO_SHOW'
      | 'BLOCKED';
      payment?: {
        reference: string;
        linkId: string;
        linkUrl: string;
        amount: number;
        billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
        status: 'PENDING' | 'PAID';
        expiresAt?: string;
        confirmedAt?: string;
      };
      reservedFor?: {
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
        categoryId?: string;
        categoryName?: string;
        notes?: string;
        isOnline?: boolean;
        meetingProvider?: 'GOOGLE_MEET';
        meetingUrl?: string;
      };
      reservedAt?: string;
      customPrice?: number | null;
    }) {
      setSelectedSlotDetails(slot);
      setEditReservationForm({
        contactId: slot.reservedFor?.contactId ?? 'none',
        categoryId: slot.reservedFor?.categoryId ?? 'none',
        notes: slot.reservedFor?.notes ?? '',
      });
      setRescheduleReservationForm({
        targetDate: selectedDate,
        targetSlotId: '',
      });
      setSlotDetailsOpen(true);
    },
    submitReserveSlot: reservationVm.submitReserveSlot,
    blockSlot(slotId: string) {
      updateSlotMutation.mutate({ slotId, action: 'BLOCK' });
    },
    unblockSlot(slotId: string) {
      updateSlotMutation.mutate({ slotId, action: 'UNBLOCK' });
    },
    cancelReservation(slotId: string) {
      updateSlotMutation.mutate({ slotId, action: 'CANCEL_RESERVATION' });
    },
    updateReservation(slotId: string) {
      updateSlotMutation.mutate({
        slotId,
        action: 'UPDATE_RESERVATION',
        contactId:
          editReservationForm.contactId !== 'none' ? editReservationForm.contactId : undefined,
        categoryId:
          editReservationForm.categoryId !== 'none'
            ? editReservationForm.categoryId
            : undefined,
        notes: editReservationForm.notes.trim() || undefined,
      });
    },
    markReservationCompleted(slotId: string) {
      updateSlotMutation.mutate({
        slotId,
        action: 'MARK_COMPLETED',
        notes: editReservationForm.notes.trim() || undefined,
      });
    },
    markReservationNoShow(slotId: string) {
      updateSlotMutation.mutate({
        slotId,
        action: 'MARK_NO_SHOW',
        notes: editReservationForm.notes.trim() || undefined,
      });
    },
    openRescheduleReservation() {
      setRescheduleReservationForm({
        targetDate: selectedDate,
        targetSlotId: '',
      });
      setRescheduleReservationOpen(true);
    },
    submitRescheduleReservation() {
      if (!selectedSlotDetails) {
        return;
      }

      if (!rescheduleReservationForm.targetSlotId) {
        toast({
          title: 'Escolha um novo horário',
          description: 'Selecione o slot de destino para concluir a remarcação.',
          variant: 'destructive',
        });
        return;
      }

      rescheduleReservationMutation.mutate();
    },
  };
}

export type SchedulingPageViewModel = ReturnType<typeof useSchedulingPageViewModel>;
