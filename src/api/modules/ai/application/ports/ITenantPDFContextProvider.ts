export interface ITenantPDFContextProvider {
  findRelevantPDFContext(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null>;
}

export const TENANT_PDF_CONTEXT_PROVIDER = Symbol(
  'TENANT_PDF_CONTEXT_PROVIDER',
);
