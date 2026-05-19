export interface SchedulingCategoryInfo {
  id: string;
  name: string;
  durationMinutes: number | null;
  basePrice: number | null;
  unit: string | null;
}

export interface ISchedulingContextProvider {
  findRelevantAvailability(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null>;
  getSchedulingCategories(tenantId: string): Promise<SchedulingCategoryInfo[]>;
}

export const SCHEDULING_CONTEXT_PROVIDER = Symbol(
  'SCHEDULING_CONTEXT_PROVIDER',
);
