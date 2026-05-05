import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  TwilioAccountCredentials,
  TwilioManagementAcl,
} from '../../infrastructure/acl/TwilioManagementAcl';

export interface TenantTwilioAccount {
  tenantId: string;
  accountSid: string;
  authToken: string;
  status: string;
  friendlyName: string;
}

@Injectable()
export class TenantTwilioAccountService {
  private readonly logger = new Logger(TenantTwilioAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioManagementAcl: TwilioManagementAcl,
  ) {}

  async findByTenantId(tenantId: string): Promise<TenantTwilioAccount | null> {
    await this.ensureSchema();

    const [row] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        tenant_id,
        account_sid,
        auth_token,
        status,
        friendly_name
      FROM tenant_schema.tenant_twilio_accounts
      WHERE tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);

    return row ? this.mapRow(row) : null;
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
    await this.ensureSchema();

    const existing = await this.findByTenantId(input.tenantId);
    if (existing) {
      return existing;
    }

    const friendlyName = `AtendeAi ${input.companyName} ${input.tenantId}`.slice(0, 64);
    const account = await this.twilioManagementAcl.createSubaccount(
      { friendlyName },
      { tenantId: input.tenantId },
    );

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO tenant_schema.tenant_twilio_accounts (
        tenant_id,
        account_sid,
        auth_token,
        status,
        friendly_name,
        created_at,
        updated_at
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${account.sid},
        ${account.authToken},
        ${account.status},
        ${account.friendlyName ?? friendlyName},
        NOW(),
        NOW()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        account_sid = EXCLUDED.account_sid,
        auth_token = EXCLUDED.auth_token,
        status = EXCLUDED.status,
        friendly_name = EXCLUDED.friendly_name,
        updated_at = NOW()
    `);

    this.logger.log(`Twilio subaccount provisioned for tenant ${input.tenantId}`);

    return {
      tenantId: input.tenantId,
      accountSid: account.sid,
      authToken: account.authToken,
      status: account.status,
      friendlyName: account.friendlyName ?? friendlyName,
    };
  }

  toCredentials(account: TenantTwilioAccount): TwilioAccountCredentials {
    return {
      accountSid: account.accountSid,
      authToken: account.authToken,
    };
  }

  private async ensureSchema(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS tenant_schema.tenant_twilio_accounts (
        tenant_id UUID PRIMARY KEY,
        account_sid VARCHAR(34) NOT NULL UNIQUE,
        auth_token TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        friendly_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tenant_twilio_accounts_tenant_id_fkey
          FOREIGN KEY (tenant_id)
          REFERENCES tenant_schema.tenants(id)
          ON DELETE CASCADE
      )
    `);
  }

  private mapRow(row: any): TenantTwilioAccount {
    return {
      tenantId: row.tenant_id,
      accountSid: row.account_sid,
      authToken: row.auth_token,
      status: row.status,
      friendlyName: row.friendly_name,
    };
  }
}
