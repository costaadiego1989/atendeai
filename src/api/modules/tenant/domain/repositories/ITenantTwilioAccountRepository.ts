export interface TenantTwilioAccount {
  tenantId: string;
  accountSid: string;
  authToken: string;
  status: string;
  friendlyName: string;
}

export interface ITenantTwilioAccountRepository {
  findByTenantId(tenantId: string): Promise<TenantTwilioAccount | null>;
  upsert(account: TenantTwilioAccount): Promise<void>;
}

export const TENANT_TWILIO_ACCOUNT_REPOSITORY = Symbol(
  'TENANT_TWILIO_ACCOUNT_REPOSITORY',
);
