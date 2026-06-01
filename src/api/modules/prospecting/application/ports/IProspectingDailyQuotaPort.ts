export interface IProspectingDailyQuotaPort {
  assertCanConsume(input: {
    tenantId: string;
    requested: number;
    now?: Date;
  }): Promise<{ used: number; quota: number; remaining: number }>;
}

export const PROSPECTING_DAILY_QUOTA_PORT = Symbol(
  'IProspectingDailyQuotaPort',
);
