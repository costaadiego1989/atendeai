import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class TenantSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TenantSchemaBootstrapService.name);
  private bootstrapPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.run();
    }

    return this.bootstrapPromise;
  }

  private async run(): Promise<void> {
    this.logger.log(
      'Ensuring tenant compatibility schema for tenant, user, WhatsApp and Instagram tables.',
    );

    try {
      await this.prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS tenant_schema`);
      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.tenants
        ADD COLUMN IF NOT EXISTS owner_birth_date DATE,
        ADD COLUMN IF NOT EXISTS street_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS owner_user_id UUID
      `).catch(() => this.logger.warn('Table tenant_schema.tenants not ready for alter yet.'));

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.users
        ADD COLUMN IF NOT EXISTS cpf VARCHAR(14)
      `).catch(() => this.logger.warn('Table tenant_schema.users not ready for alter yet.'));

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.whatsapp_configs
        ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'BUBBLEWHATS'
      `).catch(() => this.logger.warn('Table tenant_schema.whatsapp_configs not ready for alter yet (step 1).'));

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.whatsapp_configs
        ADD COLUMN IF NOT EXISTS bubble_whats_api_key TEXT
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.whatsapp_configs
        ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}'::jsonb
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.whatsapp_configs
        ALTER COLUMN webhook_secret DROP NOT NULL
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tenant_schema.whatsapp_configs
        SET credentials = jsonb_build_object('token', bubble_whats_api_key)
        WHERE (credentials = '{}'::jsonb OR credentials IS NULL)
          AND bubble_whats_api_key IS NOT NULL
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`CREATE TABLE IF NOT EXISTS tenant_schema.instagram_configs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL UNIQUE, meta_access_token TEXT NOT NULL, instagram_account_id VARCHAR(255) NOT NULL, webhook_secret VARCHAR(255) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION', configured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT instagram_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE)`).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`CREATE TABLE IF NOT EXISTS tenant_schema.tenant_branches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, name VARCHAR(255) NOT NULL, phone VARCHAR(20), email VARCHAR(255), whatsapp_number VARCHAR(30), instagram_account_id VARCHAR(255), zipcode VARCHAR(20), street VARCHAR(255), street_number VARCHAR(30), neighborhood VARCHAR(255), city VARCHAR(120), state VARCHAR(10), is_headquarters BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT tenant_branches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE)`).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE tenant_schema.tenant_branches
        ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS instagram_account_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS whatsapp_provider VARCHAR(30),
        ADD COLUMN IF NOT EXISTS whatsapp_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS whatsapp_webhook_secret TEXT,
        ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20),
        ADD COLUMN IF NOT EXISTS operating_hours JSONB
      `).catch(() => { });

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
      `).catch(() => { });
    } catch (error) {
      this.logger.error('Critical failure during tenant compatibility schema bootstrap', error);
    }
  }
}
