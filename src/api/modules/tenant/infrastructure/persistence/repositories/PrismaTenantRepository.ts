import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ITenantRepository,
  SaveTenantBranchInput,
} from '../../../domain/repositories/ITenantRepository.js';
import { Tenant } from '../../../domain/entities/Tenant.js';
import { TenantBranch } from '../../../domain/entities/TenantBranch.js';
import { PrismaService } from '../../../../../shared/infrastructure/database/PrismaService.js';
import { TenantMapper } from '../mappers/TenantMapper.js';
import { CNPJ } from '../../../domain/value-objects/CNPJ.js';
import { Address } from '../../../domain/value-objects/Address.js';
import { UniqueEntityID } from '../../../../../shared/domain/UniqueEntityID.js';

@Injectable()
export class PrismaTenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenant: Tenant): Promise<void> {
    const data = TenantMapper.toPersistence(tenant);
    const { ownerBirthDate, streetNumber, ownerUserId, ...tenantRecord } =
      data.tenant;

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.upsert({
        where: { id: tenantRecord.id },
        create: tenantRecord,
        update: tenantRecord,
      });

      await tx.$executeRaw(Prisma.sql`
          UPDATE tenant_schema.tenants
          SET owner_birth_date = ${ownerBirthDate ?? null}::date,
              street_number = ${streetNumber ?? null},
              owner_user_id = ${ownerUserId ?? null}::uuid,
              business_type = ${data.tenant.businessType ?? null},
              catalog_files = ${JSON.stringify(data.tenant.catalogFiles || [])}::jsonb,
              operating_hours = ${data.tenant.operatingHours ? JSON.stringify(data.tenant.operatingHours) : null}::jsonb,
              description = ${data.tenant.description ?? null},
              services = ${data.tenant.services ?? null},
              catalog_url = ${data.tenant.catalogUrl ?? null}
          WHERE id = ${tenantRecord.id}::uuid
        `);

      for (const user of data.users) {
        await tx.$executeRaw(Prisma.sql`
            INSERT INTO tenant_schema.users (
              id,
              tenant_id,
              name,
              email,
              cpf,
              phone,
              password_hash,
              role,
              created_at
            )
            VALUES (
              ${user.id}::uuid,
              ${user.tenantId}::uuid,
              ${user.name},
              ${user.email},
              ${user.cpf},
              ${user.phone},
              ${user.passwordHash},
              ${user.role},
              ${user.createdAt}::timestamptz
            )
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              cpf = EXCLUDED.cpf,
              phone = EXCLUDED.phone,
              password_hash = EXCLUDED.password_hash,
              role = EXCLUDED.role
          `);
      }

      if (data.whatsappConfig) {
        await tx.$executeRaw(Prisma.sql`
            INSERT INTO tenant_schema.whatsapp_configs (
              id,
              tenant_id,
              bubble_whats_api_key,
              provider,
              credentials,
              whatsapp_number,
              webhook_secret,
              status,
              configured_at
            )
            VALUES (
              ${data.whatsappConfig.id}::uuid,
              ${data.whatsappConfig.tenantId}::uuid,
              ${data.whatsappConfig.credentials.token || ''},
              ${data.whatsappConfig.provider},
              ${JSON.stringify(data.whatsappConfig.credentials)}::jsonb,
              ${data.whatsappConfig.whatsappNumber},
              ${data.whatsappConfig.webhookSecret},
              ${data.whatsappConfig.status},
              ${data.whatsappConfig.configuredAt}::timestamptz
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
              bubble_whats_api_key = EXCLUDED.bubble_whats_api_key,
              provider = EXCLUDED.provider,
              credentials = EXCLUDED.credentials,
              whatsapp_number = EXCLUDED.whatsapp_number,
              webhook_secret = EXCLUDED.webhook_secret,
              status = EXCLUDED.status,
              configured_at = EXCLUDED.configured_at
          `);
      }

      if (data.instagramConfig) {
        await tx.$executeRaw(Prisma.sql`
            INSERT INTO tenant_schema.instagram_configs (
              id,
              tenant_id,
              meta_access_token,
              instagram_account_id,
              webhook_secret,
              status,
              configured_at
            )
            VALUES (
              ${data.instagramConfig.id}::uuid,
              ${data.instagramConfig.tenantId}::uuid,
              ${data.instagramConfig.metaAccessToken},
              ${data.instagramConfig.instagramAccountId},
              ${data.instagramConfig.webhookSecret},
              ${data.instagramConfig.status},
              ${data.instagramConfig.configuredAt}::timestamptz
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
              meta_access_token = EXCLUDED.meta_access_token,
              instagram_account_id = EXCLUDED.instagram_account_id,
              webhook_secret = EXCLUDED.webhook_secret,
              status = EXCLUDED.status,
              configured_at = EXCLUDED.configured_at
          `);
      }

      if (data.aiConfig) {
        await tx.aIConfig.upsert({
          where: { id: data.aiConfig.id },
          create: data.aiConfig,
          update: data.aiConfig,
        });
      }
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    const raw = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        aiConfig: true,
      },
    });

    if (!raw) {
      return null;
    }

    const [
      instagramConfig,
      whatsappConfig,
      users,
      ownerBirthDates,
      streetNumbers,
      ownerUserIds,
      businessTypes,
      catalogFiles,
    ] = await Promise.all([
      this.findInstagramConfigByTenantId(id),
      this.findWhatsAppConfigByTenantId(id),
      this.findUsersByTenantId(id),
      this.findOwnerBirthDatesByTenantIds([id]),
      this.findStreetNumbersByTenantIds([id]),
      this.findOwnerUserIdsByTenantIds([id]),
      this.findBusinessTypesByTenantIds([id]),
      this.findCatalogFilesByTenantIds([id]),
    ]);
    return TenantMapper.toDomain({
      ...(raw as any),
      users,
      ownerBirthDate:
        ownerBirthDates.get(id) ?? (raw as any).ownerBirthDate ?? null,
      streetNumber: streetNumbers.get(id) ?? (raw as any).streetNumber ?? null,
      ownerUserId: ownerUserIds.get(id) ?? (raw as any).ownerUserId ?? null,
      businessType:
        businessTypes.get(id) ||
        (raw as any).businessType ||
        (raw as any).business_type ||
        null,
      catalogFiles:
        (catalogFiles.get(id) ?? []).length > 0
          ? catalogFiles.get(id)!
          : (raw as any).catalogFiles || (raw as any).catalog_files || [],
      instagramConfig,
      whatsappConfig,
    });
  }

  async findCompanyNameById(id: string): Promise<string | null> {
    const raw = await this.prisma.tenant.findUnique({
      where: { id },
      select: { companyName: true },
    });

    return raw?.companyName ?? null;
  }

  async findByCnpj(cnpj: string): Promise<Tenant | null> {
    const cnpjVariants = this.getCnpjVariants(cnpj);
    const raw = await this.prisma.tenant.findUnique({
      where: { cnpj: cnpjVariants.formatted },
      include: {
        aiConfig: true,
      },
    });

    if (raw) {
      const [
        instagramConfig,
        whatsappConfig,
        users,
        ownerBirthDates,
        streetNumbers,
        ownerUserIds,
        businessTypes,
        catalogFiles,
      ] = await Promise.all([
        this.findInstagramConfigByTenantId(raw.id),
        this.findWhatsAppConfigByTenantId(raw.id),
        this.findUsersByTenantId(raw.id),
        this.findOwnerBirthDatesByTenantIds([raw.id]),
        this.findStreetNumbersByTenantIds([raw.id]),
        this.findOwnerUserIdsByTenantIds([raw.id]),
        this.findBusinessTypesByTenantIds([raw.id]),
        this.findCatalogFilesByTenantIds([raw.id]),
      ]);
      return TenantMapper.toDomain({
        ...(raw as any),
        users,
        ownerBirthDate:
          ownerBirthDates.get(String(raw.id).toLowerCase()) ??
          (raw as any).ownerBirthDate ??
          null,
        streetNumber:
          streetNumbers.get(String(raw.id).toLowerCase()) ??
          (raw as any).streetNumber ??
          null,
        ownerUserId:
          ownerUserIds.get(String(raw.id).toLowerCase()) ??
          (raw as any).ownerUserId ??
          null,
        businessType:
          businessTypes.get(String(raw.id).toLowerCase()) ||
          (raw as any).businessType ||
          (raw as any).business_type ||
          null,
        catalogFiles:
          (catalogFiles.get(String(raw.id).toLowerCase()) ?? []).length > 0
            ? catalogFiles.get(String(raw.id).toLowerCase())!
            : (raw as any).catalogFiles || (raw as any).catalog_files || [],
        instagramConfig,
        whatsappConfig,
      });
    }

    if (cnpjVariants.formatted === cnpjVariants.original) {
      return null;
    }

    const fallback = await this.prisma.tenant.findUnique({
      where: { cnpj: cnpjVariants.original },
      include: {
        aiConfig: true,
      },
    });

    if (!fallback) {
      return null;
    }

    const [
      instagramConfig,
      whatsappConfig,
      users,
      ownerBirthDates,
      streetNumbers,
      ownerUserIds,
      businessTypes,
      catalogFiles,
    ] = await Promise.all([
      this.findInstagramConfigByTenantId(fallback.id),
      this.findWhatsAppConfigByTenantId(fallback.id),
      this.findUsersByTenantId(fallback.id),
      this.findOwnerBirthDatesByTenantIds([fallback.id]),
      this.findStreetNumbersByTenantIds([fallback.id]),
      this.findOwnerUserIdsByTenantIds([fallback.id]),
      this.findBusinessTypesByTenantIds([fallback.id]),
      this.findCatalogFilesByTenantIds([fallback.id]),
    ]);
    return TenantMapper.toDomain({
      ...(fallback as any),
      users,
      ownerBirthDate:
        ownerBirthDates.get(String(fallback.id).toLowerCase()) ??
        (fallback as any).ownerBirthDate ??
        null,
      streetNumber:
        streetNumbers.get(String(fallback.id).toLowerCase()) ??
        (fallback as any).streetNumber ??
        null,
      ownerUserId:
        ownerUserIds.get(String(fallback.id).toLowerCase()) ??
        (fallback as any).ownerUserId ??
        null,
      businessType:
        businessTypes.get(String(fallback.id).toLowerCase()) ||
        (fallback as any).businessType ||
        (fallback as any).business_type ||
        null,
      catalogFiles:
        (catalogFiles.get(String(fallback.id).toLowerCase()) ?? []).length > 0
          ? catalogFiles.get(String(fallback.id).toLowerCase())!
          : (fallback as any).catalogFiles ||
            (fallback as any).catalog_files ||
            [],
      instagramConfig,
      whatsappConfig,
    });
  }

  async findByWhatsAppNumber(whatsappNumber: string): Promise<Tenant | null> {
    const tenantId = await this.findTenantIdByWhatsAppNumber(whatsappNumber);
    if (!tenantId) {
      return null;
    }

    const raw = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        aiConfig: true,
      },
    });

    if (!raw) {
      return null;
    }

    const [
      instagramConfig,
      whatsappConfig,
      users,
      ownerBirthDates,
      streetNumbers,
      ownerUserIds,
      businessTypes,
      catalogFiles,
    ] = await Promise.all([
      this.findInstagramConfigByTenantId(raw.id),
      this.findWhatsAppConfigByTenantId(raw.id),
      this.findUsersByTenantId(raw.id),
      this.findOwnerBirthDatesByTenantIds([raw.id]),
      this.findStreetNumbersByTenantIds([raw.id]),
      this.findOwnerUserIdsByTenantIds([raw.id]),
      this.findBusinessTypesByTenantIds([raw.id]),
      this.findCatalogFilesByTenantIds([raw.id]),
    ]);
    return TenantMapper.toDomain({
      ...(raw as any),
      users,
      ownerBirthDate:
        ownerBirthDates.get(String(raw.id).toLowerCase()) ??
        (raw as any).ownerBirthDate ??
        null,
      streetNumber:
        streetNumbers.get(String(raw.id).toLowerCase()) ??
        (raw as any).streetNumber ??
        null,
      ownerUserId:
        ownerUserIds.get(String(raw.id).toLowerCase()) ??
        (raw as any).ownerUserId ??
        null,
      businessType:
        businessTypes.get(String(raw.id).toLowerCase()) ||
        (raw as any).businessType ||
        (raw as any).business_type ||
        null,
      catalogFiles:
        (catalogFiles.get(String(raw.id).toLowerCase()) ?? []).length > 0
          ? catalogFiles.get(String(raw.id).toLowerCase())!
          : (raw as any).catalogFiles || (raw as any).catalog_files || [],
      instagramConfig,
      whatsappConfig,
    });
  }

  async findByBubbleWhatsId(bubbleWhatsId: string): Promise<Tenant | null> {
    const results = await this.prisma.$queryRaw<
      Array<{ tenant_id: string }>
    >(Prisma.sql`
        SELECT tenant_id
        FROM tenant_schema.whatsapp_configs
        WHERE provider = 'BUBBLEWHATS'
          AND (
            credentials->>'id' = ${bubbleWhatsId}
            OR bubble_whats_api_key = ${bubbleWhatsId}
          )
        LIMIT 1
      `);

    const tenantId = results[0]?.tenant_id;
    if (!tenantId) {
      return null;
    }

    return this.findById(tenantId);
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: Tenant[]; total: number }> {
    const where = {
      users: {
        some: {},
      },
    };

    const [results, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          aiConfig: true,
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const tenantIds = results.map((r) => r.id);
    const [
      instagramConfigs,
      whatsappConfigs,
      usersByTenantId,
      ownerBirthDates,
      streetNumbers,
      ownerUserIds,
      businessTypes,
      catalogFiles,
    ] = await Promise.all([
      this.findInstagramConfigsByTenantIds(tenantIds),
      this.findWhatsAppConfigsByTenantIds(tenantIds),
      this.findUsersByTenantIds(tenantIds),
      this.findOwnerBirthDatesByTenantIds(tenantIds),
      this.findStreetNumbersByTenantIds(tenantIds),
      this.findOwnerUserIdsByTenantIds(tenantIds),
      this.findBusinessTypesByTenantIds(tenantIds),
      this.findCatalogFilesByTenantIds(tenantIds),
    ]);

    return {
      data: results.map((r) =>
        TenantMapper.toDomain({
          ...(r as any),
          users: usersByTenantId.get(String(r.id).toLowerCase()) ?? [],
          ownerBirthDate:
            ownerBirthDates.get(String(r.id).toLowerCase()) ??
            (r as any).ownerBirthDate ??
            null,
          streetNumber:
            streetNumbers.get(String(r.id).toLowerCase()) ??
            (r as any).streetNumber ??
            null,
          ownerUserId:
            ownerUserIds.get(String(r.id).toLowerCase()) ??
            (r as any).ownerUserId ??
            null,
          businessType:
            businessTypes.get(String(r.id).toLowerCase()) ||
            (r as any).businessType ||
            (r as any).business_type ||
            null,
          catalogFiles:
            (catalogFiles.get(String(r.id).toLowerCase()) ?? []).length > 0
              ? catalogFiles.get(String(r.id).toLowerCase())!
              : (r as any).catalogFiles || (r as any).catalog_files || [],
          instagramConfig:
            instagramConfigs.get(String(r.id).toLowerCase()) ?? null,
          whatsappConfig:
            whatsappConfigs.get(String(r.id).toLowerCase()) ?? null,
        }),
      ),
      total,
    };
  }

  async exists(cnpj: string): Promise<boolean> {
    const cnpjVariants = this.getCnpjVariants(cnpj);
    const count = await this.prisma.tenant.count({
      where: {
        cnpj: {
          in: [cnpjVariants.original, cnpjVariants.formatted],
        },
      },
    });
    return count > 0;
  }

  async listBranches(tenantId: string): Promise<TenantBranch[]> {
    const results = await this.prisma.$queryRaw<TenantBranchRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id,
          name,
          phone,
          email,
          whatsapp_number,
          whatsapp_provider,
          whatsapp_credentials,
          whatsapp_webhook_secret,
          instagram_account_id,
          zipcode,
          street,
          street_number,
          neighborhood,
          city,
          state,
          is_headquarters,
          active,
          cnpj,
          operating_hours,
          created_at,
          updated_at
        FROM tenant_schema.tenant_branches
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY is_headquarters DESC, created_at ASC
      `);

    return results.map((row) => this.toTenantBranch(row));
  }

  async createBranch(input: SaveTenantBranchInput): Promise<TenantBranch> {
    const branchId = new UniqueEntityID().toValue();

    if (input.isHeadquarters) {
      await this.prisma.$executeRaw(Prisma.sql`
          UPDATE tenant_schema.tenant_branches
          SET is_headquarters = FALSE,
              updated_at = NOW()
          WHERE tenant_id = ${input.tenantId}::uuid
        `);
    }

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tenant_schema.tenant_branches (
          id,
          tenant_id,
          name,
          phone,
          email,
          whatsapp_number,
          whatsapp_provider,
          whatsapp_credentials,
          whatsapp_webhook_secret,
          instagram_account_id,
          zipcode,
          street,
          street_number,
          neighborhood,
          city,
          state,
          is_headquarters,
          active,
          cnpj,
          operating_hours
        )
        VALUES (
          ${branchId}::uuid,
          ${input.tenantId}::uuid,
          ${input.name.trim()},
          ${input.phone?.trim() || null},
          ${input.email?.trim() || null},
          ${input.whatsappNumber?.trim() || null},
          ${input.whatsAppConfigOverride?.provider ?? null},
          ${JSON.stringify(input.whatsAppConfigOverride?.credentials ?? {})}::jsonb,
          ${input.whatsAppConfigOverride?.webhookSecret?.trim() || null},
          ${input.instagramAccountId?.trim() || null},
          ${input.zipcode?.trim() || null},
          ${input.street?.trim() || null},
          ${input.streetNumber?.trim() || null},
          ${input.neighborhood?.trim() || null},
          ${input.city?.trim() || null},
          ${input.state?.trim() || null},
          ${Boolean(input.isHeadquarters)},
          ${input.active ?? true},
          ${input.cnpj?.replace(/\D/g, '') || null},
          ${input.operatingHours ? JSON.stringify(input.operatingHours) : null}::jsonb
        )
      `);

    const branch = await this.findBranchById(input.tenantId, branchId);
    if (!branch) {
      throw new Error('Failed to create tenant branch');
    }

    return branch;
  }

  async updateBranch(
    branchId: string,
    input: SaveTenantBranchInput,
  ): Promise<TenantBranch> {
    if (input.isHeadquarters) {
      await this.prisma.$executeRaw(Prisma.sql`
          UPDATE tenant_schema.tenant_branches
          SET is_headquarters = FALSE,
              updated_at = NOW()
          WHERE tenant_id = ${input.tenantId}::uuid
            AND id <> ${branchId}::uuid
        `);
    }

    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tenant_schema.tenant_branches
        SET
          name = ${input.name.trim()},
          phone = ${input.phone?.trim() || null},
          email = ${input.email?.trim() || null},
          whatsapp_number = ${input.whatsappNumber?.trim() || null},
          whatsapp_provider = ${input.whatsAppConfigOverride?.provider ?? null},
          whatsapp_credentials = ${JSON.stringify(input.whatsAppConfigOverride?.credentials ?? {})}::jsonb,
          whatsapp_webhook_secret = ${input.whatsAppConfigOverride?.webhookSecret?.trim() || null},
          instagram_account_id = ${input.instagramAccountId?.trim() || null},
          zipcode = ${input.zipcode?.trim() || null},
          street = ${input.street?.trim() || null},
          street_number = ${input.streetNumber?.trim() || null},
          neighborhood = ${input.neighborhood?.trim() || null},
          city = ${input.city?.trim() || null},
          state = ${input.state?.trim() || null},
          is_headquarters = ${Boolean(input.isHeadquarters)},
          active = ${input.active ?? true},
          cnpj = ${input.cnpj?.replace(/\D/g, '') || null},
          operating_hours = ${input.operatingHours ? JSON.stringify(input.operatingHours) : null}::jsonb,
          updated_at = NOW()
        WHERE id = ${branchId}::uuid
          AND tenant_id = ${input.tenantId}::uuid
      `);

    const branch = await this.findBranchById(input.tenantId, branchId);
    if (!branch) {
      throw new Error('Tenant branch not found after update');
    }

    return branch;
  }

  async deleteBranch(tenantId: string, branchId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM tenant_schema.tenant_branches
        WHERE id = ${branchId}::uuid
          AND tenant_id = ${tenantId}::uuid
      `);
  }

  async findByApiKey(apiKey: string): Promise<Tenant | null> {
    const raw = await this.prisma.tenant.findUnique({
      where: { apiKey } as any,
      include: {
        aiConfig: true,
      },
    });

    if (!raw) {
      return null;
    }

    const [
      instagramConfig,
      whatsappConfig,
      users,
      ownerBirthDates,
      streetNumbers,
      ownerUserIds,
      businessTypes,
      catalogFiles,
    ] = await Promise.all([
      this.findInstagramConfigByTenantId(raw.id),
      this.findWhatsAppConfigByTenantId(raw.id),
      this.findUsersByTenantId(raw.id),
      this.findOwnerBirthDatesByTenantIds([raw.id]),
      this.findStreetNumbersByTenantIds([raw.id]),
      this.findOwnerUserIdsByTenantIds([raw.id]),
      this.findBusinessTypesByTenantIds([raw.id]),
      this.findCatalogFilesByTenantIds([raw.id]),
    ]);
    return TenantMapper.toDomain({
      ...(raw as any),
      users,
      ownerBirthDate:
        ownerBirthDates.get(String(raw.id).toLowerCase()) ??
        (raw as any).ownerBirthDate ??
        null,
      streetNumber:
        streetNumbers.get(String(raw.id).toLowerCase()) ??
        (raw as any).streetNumber ??
        null,
      ownerUserId:
        ownerUserIds.get(String(raw.id).toLowerCase()) ??
        (raw as any).ownerUserId ??
        null,
      businessType:
        businessTypes.get(String(raw.id).toLowerCase()) ||
        (raw as any).businessType ||
        (raw as any).business_type ||
        null,
      catalogFiles:
        (catalogFiles.get(String(raw.id).toLowerCase()) ?? []).length > 0
          ? catalogFiles.get(String(raw.id).toLowerCase())!
          : (raw as any).catalogFiles || (raw as any).catalog_files || [],
      instagramConfig,
      whatsappConfig,
    });
  }

  async findBranchByWhatsAppNumber(
    whatsappNumber: string,
  ): Promise<{ tenantId: string; branch: TenantBranch } | null> {
    const results = await this.prisma.$queryRaw<TenantBranchRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id,
          name,
          phone,
          email,
          whatsapp_number,
          whatsapp_provider,
          whatsapp_credentials,
          whatsapp_webhook_secret,
          instagram_account_id,
          zipcode,
          street,
          street_number,
          neighborhood,
          city,
          state,
          is_headquarters,
          active,
          cnpj,
          operating_hours,
          created_at,
          updated_at
        FROM tenant_schema.tenant_branches
        WHERE active = TRUE
          AND whatsapp_number = ${whatsappNumber}
        LIMIT 1
      `);

    const row = results[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      branch: this.toTenantBranch(row),
    };
  }

  async findBranchByInstagramAccountId(
    instagramAccountId: string,
  ): Promise<{ tenantId: string; branch: TenantBranch } | null> {
    const results = await this.prisma.$queryRaw<TenantBranchRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id,
          name,
          phone,
          email,
          whatsapp_number,
          whatsapp_provider,
          whatsapp_credentials,
          whatsapp_webhook_secret,
          instagram_account_id,
          zipcode,
          street,
          street_number,
          neighborhood,
          city,
          state,
          is_headquarters,
          active,
          cnpj,
          operating_hours,
          created_at,
          updated_at
        FROM tenant_schema.tenant_branches
        WHERE active = TRUE
          AND instagram_account_id = ${instagramAccountId}
        LIMIT 1
      `);

    const row = results[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      branch: this.toTenantBranch(row),
    };
  }

  private async findOwnerBirthDatesByTenantIds(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; owner_birth_date: Date | null }>
    >(Prisma.sql`
        SELECT id, owner_birth_date
        FROM tenant_schema.tenants
        WHERE id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((row) => [
        String(row.id).toLowerCase(),
        row.owner_birth_date
          ? new Date(row.owner_birth_date).toISOString().slice(0, 10)
          : null,
      ]),
    );
  }

  private async findStreetNumbersByTenantIds(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; street_number: string | null }>
    >(Prisma.sql`
        SELECT id, street_number
        FROM tenant_schema.tenants
        WHERE id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((row) => [
        String(row.id).toLowerCase(),
        row.street_number ?? null,
      ]),
    );
  }

  private async findOwnerUserIdsByTenantIds(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; owner_user_id: string | null }>
    >(Prisma.sql`
        SELECT id, owner_user_id
        FROM tenant_schema.tenants
        WHERE id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((row) => [
        String(row.id).toLowerCase(),
        row.owner_user_id ?? null,
      ]),
    );
  }

  private async findBusinessTypesByTenantIds(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; business_type: string | null }>
    >(Prisma.sql`
        SELECT id, business_type
        FROM tenant_schema.tenants
        WHERE id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((row) => [
        String(row.id).toLowerCase(),
        row.business_type ?? null,
      ]),
    );
  }

  private async findCatalogFilesByTenantIds(
    tenantIds: string[],
  ): Promise<Map<string, string[]>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; catalog_files: any }>
    >(Prisma.sql`
        SELECT id, catalog_files
        FROM tenant_schema.tenants
        WHERE id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((row) => [
        String(row.id).toLowerCase(),
        Array.isArray(row.catalog_files) ? row.catalog_files : [],
      ]),
    );
  }

  private async findUsersByTenantId(tenantId: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      name: string;
      email: string;
      cpf: string | null;
      phone: string;
      passwordHash: string;
      role: string;
      createdAt: Date;
    }>
  > {
    const results = await this.findUsersByTenantIds([tenantId]);
    return results.get(tenantId) ?? [];
  }

  private async findUsersByTenantIds(tenantIds: string[]): Promise<
    Map<
      string,
      Array<{
        id: string;
        tenantId: string;
        name: string;
        email: string;
        cpf: string | null;
        phone: string;
        passwordHash: string;
        role: string;
        createdAt: Date;
      }>
    >
  > {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        name: string;
        email: string;
        cpf: string | null;
        phone: string;
        password_hash: string;
        role: string;
        created_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          name,
          email,
          cpf,
          phone,
          password_hash,
          role,
          created_at
        FROM tenant_schema.users
        WHERE tenant_id = ANY(${tenantIds}::uuid[])
        ORDER BY created_at ASC
      `);

    const usersByTenantId = new Map<
      string,
      Array<{
        id: string;
        tenantId: string;
        name: string;
        email: string;
        cpf: string | null;
        phone: string;
        passwordHash: string;
        role: string;
        createdAt: Date;
      }>
    >();

    for (const user of results) {
      const key = String(user.tenant_id).toLowerCase();
      const tenantUsers = usersByTenantId.get(key) ?? [];
      tenantUsers.push({
        id: user.id,
        tenantId: user.tenant_id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        phone: user.phone,
        passwordHash: user.password_hash,
        role: user.role,
        createdAt: user.created_at,
      });
      usersByTenantId.set(key, tenantUsers);
    }

    return usersByTenantId;
  }

  private async findTenantIdByWhatsAppNumber(
    whatsappNumber: string,
  ): Promise<string | null> {
    const results = await this.prisma.$queryRaw<
      Array<{ tenant_id: string }>
    >(Prisma.sql`
        SELECT tenant_id
        FROM tenant_schema.whatsapp_configs
        WHERE whatsapp_number = ${whatsappNumber}
        LIMIT 1
      `);

    return results[0]?.tenant_id ?? null;
  }

  private async findWhatsAppConfigByTenantId(tenantId: string): Promise<{
    id: string;
    tenantId: string;
    provider: string;
    credentials: Record<string, unknown>;
    whatsappNumber: string;
    webhookSecret: string | null;
    status: string;
    configuredAt: Date;
  } | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        provider: string;
        credentials: Record<string, unknown> | null;
        whatsapp_number: string;
        webhook_secret: string | null;
        status: string;
        configured_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          provider,
          credentials,
          whatsapp_number,
          webhook_secret,
          status,
          configured_at
        FROM tenant_schema.whatsapp_configs
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

    const raw = results[0];
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      provider: raw.provider,
      credentials: (raw.credentials || {}) as Record<string, unknown>,
      whatsappNumber: raw.whatsapp_number,
      webhookSecret: raw.webhook_secret,
      status: raw.status,
      configuredAt: raw.configured_at,
    };
  }

  private async findWhatsAppConfigsByTenantIds(tenantIds: string[]): Promise<
    Map<
      string,
      {
        id: string;
        tenantId: string;
        provider: string;
        credentials: Record<string, unknown>;
        whatsappNumber: string;
        webhookSecret: string | null;
        status: string;
        configuredAt: Date;
      }
    >
  > {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        provider: string;
        credentials: Record<string, unknown> | null;
        whatsapp_number: string;
        webhook_secret: string | null;
        status: string;
        configured_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          provider,
          credentials,
          whatsapp_number,
          webhook_secret,
          status,
          configured_at
        FROM tenant_schema.whatsapp_configs
        WHERE tenant_id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((raw) => [
        String(raw.tenant_id).toLowerCase(),
        {
          id: raw.id,
          tenantId: raw.tenant_id,
          provider: raw.provider,
          credentials: (raw.credentials || {}) as Record<string, unknown>,
          whatsappNumber: raw.whatsapp_number,
          webhookSecret: raw.webhook_secret,
          status: raw.status,
          configuredAt: raw.configured_at,
        },
      ]),
    );
  }

  private async findInstagramConfigByTenantId(tenantId: string): Promise<{
    id: string;
    tenantId: string;
    metaAccessToken: string;
    instagramAccountId: string;
    webhookSecret: string;
    status: string;
    configuredAt: Date;
  } | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        meta_access_token: string;
        instagram_account_id: string;
        webhook_secret: string;
        status: string;
        configured_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          meta_access_token,
          instagram_account_id,
          webhook_secret,
          status,
          configured_at
        FROM tenant_schema.instagram_configs
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

    const raw = results[0];
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenant_id,
      metaAccessToken: raw.meta_access_token,
      instagramAccountId: raw.instagram_account_id,
      webhookSecret: raw.webhook_secret,
      status: raw.status,
      configuredAt: raw.configured_at,
    };
  }

  private async findInstagramConfigsByTenantIds(tenantIds: string[]): Promise<
    Map<
      string,
      {
        id: string;
        tenantId: string;
        metaAccessToken: string;
        instagramAccountId: string;
        webhookSecret: string;
        status: string;
        configuredAt: Date;
      }
    >
  > {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        meta_access_token: string;
        instagram_account_id: string;
        webhook_secret: string;
        status: string;
        configured_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          meta_access_token,
          instagram_account_id,
          webhook_secret,
          status,
          configured_at
        FROM tenant_schema.instagram_configs
        WHERE tenant_id = ANY(${tenantIds}::uuid[])
      `);

    return new Map(
      results.map((raw) => [
        String(raw.tenant_id).toLowerCase(),
        {
          id: raw.id,
          tenantId: raw.tenant_id,
          metaAccessToken: raw.meta_access_token,
          instagramAccountId: raw.instagram_account_id,
          webhookSecret: raw.webhook_secret,
          status: raw.status,
          configuredAt: raw.configured_at,
        },
      ]),
    );
  }

  private getCnpjVariants(cnpj: string): {
    original: string;
    formatted: string;
  } {
    try {
      const formatted = CNPJ.create(cnpj).value;
      return {
        original: cnpj,
        formatted,
      };
    } catch {
      return {
        original: cnpj,
        formatted: cnpj,
      };
    }
  }

  private async findBranchById(
    tenantId: string,
    branchId: string,
  ): Promise<TenantBranch | null> {
    const results = await this.prisma.$queryRaw<TenantBranchRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id,
          name,
          phone,
          email,
          whatsapp_number,
          whatsapp_provider,
          whatsapp_credentials,
          whatsapp_webhook_secret,
          instagram_account_id,
          zipcode,
          street,
          street_number,
          neighborhood,
          city,
          state,
          is_headquarters,
          active,
          cnpj,
          operating_hours,
          created_at,
          updated_at
        FROM tenant_schema.tenant_branches
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${branchId}::uuid
        LIMIT 1
      `);

    const branch = results[0];
    return branch ? this.toTenantBranch(branch) : null;
  }

  private toTenantBranch(row: TenantBranchRow): TenantBranch {
    return TenantBranch.create(
      {
        tenantId: row.tenant_id,
        name: row.name,
        phone: row.phone ?? null,
        email: row.email ?? null,
        whatsappNumber: row.whatsapp_number ?? null,
        instagramAccountId: row.instagram_account_id ?? null,
        whatsAppConfigOverride:
          row.whatsapp_provider &&
          row.whatsapp_credentials &&
          Object.keys(row.whatsapp_credentials).length > 0
            ? {
                provider: row.whatsapp_provider,
                credentials: row.whatsapp_credentials,
                webhookSecret: row.whatsapp_webhook_secret ?? null,
              }
            : null,
        address: Address.create({
          zipcode: row.zipcode ?? '',
          street: row.street ?? '',
          streetNumber: row.street_number ?? '',
          neighborhood: row.neighborhood ?? '',
          city: row.city ?? '',
          state: row.state ?? '',
        }),
        operatingHours: row.operating_hours ?? null,
        isHeadquarters: row.is_headquarters,
        active: row.active,
        cnpj: row.cnpj ?? null,
      },
      new UniqueEntityID(row.id),
      row.created_at,
      row.updated_at,
    );
  }
}

interface TenantBranchRow {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  whatsapp_provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360' | null;
  whatsapp_credentials: Record<string, string> | null;
  whatsapp_webhook_secret: string | null;
  instagram_account_id: string | null;
  zipcode: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  is_headquarters: boolean;
  active: boolean;
  cnpj: string | null;
  operating_hours: any | null;
  created_at: Date;
  updated_at: Date;
}
