import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IGoogleAdsConnectionRepository } from '../../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsConnection } from '../../../domain/types/GoogleAdsConnection';

@Injectable()
export class PrismaGoogleAdsConnectionRepository
  implements IGoogleAdsConnectionRepository {
  constructor(private readonly prisma: PrismaService) { }

  private async ensureTable(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS prospecting_schema.google_ads_connections (
        tenant_id UUID PRIMARY KEY,
        google_email VARCHAR(255),
        refresh_token TEXT NOT NULL,
        status VARCHAR(40) NOT NULL,
        customer_id VARCHAR(32),
        customer_name VARCHAR(255),
        login_customer_id VARCHAR(32),
        connected_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
  }

  async save(connection: GoogleAdsConnection): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO prospecting_schema.google_ads_connections (
          tenant_id, google_email, refresh_token, status, customer_id, customer_name,
          login_customer_id, connected_at, updated_at
        ) VALUES (
          ${connection.tenantId}::uuid, ${connection.googleEmail ?? null}, ${connection.refreshToken}, ${connection.status}, ${connection.customerId ?? null}, ${connection.customerName ?? null}, ${connection.loginCustomerId ?? null}, ${connection.connectedAt}::timestamptz, ${connection.updatedAt}::timestamptz
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          google_email = EXCLUDED.google_email,
          refresh_token = EXCLUDED.refresh_token,
          status = EXCLUDED.status,
          customer_id = EXCLUDED.customer_id,
          customer_name = EXCLUDED.customer_name,
          login_customer_id = EXCLUDED.login_customer_id,
          connected_at = EXCLUDED.connected_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findByTenantId(tenantId: string): Promise<GoogleAdsConnection | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.google_ads_connections
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      googleEmail: row.google_email ?? undefined,
      refreshToken: row.refresh_token,
      status: row.status,
      customerId: row.customer_id ?? undefined,
      customerName: row.customer_name ?? undefined,
      loginCustomerId: row.login_customer_id ?? undefined,
      connectedAt: new Date(row.connected_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async deleteByTenantId(tenantId: string): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM prospecting_schema.google_ads_connections
        WHERE tenant_id = ${tenantId}::uuid
      `);
  }
}
