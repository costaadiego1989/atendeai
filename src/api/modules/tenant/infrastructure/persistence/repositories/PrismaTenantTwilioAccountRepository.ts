import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ITenantTwilioAccountRepository,
  TenantTwilioAccount,
} from '../../../domain/repositories/ITenantTwilioAccountRepository';
import { encrypt, decrypt } from '@shared/crypto/field-encryption';

function isEncrypted(v: string): boolean {
  return (v.match(/:/g) ?? []).length === 2;
}

@Injectable()
export class PrismaTenantTwilioAccountRepository implements ITenantTwilioAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantTwilioAccount | null> {
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

  async upsert(account: TenantTwilioAccount): Promise<void> {
    const encryptedToken = encrypt(account.authToken);
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
        ${account.tenantId}::uuid,
        ${account.accountSid},
        ${encryptedToken},
        ${account.status},
        ${account.friendlyName},
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
  }

  private mapRow(row: any): TenantTwilioAccount {
    const raw: string = row.auth_token;
    const authToken = isEncrypted(raw) ? decrypt(raw) : raw;
    return {
      tenantId: row.tenant_id,
      accountSid: row.account_sid,
      authToken,
      status: row.status,
      friendlyName: row.friendly_name,
    };
  }
}
