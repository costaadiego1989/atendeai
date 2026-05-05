import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CatalogAuditLogInput,
  CatalogCategoryRecord,
  CatalogItemRecord,
  CreateCatalogCategoryInput,
  CreateCatalogItemInput,
  ICatalogRepository,
  ListCatalogItemsFilters,
  UpdateCatalogCategoryInput,
  UpdateCatalogItemInput,
} from '../../../domain/ports/ICatalogRepository';
import { CatalogCategoryNotFoundError } from '../../../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemNotFoundError } from '../../../domain/errors/CatalogItemNotFoundError';
import { CatalogCategoryInUseError } from '../../../domain/errors/CatalogCategoryInUseError';

@Injectable()
export class PrismaCatalogRepository implements ICatalogRepository {
  private static catalogExtensionsPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async createCategory(
    input: CreateCatalogCategoryInput,
  ): Promise<CatalogCategoryRecord> {
    await this.ensureCatalogExtensions();
    const parent = input.parentCategoryId
      ? await this.findCategoryById(input.tenantId, input.parentCategoryId)
      : null;

    if (input.parentCategoryId && !parent) {
      throw new CatalogCategoryNotFoundError(input.parentCategoryId);
    }

    const path = [...(parent?.path ?? []), input.name];
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO catalog_schema.catalog_categories (
        tenant_id, parent_category_id, name, description, path, level
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.parentCategoryId ?? null}::uuid,
        ${input.name},
        ${input.description ?? null},
        ${path}::text[],
        ${parent ? parent.level + 1 : 0}
      )
      RETURNING *
    `);

    return this.mapCategory({
      ...rows[0],
      parent_category_name: parent?.name ?? null,
    });
  }

  async updateCategory(
    input: UpdateCatalogCategoryInput,
  ): Promise<CatalogCategoryRecord> {
    await this.ensureCatalogExtensions();
    const existing = await this.prisma.catalogCategory.findFirst({
      where: {
        id: input.categoryId,
        tenantId: input.tenantId,
      },
    });

    if (!existing) {
      throw new CatalogCategoryNotFoundError(input.categoryId);
    }

    const currentCategory = await this.findCategoryById(
      input.tenantId,
      input.categoryId,
    );
    const parentCategoryId =
      input.parentCategoryId === undefined
        ? currentCategory?.parentCategoryId ?? null
        : input.parentCategoryId;

    if (parentCategoryId === input.categoryId) {
      throw new CatalogCategoryNotFoundError(parentCategoryId);
    }

    const parent = parentCategoryId
      ? await this.findCategoryById(input.tenantId, parentCategoryId)
      : null;

    if (parentCategoryId && !parent) {
      throw new CatalogCategoryNotFoundError(parentCategoryId);
    }

    const path = [...(parent?.path ?? []), input.name];
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE catalog_schema.catalog_categories
      SET
        parent_category_id = ${parentCategoryId ?? null}::uuid,
        name = ${input.name},
        description = ${input.description ?? null},
        path = ${path}::text[],
        level = ${parent ? parent.level + 1 : 0},
        updated_at = NOW()
      WHERE id = ${input.categoryId}::uuid
        AND tenant_id = ${input.tenantId}::uuid
      RETURNING *
    `);

    return this.mapCategory({
      ...rows[0],
      parent_category_name: parent?.name ?? null,
    });
  }

  async listCategories(tenantId: string): Promise<CatalogCategoryRecord[]> {
    await this.ensureCatalogExtensions();
    const categories = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT child.*, parent.name AS parent_category_name
      FROM catalog_schema.catalog_categories child
      LEFT JOIN catalog_schema.catalog_categories parent
        ON parent.id = child.parent_category_id
      WHERE child.tenant_id = ${tenantId}::uuid
        AND child.active = TRUE
      ORDER BY child.path ASC, child.name ASC
    `);

    return categories.map((category) => this.mapCategory(category));
  }

  async findCategoryById(
    tenantId: string,
    categoryId: string,
  ): Promise<CatalogCategoryRecord | null> {
    await this.ensureCatalogExtensions();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT child.*, parent.name AS parent_category_name
      FROM catalog_schema.catalog_categories child
      LEFT JOIN catalog_schema.catalog_categories parent
        ON parent.id = child.parent_category_id
      WHERE child.id = ${categoryId}::uuid
        AND child.tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapCategory(rows[0]) : null;
  }

  async deactivateCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<CatalogCategoryRecord> {
    await this.ensureCatalogExtensions();
    const existing = await this.prisma.catalogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
    });

    if (!existing) {
      throw new CatalogCategoryNotFoundError(categoryId);
    }

    const hasItems = await this.hasActiveItemsInCategory(tenantId, categoryId);
    if (hasItems) {
      throw new CatalogCategoryInUseError(categoryId);
    }

    const activeChildren = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM catalog_schema.catalog_categories
      WHERE tenant_id = ${tenantId}::uuid
        AND parent_category_id = ${categoryId}::uuid
        AND active = TRUE
    `);
    if (Number(activeChildren[0]?.count ?? 0) > 0) {
      throw new CatalogCategoryInUseError(categoryId);
    }

    const category = await this.prisma.catalogCategory.update({
      where: {
        id: categoryId,
      },
      data: {
        active: false,
      },
    });

    return this.mapCategory(category);
  }

  async hasActiveItemsInCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<boolean> {
    const count = await this.prisma.catalogItem.count({
      where: {
        tenantId,
        categoryId,
        active: true,
      },
    });

    return count > 0;
  }

  async createItem(input: CreateCatalogItemInput): Promise<CatalogItemRecord> {
    await this.ensureCatalogExtensions();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO catalog_schema.catalog_items (
        tenant_id, category_id, type, name, description, base_price, currency, tags,
        source, external_reference, image_url, attributes, variants, option_groups
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.categoryId ?? null}::uuid,
        ${input.type},
        ${input.name},
        ${input.description ?? null},
        ${input.basePrice ?? null}::numeric,
        ${input.currency || 'BRL'},
        ${JSON.stringify(input.tags || [])}::jsonb,
        ${input.source || 'MANUAL'},
        ${input.externalReference ?? null},
        ${input.imageUrl ?? null},
        ${JSON.stringify(input.attributes ?? {})}::jsonb,
        ${JSON.stringify(input.variants ?? [])}::jsonb,
        ${JSON.stringify(input.optionGroups ?? [])}::jsonb
      )
      RETURNING *
    `);

    return this.mapItemWithCategory(rows[0]);
  }

  async updateItem(input: UpdateCatalogItemInput): Promise<CatalogItemRecord> {
    await this.ensureCatalogExtensions();
    const existing = await this.prisma.catalogItem.findFirst({
      where: {
        id: input.itemId,
        tenantId: input.tenantId,
      },
    });

    if (!existing) {
      throw new CatalogItemNotFoundError(input.itemId);
    }

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE catalog_schema.catalog_items
      SET
        category_id = ${input.categoryId ?? null}::uuid,
        type = ${input.type},
        name = ${input.name},
        description = ${input.description ?? null},
        base_price = ${input.basePrice ?? null}::numeric,
        currency = ${input.currency || 'BRL'},
        tags = ${JSON.stringify(input.tags || [])}::jsonb,
        external_reference = ${input.externalReference ?? null},
        image_url = ${input.imageUrl ?? null},
        attributes = ${JSON.stringify(input.attributes ?? {})}::jsonb,
        variants = ${JSON.stringify(input.variants ?? [])}::jsonb,
        option_groups = ${JSON.stringify(input.optionGroups ?? [])}::jsonb,
        updated_at = NOW()
      WHERE id = ${input.itemId}::uuid
        AND tenant_id = ${input.tenantId}::uuid
      RETURNING *
    `);

    return this.mapItemWithCategory(rows[0]);
  }

  async listItems(filters: ListCatalogItemsFilters): Promise<CatalogItemRecord[]> {
    await this.ensureCatalogExtensions();
    const items = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT item.*, category.name AS category_name
      FROM catalog_schema.catalog_items item
      LEFT JOIN catalog_schema.catalog_categories category
        ON category.id = item.category_id
      WHERE item.tenant_id = ${filters.tenantId}::uuid
        AND (${filters.type ?? null}::varchar IS NULL OR item.type = ${filters.type ?? null})
        AND (${filters.categoryId ?? null}::uuid IS NULL OR item.category_id = ${filters.categoryId ?? null}::uuid)
        AND (${filters.includeInactive ?? false}::boolean = TRUE OR item.active = TRUE)
        AND (
          ${filters.query ?? null}::varchar IS NULL
          OR item.name ILIKE '%' || ${filters.query ?? null} || '%'
          OR item.description ILIKE '%' || ${filters.query ?? null} || '%'
        )
      ORDER BY item.type ASC, item.name ASC
    `);

    return items.map((item) => this.mapRawItem(item));
  }

  async findItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CatalogItemRecord | null> {
    await this.ensureCatalogExtensions();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT item.*, category.name AS category_name
      FROM catalog_schema.catalog_items item
      LEFT JOIN catalog_schema.catalog_categories category
        ON category.id = item.category_id
      WHERE item.id = ${itemId}::uuid
        AND item.tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapRawItem(rows[0]) : null;
  }

  async findItemByExternalReference(
    tenantId: string,
    externalReference: string,
  ): Promise<CatalogItemRecord | null> {
    await this.ensureCatalogExtensions();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT item.*, category.name AS category_name
      FROM catalog_schema.catalog_items item
      LEFT JOIN catalog_schema.catalog_categories category
        ON category.id = item.category_id
      WHERE item.tenant_id = ${tenantId}::uuid
        AND LOWER(item.external_reference) = LOWER(${externalReference})
      LIMIT 1
    `);

    return rows[0] ? this.mapRawItem(rows[0]) : null;
  }

  async findItemByNameAndType(
    tenantId: string,
    type: string,
    name: string,
  ): Promise<CatalogItemRecord | null> {
    await this.ensureCatalogExtensions();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT item.*, category.name AS category_name
      FROM catalog_schema.catalog_items item
      LEFT JOIN catalog_schema.catalog_categories category
        ON category.id = item.category_id
      WHERE item.tenant_id = ${tenantId}::uuid
        AND item.type = ${type}
        AND LOWER(item.name) = LOWER(${name})
      LIMIT 1
    `);

    return rows[0] ? this.mapRawItem(rows[0]) : null;
  }

  async deactivateItem(
    tenantId: string,
    itemId: string,
  ): Promise<CatalogItemRecord> {
    const existing = await this.prisma.catalogItem.findFirst({
      where: {
        id: itemId,
        tenantId,
      },
    });

    if (!existing) {
      throw new CatalogItemNotFoundError(itemId);
    }

    const item = await this.prisma.catalogItem.update({
      where: {
        id: itemId,
      },
      data: {
        active: false,
      },
      include: {
        category: true,
      },
    });

    return this.mapItem(item);
  }

  async saveAuditLog(input: CatalogAuditLogInput): Promise<void> {
    await this.prisma.catalogAuditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        userName: input.userName,
        event: input.event,
        entityId: input.entityId,
        entityType: input.entityType,
        metadata: input.metadata || {},
      },
    });
  }

  private mapCategory(category: {
    id: string;
    tenantId?: string;
    tenant_id?: string;
    parentCategoryId?: string | null;
    parent_category_id?: string | null;
    parentCategoryName?: string | null;
    parent_category_name?: string | null;
    path?: string[] | null;
    level?: number | null;
    name: string;
    description: string | null;
    active: boolean;
    createdAt?: Date;
    created_at?: Date;
    updatedAt?: Date;
    updated_at?: Date;
  }): CatalogCategoryRecord {
    return {
      id: category.id,
      tenantId: (category.tenantId ?? category.tenant_id)!,
      parentCategoryId: category.parentCategoryId ?? category.parent_category_id ?? null,
      parentCategoryName: category.parentCategoryName ?? category.parent_category_name ?? null,
      path: category.path ?? [category.name],
      level: category.level ?? 0,
      name: category.name,
      description: category.description,
      active: category.active,
      createdAt: (category.createdAt ?? category.created_at)!,
      updatedAt: (category.updatedAt ?? category.updated_at)!,
    };
  }

  private mapItem(item: {
    id: string;
    tenantId: string;
    categoryId: string | null;
    type: string;
    name: string;
    description: string | null;
    basePrice: { toString(): string } | null;
    currency: string;
    tags: unknown;
    active: boolean;
    source: string;
    externalReference: string | null;
    imageUrl: string | null;
    attributes?: unknown;
    variants?: unknown;
    optionGroups?: unknown;
    createdAt: Date;
    updatedAt: Date;
    category?: {
      name: string;
    } | null;
  }): CatalogItemRecord {
    const basePrice =
      item.basePrice == null ? null : Number(item.basePrice.toString()).toFixed(2);

    return {
      id: item.id,
      tenantId: item.tenantId,
      categoryId: item.categoryId,
      categoryName: item.category?.name,
      type: item.type,
      name: item.name,
      description: item.description,
      basePrice,
      currency: item.currency,
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
      active: item.active,
      source: item.source,
      externalReference: item.externalReference,
      imageUrl: item.imageUrl,
      attributes:
        item.attributes && typeof item.attributes === 'object' && !Array.isArray(item.attributes)
          ? (item.attributes as Record<string, unknown>)
          : {},
      variants: Array.isArray(item.variants)
        ? (item.variants as Array<Record<string, unknown>>)
        : [],
      optionGroups: Array.isArray(item.optionGroups)
        ? (item.optionGroups as Array<Record<string, unknown>>)
        : [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async ensureCatalogExtensions(): Promise<void> {
    if (!PrismaCatalogRepository.catalogExtensionsPromise) {
      PrismaCatalogRepository.catalogExtensionsPromise = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE catalog_schema.catalog_categories
          ADD COLUMN IF NOT EXISTS parent_category_id UUID NULL,
          ADD COLUMN IF NOT EXISTS path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE catalog_schema.catalog_items
          ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS option_groups JSONB NOT NULL DEFAULT '[]'::jsonb
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE catalog_schema.catalog_categories
          SET path = ARRAY[name]::TEXT[]
          WHERE path IS NULL OR cardinality(path) = 0
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent
          ON catalog_schema.catalog_categories (tenant_id, parent_category_id, active)
        `);
      })();
    }

    return PrismaCatalogRepository.catalogExtensionsPromise;
  }

  private async mapItemWithCategory(item: any): Promise<CatalogItemRecord> {
    const category = item.category_id
      ? await this.findCategoryById(item.tenant_id, item.category_id)
      : null;

    return this.mapItem({
      id: item.id,
      tenantId: item.tenant_id,
      categoryId: item.category_id,
      type: item.type,
      name: item.name,
      description: item.description,
      basePrice: item.base_price,
      currency: item.currency,
      tags: item.tags,
      active: item.active,
      source: item.source,
      externalReference: item.external_reference,
      imageUrl: item.image_url,
      attributes: item.attributes,
      variants: item.variants,
      optionGroups: item.option_groups,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      category: category ? { name: category.name } : null,
    });
  }

  private mapRawItem(item: any): CatalogItemRecord {
    return this.mapItem({
      id: item.id,
      tenantId: item.tenant_id,
      categoryId: item.category_id,
      type: item.type,
      name: item.name,
      description: item.description,
      basePrice: item.base_price,
      currency: item.currency,
      tags: item.tags,
      active: item.active,
      source: item.source,
      externalReference: item.external_reference,
      imageUrl: item.image_url,
      attributes: item.attributes,
      variants: item.variants,
      optionGroups: item.option_groups,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      category: item.category_name ? { name: item.category_name } : null,
    });
  }
}
