export interface ICommercialContextProvider {
  findRelevantOffer(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null>;
}

export const COMMERCIAL_CONTEXT_PROVIDER = 'COMMERCIAL_CONTEXT_PROVIDER';
