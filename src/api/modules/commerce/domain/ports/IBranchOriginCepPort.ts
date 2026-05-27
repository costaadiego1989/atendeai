/**
 * Port for resolving the origin CEP (postal code) for carrier shipping quotes.
 * The implementation will look up the branch address or fall back to tenant address.
 */
export interface IBranchOriginCepPort {
  /**
   * Returns the origin CEP for a given branch (or tenant fallback).
   * Returns null if no CEP is configured.
   */
  getOriginCep(
    tenantId: string,
    branchId: string | null,
  ): Promise<string | null>;
}

export const BRANCH_ORIGIN_CEP_PORT = Symbol('BRANCH_ORIGIN_CEP_PORT');
