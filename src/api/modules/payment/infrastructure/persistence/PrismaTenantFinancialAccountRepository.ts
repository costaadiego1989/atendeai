import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ITenantFinancialAccountRepository,
  TenantFinancialAccountRecord,
} from '../../domain/repositories/ITenantFinancialAccountRepository';

@Injectable()
export class PrismaTenantFinancialAccountRepository
  implements ITenantFinancialAccountRepository
{
  private ensured = false;

  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(
    tenantId: string,
  ): Promise<TenantFinancialAccountRecord | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        provider: 'ASAAS';
        asaas_account_id: string;
        wallet_id: string;
        status: string;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          provider,
          asaas_account_id,
          wallet_id,
          status,
          created_at,
          updated_at
        FROM tenant_schema.tenant_financial_accounts
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

    const raw = rows[0];
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      provider: raw.provider,
      asaasAccountId: raw.asaas_account_id,
      walletId: raw.wallet_id,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  async save(
    record: Omit<TenantFinancialAccountRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<TenantFinancialAccountRecord> {
    await this.ensureTable();
    const id = record.id || randomUUID();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        provider: 'ASAAS';
        asaas_account_id: string;
        wallet_id: string;
        status: string;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        INSERT INTO tenant_schema.tenant_financial_accounts (
          id,
          tenant_id,
          provider,
          asaas_account_id,
          wallet_id,
          status
        )
        VALUES (
          ${id}::uuid,
          ${record.tenantId}::uuid,
          ${record.provider},
          ${record.asaasAccountId},
          ${record.walletId},
          ${record.status}
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          provider = EXCLUDED.provider,
          asaas_account_id = EXCLUDED.asaas_account_id,
          wallet_id = EXCLUDED.wallet_id,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING
          id,
          tenant_id,
          provider,
          asaas_account_id,
          wallet_id,
          status,
          created_at,
          updated_at
      `);

    const raw = rows[0];
    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      provider: raw.provider,
      asaasAccountId: raw.asaas_account_id,
      walletId: raw.wallet_id,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  private async ensureTable(): Promise<void> {
    if (this.ensured) {
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS tenant_schema.tenant_financial_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL DEFAULT 'ASAAS',
        asaas_account_id VARCHAR(80) NOT NULL,
        wallet_id VARCHAR(80) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    this.ensured = true;
  }
}
