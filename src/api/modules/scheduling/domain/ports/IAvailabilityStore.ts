import {
  AvailabilitySlotRecord,
  CategoryAvailabilityRecord,
  SchedulingCategoryRecord,
  SchedulingCategoryUnit,
  SchedulingProfessionalRecord,
} from './ISchedulingStore';

export interface IAvailabilityStore {
  createProfessional(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    phone?: string;
    role?: string;
  }): Promise<SchedulingProfessionalRecord>;
  listProfessionals(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]>;
  createCategory(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    unit: SchedulingCategoryUnit;
    durationMinutes?: number;
    basePrice?: number;
  }): Promise<SchedulingCategoryRecord>;
  listCategories(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]>;
  assignCategoriesToProfessional(input: {
    tenantId: string;
    professionalId: string;
    categoryIds: string[];
  }): Promise<string[]>;
  listProfessionalsByCategory(
    tenantId: string,
    categoryId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]>;
  saveAvailability(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slots: Array<{
      startsAt: string;
      endsAt: string;
      label?: string;
      customPrice?: number;
      isOnline?: boolean;
    }>;
  }): Promise<AvailabilitySlotRecord[]>;
  listAvailability(
    tenantId: string,
    professionalId: string,
    date: string,
  ): Promise<AvailabilitySlotRecord[]>;
  getAvailabilitySlot(
    tenantId: string,
    professionalId: string,
    date: string,
    slotId: string,
  ): Promise<AvailabilitySlotRecord | null>;
  listAvailabilityByCategory(
    tenantId: string,
    categoryId: string,
    date: string,
    branchId?: string | null,
  ): Promise<CategoryAvailabilityRecord[]>;
}

export const AVAILABILITY_STORE = Symbol('AVAILABILITY_STORE');
