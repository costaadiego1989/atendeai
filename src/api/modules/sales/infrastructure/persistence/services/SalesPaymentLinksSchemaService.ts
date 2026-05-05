import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/database/PrismaService';

@Injectable()
export class SalesPaymentLinksSchemaService {
  private columnsEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  async ensureColumns(): Promise<void> {
    if (this.columnsEnsured) {
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE sales_schema.payment_links
      ALTER COLUMN external_id TYPE VARCHAR(120)
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE sales_schema.payment_links
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS label VARCHAR(120),
      ADD COLUMN IF NOT EXISTS provider_link_id VARCHAR(80),
      ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'PIX',
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
      ADD COLUMN IF NOT EXISTS resource_type VARCHAR(20) NOT NULL DEFAULT 'PAYMENT_LINK',
      ADD COLUMN IF NOT EXISTS branch_id UUID,
      ADD COLUMN IF NOT EXISTS contact_id UUID,
      ADD COLUMN IF NOT EXISTS conversation_id UUID,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20),
      ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
      ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
      ADD COLUMN IF NOT EXISTS recurrence_total_value NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS recurrence_next_run_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS catalog_item_id UUID,
      ADD COLUMN IF NOT EXISTS catalog_item_sku VARCHAR(80),
      ADD COLUMN IF NOT EXISTS catalog_item_name VARCHAR(255)
    `);

    this.columnsEnsured = true;
  }
}
