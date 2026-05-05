import { useState } from 'react';
import {
  getDefaultProfessionalPhone,
  isoToday,
} from './scheduling-view-model-helpers';

export type SchedulingSelectedSlot = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
};

export type SchedulingSelectedSlotDetails = {
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
} | null;

export function useSchedulingPageState(userPhone?: string | null) {
  const [activeTab, setActiveTab] = useState<'professionals' | 'categories'>('professionals');
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createProfessionalOpen, setCreateProfessionalOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [assignCategoriesOpen, setAssignCategoriesOpen] = useState(false);
  const [reserveSlotOpen, setReserveSlotOpen] = useState(false);
  const [bulkSlotGeneratorOpen, setBulkSlotGeneratorOpen] = useState(false);
  const [slotDetailsOpen, setSlotDetailsOpen] = useState(false);
  const [rescheduleReservationOpen, setRescheduleReservationOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [reserveContactSearch, setReserveContactSearch] = useState('');
  const [availabilityDraft, setAvailabilityDraft] = useState([
    { startsAt: '09:00', endsAt: '09:30', label: '', customPrice: '', isOnline: false },
  ]);
  const [selectedSlot, setSelectedSlot] = useState<SchedulingSelectedSlot | null>(null);
  const [selectedSlotDetails, setSelectedSlotDetails] =
    useState<SchedulingSelectedSlotDetails>(null);
  const [selectedProfessionalForAssignment, setSelectedProfessionalForAssignment] =
    useState<string | null>(null);
  const [selectedAssignmentCategoryIds, setSelectedAssignmentCategoryIds] = useState<string[]>([]);
  const [createProfessionalForm, setCreateProfessionalForm] = useState({
    name: '',
    phone: getDefaultProfessionalPhone(userPhone),
  });
  const [createCategoryForm, setCreateCategoryForm] = useState({
    name: '',
    unit: 'PER_MINUTE' as 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION',
    durationMinutes: '30',
    basePrice: '',
  });
  const [bulkSlotGeneratorForm, setBulkSlotGeneratorForm] = useState({
    professionalId: '',
    categoryId: 'none',
    startDate: isoToday(),
    endDate: isoToday(),
    dayStartsAt: '09:00',
    dayEndsAt: '18:00',
    slotDurationMinutes: '30',
  });
  const [reserveForm, setReserveForm] = useState({
    contactId: 'none',
    categoryId: 'none',
    isFree: false,
    isOnline: false,
    paymentTimeoutHours: '3',
    notes: '',
  });
  const [recurrenceForm, setRecurrenceForm] = useState({
    professionalId: '',
    contactId: 'none',
    categoryId: 'none',
    startDate: isoToday(),
    endDate: isoToday(),
    occurrences: '4',
    startsAt: '09:00',
    endsAt: '09:30',
    frequency: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    interval: '1',
    isFree: true,
    isOnline: false,
    paymentTimeoutHours: '3',
    notes: '',
  });
  const [editReservationForm, setEditReservationForm] = useState({
    contactId: 'none',
    categoryId: 'none',
    notes: '',
  });
  const [rescheduleReservationForm, setRescheduleReservationForm] = useState({
    targetDate: isoToday(),
    targetSlotId: '',
  });
  const [reportFilters, setReportFilters] = useState({
    startDate: isoToday(),
    endDate: isoToday(),
    professionalIds: [] as string[],
    categoryIds: [] as string[],
    statuses: [] as Array<'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED'>,
  });

  return {
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
    reportsOpen,
    setReportsOpen,
    recurrenceOpen,
    setRecurrenceOpen,
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
  };
}
