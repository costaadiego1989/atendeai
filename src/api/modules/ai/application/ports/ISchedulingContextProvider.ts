export interface ISchedulingContextProvider {
  findRelevantAvailability(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null>;
}

export const SCHEDULING_CONTEXT_PROVIDER = Symbol(
  'SCHEDULING_CONTEXT_PROVIDER',
);
