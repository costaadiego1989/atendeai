import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ITenantTwilioAccountRepository,
  TENANT_TWILIO_ACCOUNT_REPOSITORY,
  TenantTwilioAccount,
} from '../../domain/repositories/ITenantTwilioAccountRepository';
import {
  TwilioAccountCredentials,
  TwilioManagementAcl,
} from '../../infrastructure/acl/TwilioManagementAcl';

export { TenantTwilioAccount };

@Injectable()
export class TenantTwilioAccountService {
  private readonly logger = new Logger(TenantTwilioAccountService.name);

  constructor(
    @Inject(TENANT_TWILIO_ACCOUNT_REPOSITORY)
    private readonly repository: ITenantTwilioAccountRepository,
    private readonly twilioManagementAcl: TwilioManagementAcl,
  ) {}

  async findByTenantId(tenantId: string): Promise<TenantTwilioAccount | null> {
    return this.repository.findByTenantId(tenantId);
  }

  async ensureTenantAccount(input: {
    tenantId: string;
    companyName: string;
  }): Promise<TenantTwilioAccount> {
    const existing = await this.findByTenantId(input.tenantId);
    if (existing) {
      return existing;
    }

    return this.provisionTenantSubaccount(input);
  }

  async provisionTenantSubaccount(input: {
    tenantId: string;
    companyName: string;
  }): Promise<TenantTwilioAccount> {
    const existing = await this.findByTenantId(input.tenantId);
    if (existing) {
      return existing;
    }

    const friendlyName =
      `AtendeAi ${input.companyName} ${input.tenantId}`.slice(0, 64);
    const account = await this.twilioManagementAcl.createSubaccount(
      { friendlyName },
      { tenantId: input.tenantId },
    );

    const provisioned: TenantTwilioAccount = {
      tenantId: input.tenantId,
      accountSid: account.sid,
      authToken: account.authToken,
      status: account.status,
      friendlyName: account.friendlyName ?? friendlyName,
    };

    await this.repository.upsert(provisioned);

    this.logger.log(
      `Twilio subaccount provisioned for tenant ${input.tenantId}`,
    );

    return provisioned;
  }

  toCredentials(account: TenantTwilioAccount): TwilioAccountCredentials {
    return {
      accountSid: account.accountSid,
      authToken: account.authToken,
    };
  }
}
