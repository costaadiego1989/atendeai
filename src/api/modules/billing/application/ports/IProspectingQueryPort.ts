/**
 * Outbound port for prospecting quota checks needed by the billing module.
 * Billing uses this port to query prospecting usage data
 * without directly querying the prospecting_schema.
 */
export interface IProspectingQueryPort {
  countDailySearches(
    tenantId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<number>;
}

export const BILLING_PROSPECTING_QUERY_PORT = Symbol(
  'BILLING_PROSPECTING_QUERY_PORT',
);
