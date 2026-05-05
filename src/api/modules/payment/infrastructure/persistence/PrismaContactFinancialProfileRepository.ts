import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ContactFinancialProfileRecord,
  IContactFinancialProfileRepository,
} from '../../domain/repositories/IContactFinancialProfileRepository';

@Injectable()
export class PrismaContactFinancialProfileRepository
  implements IContactFinancialProfileRepository
{
  private ensured = false;

  constructor(private readonly prisma: PrismaService) {}

  async findByTenantAndContact(
    tenantId: string,
    contactId: string,
  ): Promise<ContactFinancialProfileRecord | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        contact_id: string;
        provider: 'ASAAS';
        asaas_customer_id: string;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          contact_id,
          provider,
          asaas_customer_id,
          created_at,
          updated_at
        FROM contact_schema.contact_financial_profiles
        WHERE tenant_id = ${tenantId}::uuid
          AND contact_id = ${contactId}::uuid
        LIMIT 1
      `);

    const raw = rows[0];
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      contactId: raw.contact_id,
      provider: raw.provider,
      asaasCustomerId: raw.asaas_customer_id,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  async save(
    record: Omit<ContactFinancialProfileRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<ContactFinancialProfileRecord> {
    await this.ensureTable();
    const id = record.id || randomUUID();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        contact_id: string;
        provider: 'ASAAS';
        asaas_customer_id: string;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        INSERT INTO contact_schema.contact_financial_profiles (
          id,
          tenant_id,
          contact_id,
          provider,
          asaas_customer_id
        )
        VALUES (
          ${id}::uuid,
          ${record.tenantId}::uuid,
          ${record.contactId}::uuid,
          ${record.provider},
          ${record.asaasCustomerId}
        )
        ON CONFLICT (tenant_id, contact_id) DO UPDATE SET
          provider = EXCLUDED.provider,
          asaas_customer_id = EXCLUDED.asaas_customer_id,
          updated_at = NOW()
        RETURNING
          id,
          tenant_id,
          contact_id,
          provider,
          asaas_customer_id,
          created_at,
          updated_at
      `);

    const raw = rows[0];
    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      contactId: raw.contact_id,
      provider: raw.provider,
      asaasCustomerId: raw.asaas_customer_id,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  private async ensureTable(): Promise<void> {
    if (this.ensured) {
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS contact_schema.contact_financial_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES contact_schema.contacts(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL DEFAULT 'ASAAS',
        asaas_customer_id VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_contact_financial_profiles_tenant_contact UNIQUE (tenant_id, contact_id)
      )
    `);

    this.ensured = true;
  }
}
