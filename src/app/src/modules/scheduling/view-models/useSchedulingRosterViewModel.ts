import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import {
  getDatesBetween,
  getOperatingDayKey,
  minutesToTime,
  sortSlots,
  timeToMinutes,
} from './scheduling-date-utils';

type TenantOperatingHours = Record<
  string,
  | {
    open?: string;
    close?: string;
    closed?: boolean;
  }
  | undefined
>;

type Category = {
  id: string;
  name: string;
  durationMinutes?: number | null;
  basePrice?: number | null;
};

type Professional = {
  id: string;
  name: string;
};

type ProfessionalCategoryMap = Record<string, Array<{ id: string; name: string }>>;

type AvailabilityDraftItem = {
  startsAt: string;
  endsAt: string;
  label: string;
  customPrice: string;
  isOnline?: boolean;
};

type BulkSlotGeneratorForm = {
  professionalId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  dayStartsAt: string;
  dayEndsAt: string;
  slotDurationMinutes: string;
};

type Args = {
  tenantId?: string;
  tenantOperatingHours?: TenantOperatingHours;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedProfessionalId: string | null;
  setSelectedProfessionalId: (id: string) => void;
  setCalendarView: (view: 'day' | 'week' | 'month') => void;
  availabilityDraft: AvailabilityDraftItem[];
  setAvailabilityDraft: Dispatch<SetStateAction<AvailabilityDraftItem[]>>;
  availabilitySlots: Array<{
    startsAt?: string;
    startTime?: string;
    endsAt?: string;
    endTime?: string;
    label?: string;
    customPrice?: number | null;
  }>;
  professionals: Professional[];
  categories: Category[];
  professionalCategoryMap: ProfessionalCategoryMap;
  categoryAssignmentsData?: Record<string, string[]>;
  selectedProfessionalForAssignment: string | null;
  setSelectedProfessionalForAssignment: (id: string | null) => void;
  selectedAssignmentCategoryIds: string[];
  setSelectedAssignmentCategoryIds: Dispatch<SetStateAction<string[]>>;
  assignCategoriesOpen: boolean;
  setAssignCategoriesOpen: (open: boolean) => void;
  bulkSlotGeneratorOpen: boolean;
  setBulkSlotGeneratorOpen: (open: boolean) => void;
  bulkSlotGeneratorForm: BulkSlotGeneratorForm;
  setBulkSlotGeneratorForm: Dispatch<SetStateAction<BulkSlotGeneratorForm>>;
};

export function useSchedulingRosterViewModel({
  tenantId,
  tenantOperatingHours,
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
  categoryAssignmentsData,
  selectedProfessionalForAssignment,
  setSelectedProfessionalForAssignment,
  selectedAssignmentCategoryIds,
  setSelectedAssignmentCategoryIds,
  setAssignCategoriesOpen,
  setBulkSlotGeneratorOpen,
  bulkSlotGeneratorForm,
  setBulkSlotGeneratorForm,
}: Args) {
  const queryClient = useQueryClient();
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const saveAvailabilityMutation = useMutation({
    mutationFn: () =>
      schedulingService.saveAvailability(tenantId!, selectedProfessionalId!, {
        date: selectedDate,
        slots: availabilityDraft
          .filter((slot) => slot.startsAt && slot.endsAt)
          .map((slot) => ({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            label: slot.label.trim() || undefined,
            customPrice: slot.customPrice ? Number.parseFloat(slot.customPrice) : undefined,
            isOnline: slot.isOnline,
          })),
      }),
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
      toast({
        title: 'Agenda salva',
        description: 'Os horários do dia foram atualizados com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar disponibilidade',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar a disponibilidade agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const generateBulkSlotsMutation = useMutation({
    mutationFn: async () => {
      const slotDuration = Number.parseInt(bulkSlotGeneratorForm.slotDurationMinutes, 10);
      const categoryForGeneration =
        categories.find((category) => category.id === bulkSlotGeneratorForm.categoryId) ?? null;
      const dates = getDatesBetween(
        bulkSlotGeneratorForm.startDate,
        bulkSlotGeneratorForm.endDate,
      );

      let generatedDays = 0;
      let generatedSlots = 0;
      let skippedDays = 0;

      setBulkProgress({ current: 0, total: dates.length });

      for (let dateIndex = 0; dateIndex < dates.length; dateIndex += 1) {
        const date = dates[dateIndex];
        setBulkProgress({ current: dateIndex + 1, total: dates.length });
        const operatingDayKey = getOperatingDayKey(date);
        const operatingDay = tenantOperatingHours?.[operatingDayKey];

        if (operatingDay?.closed) {
          skippedDays += 1;
          continue;
        }

        let startsAt = timeToMinutes(bulkSlotGeneratorForm.dayStartsAt);
        let endsAt = timeToMinutes(bulkSlotGeneratorForm.dayEndsAt);

        if (operatingDay?.open) {
          startsAt = Math.max(startsAt, timeToMinutes(operatingDay.open));
        }

        if (operatingDay?.close) {
          endsAt = Math.min(endsAt, timeToMinutes(operatingDay.close));
        }

        if (endsAt <= startsAt) {
          skippedDays += 1;
          continue;
        }

        const generatedSlotsForDay: Array<{
          startsAt: string;
          endsAt: string;
          label?: string;
          customPrice?: number;
        }> = [];

        for (let cursor = startsAt; cursor + slotDuration <= endsAt; cursor += slotDuration) {
          generatedSlotsForDay.push({
            startsAt: minutesToTime(cursor),
            endsAt: minutesToTime(cursor + slotDuration),
            label: categoryForGeneration?.name || undefined,
            customPrice: categoryForGeneration?.basePrice ?? undefined,
          });
        }

        if (!generatedSlotsForDay.length) {
          skippedDays += 1;
          continue;
        }

        const existingSlots = await schedulingService.getAvailability(
          tenantId!,
          bulkSlotGeneratorForm.professionalId,
          date,
        );

        const mergedSlots = new Map<
          string,
          {
            startsAt: string;
            endsAt: string;
            label?: string;
            customPrice?: number;
          }
        >();

        for (const slot of existingSlots) {
          const startsAt = slot.startsAt ?? slot.startTime ?? '';
          const endsAt = slot.endsAt ?? slot.endTime ?? '';
          const key = `${startsAt}-${endsAt}`;

          mergedSlots.set(key, {
            startsAt,
            endsAt,
            label: slot.label ?? undefined,
            customPrice: slot.customPrice ?? undefined,
          });
        }

        for (const slot of generatedSlotsForDay) {
          const key = `${slot.startsAt}-${slot.endsAt}`;

          if (!mergedSlots.has(key)) {
            mergedSlots.set(key, slot);
          }
        }

        await schedulingService.saveAvailability(tenantId!, bulkSlotGeneratorForm.professionalId, {
          date,
          slots: sortSlots(Array.from(mergedSlots.values())).map((slot) => ({
            startsAt: slot.startsAt ?? '',
            endsAt: slot.endsAt ?? '',
            label: slot.label,
            customPrice: slot.customPrice,
          })),
        });

        generatedDays += 1;
        generatedSlots += generatedSlotsForDay.length;
      }

      return { generatedDays, generatedSlots, skippedDays };
    },
    onSuccess: async (result) => {
      setBulkProgress(null);
      setSelectedProfessionalId(bulkSlotGeneratorForm.professionalId);
      setSelectedDate(bulkSlotGeneratorForm.startDate);
      setCalendarView('day');

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-availability', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-calendar-range', tenantId],
          exact: false,
        }),
        queryClient.refetchQueries({
          queryKey: [
            'scheduling-availability',
            tenantId,
            bulkSlotGeneratorForm.professionalId,
            bulkSlotGeneratorForm.startDate,
          ],
          exact: true,
        }),
      ]);

      setBulkSlotGeneratorOpen(false);
      toast({
        title: 'Slots gerados',
        description:
          result.skippedDays > 0
            ? `${result.generatedSlots} slots distribuidos em ${result.generatedDays} dias. ${result.skippedDays} dias foram pulados por estarem fora do horário de funcionamento.`
            : `${result.generatedSlots} slots distribuidos em ${result.generatedDays} dias com sucesso.`,
      });
    },
    onError: (error) => {
      setBulkProgress((current) => {
        const completedDays = current ? Math.max(current.current - 1, 0) : 0;

        toast({
          title: 'Falha ao gerar slots',
          description: getFriendlyErrorMessage(error, {
            fallbackMessage:
              completedDays > 0
                ? `Geramos ${completedDays} dia(s) antes da falha. não foi possível concluir o restante agora.`
                : 'não foi possível gerar os slots em lote agora.',
          }),
          variant: 'destructive',
        });

        return null;
      });
    },
  });

  const assignCategoriesMutation = useMutation({
    mutationFn: () =>
      schedulingService.assignProfessionalCategories(
        tenantId!,
        selectedProfessionalForAssignment!,
        selectedAssignmentCategoryIds,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-professionals', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-assignments', tenantId],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['scheduling-category-availability', tenantId],
          exact: false,
        }),
      ]);
      setAssignCategoriesOpen(false);
      toast({
        title: 'Categorias vinculadas',
        description: 'Os serviços do profissional foram atualizados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao vincular categorias',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar as categorias agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const bulkGenerationProfessionalCategories = bulkSlotGeneratorForm.professionalId
    ? professionalCategoryMap[bulkSlotGeneratorForm.professionalId] ?? []
    : [];

  const selectedBulkGenerationProfessional =
    professionals.find((professional) => professional.id === bulkSlotGeneratorForm.professionalId) ??
    null;

  const selectedBulkGenerationCategory =
    categories.find((category) => category.id === bulkSlotGeneratorForm.categoryId) ?? null;

  const selectedProfessionalCategoryIds = useMemo(() => {
    if (!selectedProfessionalForAssignment || !categoryAssignmentsData) {
      return [];
    }

    return categories
      .filter((category) =>
        (categoryAssignmentsData[category.id] ?? []).includes(selectedProfessionalForAssignment),
      )
      .map((category) => category.id);
  }, [categories, categoryAssignmentsData, selectedProfessionalForAssignment]);

  function openAssignCategories(professionalId: string) {
    setSelectedProfessionalForAssignment(professionalId);
    setSelectedAssignmentCategoryIds(
      categories
        .filter((category) => (categoryAssignmentsData?.[category.id] ?? []).includes(professionalId))
        .map((category) => category.id),
    );
    setAssignCategoriesOpen(true);
  }

  function toggleAssignmentCategory(categoryId: string, checked: boolean) {
    setSelectedAssignmentCategoryIds((current) =>
      checked ? [...current, categoryId] : current.filter((id) => id !== categoryId),
    );
  }

  function addAvailabilityRow() {
    setAvailabilityDraft((current) => [
      ...current,
      { startsAt: '09:00', endsAt: '09:30', label: '', customPrice: '', isOnline: false },
    ]);
  }

  function updateAvailabilityRow(
    index: number,
    field: 'startsAt' | 'endsAt' | 'label' | 'customPrice' | 'isOnline',
    value: string | boolean,
  ) {
    setAvailabilityDraft((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [field]: value } : slot)),
    );
  }

  function removeAvailabilityRow(index: number) {
    setAvailabilityDraft((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  function syncAvailabilityDraftFromLoaded() {
    if (availabilitySlots.length) {
      setAvailabilityDraft(
        availabilitySlots.map((slot) => ({
          startsAt: slot.startsAt ?? slot.startTime ?? '',
          endsAt: slot.endsAt ?? slot.endTime ?? '',
          label: slot.label ?? '',
          customPrice: slot.customPrice?.toString() ?? '',
          isOnline: (slot as any).isOnline ?? false,
        })),
      );
    } else {
      setAvailabilityDraft([{ startsAt: '09:00', endsAt: '09:30', label: '', customPrice: '', isOnline: false }]);
    }
  }

  function saveAvailability() {
    if (!selectedProfessionalId) {
      toast({
        title: 'Selecione um profissional',
        description: 'Escolha um profissional antes de salvar a agenda do dia.',
        variant: 'destructive',
      });
      return;
    }

    if (!availabilityDraft.some((slot) => slot.startsAt && slot.endsAt)) {
      toast({
        title: 'Adicione pelo menos um horário',
        description: 'A agenda do dia precisa de um intervalo valido.',
        variant: 'destructive',
      });
      return;
    }

    saveAvailabilityMutation.mutate();
  }

  function openBulkSlotGenerator() {
    if (!selectedProfessionalId) {
      toast({
        title: 'Selecione um profissional',
        description: 'Escolha um profissional antes de gerar slots em lote.',
        variant: 'destructive',
      });
      return;
    }

    const operatingDay = tenantOperatingHours?.[getOperatingDayKey(selectedDate)];

    setBulkSlotGeneratorForm({
      professionalId: selectedProfessionalId,
      categoryId: professionalCategoryMap[selectedProfessionalId]?.[0]?.id ?? 'none',
      startDate: selectedDate,
      endDate: selectedDate,
      dayStartsAt: operatingDay?.closed ? '09:00' : operatingDay?.open ?? '09:00',
      dayEndsAt: operatingDay?.closed ? '18:00' : operatingDay?.close ?? '18:00',
      slotDurationMinutes: String(
        categories.find(
          (category) => category.id === professionalCategoryMap[selectedProfessionalId]?.[0]?.id,
        )?.durationMinutes ?? 30,
      ),
    });
    setBulkSlotGeneratorOpen(true);
  }

  function submitBulkSlotGeneration() {
    const slotDuration = Number.parseInt(bulkSlotGeneratorForm.slotDurationMinutes, 10);

    if (
      !bulkSlotGeneratorForm.startDate ||
      !bulkSlotGeneratorForm.endDate ||
      bulkSlotGeneratorForm.endDate < bulkSlotGeneratorForm.startDate
    ) {
      toast({
        title: 'Periodo invalido',
        description: 'Informe um intervalo valido para gerar a grade.',
        variant: 'destructive',
      });
      return;
    }

    if (
      !bulkSlotGeneratorForm.dayStartsAt ||
      !bulkSlotGeneratorForm.dayEndsAt ||
      timeToMinutes(bulkSlotGeneratorForm.dayEndsAt) <=
      timeToMinutes(bulkSlotGeneratorForm.dayStartsAt)
    ) {
      toast({
        title: 'horário invalido',
        description: 'O horário final precisa ser maior que o horário inicial.',
        variant: 'destructive',
      });
      return;
    }

    if (!bulkSlotGeneratorForm.professionalId) {
      toast({
        title: 'Selecione um profissional',
        description: 'Escolha quem vai receber essa grade de horários.',
        variant: 'destructive',
      });
      return;
    }

    if (!bulkGenerationProfessionalCategories.length) {
      toast({
        title: 'Vincule uma categoria primeiro',
        description:
          'Esse profissional precisa ter ao menos uma categoria vinculada antes de gerar slots.',
        variant: 'destructive',
      });
      return;
    }

    if (!bulkSlotGeneratorForm.categoryId || bulkSlotGeneratorForm.categoryId === 'none') {
      toast({
        title: 'Selecione a categoria',
        description:
          'Escolha qual categoria vinculada deve orientar a duração e a etiqueta dos slots.',
        variant: 'destructive',
      });
      return;
    }

    if (Number.isNaN(slotDuration) || slotDuration < 1) {
      toast({
        title: 'Duração invalida',
        description: 'Informe a duração de cada slot em minutos.',
        variant: 'destructive',
      });
      return;
    }

    generateBulkSlotsMutation.mutate();
  }

  function submitAssignCategories() {
    if (!selectedProfessionalForAssignment) {
      return;
    }

    assignCategoriesMutation.mutate();
  }

  return {
    saveAvailabilityMutation,
    generateBulkSlotsMutation,
    assignCategoriesMutation,
    bulkProgress,
    bulkGenerationProfessionalCategories,
    selectedBulkGenerationProfessional,
    selectedBulkGenerationCategory,
    selectedProfessionalCategoryIds,
    openAssignCategories,
    toggleAssignmentCategory,
    addAvailabilityRow,
    updateAvailabilityRow,
    removeAvailabilityRow,
    syncAvailabilityDraftFromLoaded,
    saveAvailability,
    openBulkSlotGenerator,
    submitBulkSlotGeneration,
    submitAssignCategories,
  };
}
