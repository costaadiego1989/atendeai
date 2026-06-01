import { useEffect, useMemo, useState } from 'react';
import type { SchedulingPageViewModel } from './useSchedulingPageViewModel';
import { formatRecurrenceDateRange } from './scheduling-formatters';

type Recurrence = SchedulingPageViewModel['recurrences'][number];
type Slot = SchedulingPageViewModel['availabilitySlots'][number];

const SLOTS_PAGE_SIZE = 12;

const RESERVED_STATUSES: ReadonlyArray<Slot['status']> = [
  'RESERVED',
  'PRE_RESERVED',
  'COMPLETED',
  'NO_SHOW',
];

function isReservedSlot(slot: Slot) {
  return RESERVED_STATUSES.includes(slot.status);
}

export function useSchedulingProfessionalsTabViewModel(vm: SchedulingPageViewModel) {
  const [slotsDayTab, setSlotsDayTab] = useState<'open' | 'reserved'>('open');
  const [scheduleMode, setScheduleMode] = useState<'day' | 'recurring'>('day');
  const [selectedRecurrence, setSelectedRecurrence] = useState<Recurrence | null>(null);
  const [reservedSearch, setReservedSearch] = useState('');
  const [openSlotsVisible, setOpenSlotsVisible] = useState(SLOTS_PAGE_SIZE);
  const [reservedSlotsVisible, setReservedSlotsVisible] = useState(SLOTS_PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    vm.syncAvailabilityDraftFromLoaded();
  }, [vm.selectedProfessionalId, vm.selectedDate, vm.availabilitySlots.length]);

  useEffect(() => {
    setSlotsDayTab('open');
    setReservedSearch('');
    setOpenSlotsVisible(SLOTS_PAGE_SIZE);
    setReservedSlotsVisible(SLOTS_PAGE_SIZE);
  }, [vm.selectedProfessionalId, vm.selectedDate]);

  const isRangeView = vm.calendarView !== 'day';

  const openSlots = useMemo(
    () => vm.availabilitySlots.filter((slot) => !isReservedSlot(slot)),
    [vm.availabilitySlots],
  );

  const reservedSlots = useMemo(
    () => vm.availabilitySlots.filter((slot) => isReservedSlot(slot)),
    [vm.availabilitySlots],
  );

  const filteredReservedSlots = useMemo(() => {
    const query = reservedSearch.trim().toLowerCase();

    if (!query) {
      return reservedSlots;
    }

    return reservedSlots.filter((slot) => {
      const reservedFor = slot.reservedFor;
      return [
        reservedFor?.contactName,
        reservedFor?.contactPhone,
        reservedFor?.contactEmail,
        reservedFor?.categoryName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [reservedSlots, reservedSearch]);

  const activeRecurrences = useMemo(
    () => vm.recurrences.filter((recurrence) => recurrence.status === 'ACTIVE'),
    [vm.recurrences],
  );

  const generatedRecurrencesCount = useMemo(
    () =>
      vm.recurrences.reduce((total, recurrence) => total + recurrence.occurrencesCreated, 0),
    [vm.recurrences],
  );

  const nextRecurrenceDate = useMemo(
    () =>
      formatRecurrenceDateRange(
        activeRecurrences.find((recurrence) => recurrence.nextDate)?.nextDate ?? '',
      ),
    [activeRecurrences],
  );

  const rangeBreakdownByDate = useMemo(() => {
    const breakdown: Record<string, { available: number; reserved: number; blocked: number }> = {};

    for (const entry of vm.calendarRange) {
      breakdown[entry.date] = {
        available: entry.slots.filter((slot) => slot.status === 'AVAILABLE').length,
        reserved: entry.slots.filter(
          (slot) => slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED',
        ).length,
        blocked: entry.slots.filter((slot) => slot.status === 'BLOCKED').length,
      };
    }

    return breakdown;
  }, [vm.calendarRange]);

  const rangeTotals = useMemo(
    () =>
      vm.calendarRange.reduce(
        (accumulator, entry) => {
          accumulator.total += entry.slots.length;
          accumulator.available += entry.slots.filter(
            (slot) => slot.status === 'AVAILABLE',
          ).length;
          accumulator.reserved += entry.slots.filter((slot) =>
            isReservedSlot(slot),
          ).length;
          accumulator.blocked += entry.slots.filter(
            (slot) => slot.status === 'BLOCKED',
          ).length;
          return accumulator;
        },
        { total: 0, available: 0, reserved: 0, blocked: 0 },
      ),
    [vm.calendarRange],
  );

  const selectedRecurrenceContact = selectedRecurrence?.contactId
    ? vm.contacts.find((contact) => contact.id === selectedRecurrence.contactId) ?? null
    : null;

  const selectedRecurrenceCategory = selectedRecurrence?.categoryId
    ? vm.categories.find((category) => category.id === selectedRecurrence.categoryId) ?? null
    : null;

  function requestDeleteRecurrence(recurrenceId: string) {
    setConfirmDeleteId(recurrenceId);
  }

  function cancelDeleteRecurrence() {
    setConfirmDeleteId(null);
  }

  function confirmDeleteRecurrence() {
    if (!confirmDeleteId) {
      return;
    }

    vm.deleteRecurrenceMutation.mutate(confirmDeleteId, {
      onSuccess: () => {
        setSelectedRecurrence(null);
        setConfirmDeleteId(null);
      },
    });
  }

  return {
    slotsDayTab,
    setSlotsDayTab,
    scheduleMode,
    setScheduleMode,
    selectedRecurrence,
    setSelectedRecurrence,
    reservedSearch,
    setReservedSearch,
    openSlotsVisible,
    setOpenSlotsVisible,
    reservedSlotsVisible,
    setReservedSlotsVisible,
    slotsPageSize: SLOTS_PAGE_SIZE,
    isRangeView,
    openSlots,
    reservedSlots,
    filteredReservedSlots,
    activeRecurrences,
    generatedRecurrencesCount,
    nextRecurrenceDate,
    rangeTotals,
    rangeBreakdownByDate,
    selectedRecurrenceContact,
    selectedRecurrenceCategory,
    confirmDeleteId,
    requestDeleteRecurrence,
    cancelDeleteRecurrence,
    confirmDeleteRecurrence,
  };
}
