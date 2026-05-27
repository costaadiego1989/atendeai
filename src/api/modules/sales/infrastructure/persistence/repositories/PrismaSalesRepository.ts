import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/database/PrismaService';
import { SalesMetric } from '../../../domain/entities/SalesMetric';
import {
  ISalesRepository,
  ListSalesPaymentLinksFilters,
  SalesPaymentLinkRecord,
  SalesPaymentLinksSummary,
  SalesPaymentLinkStatus,
  SalesPromotionTargetRecord,
} from '../../../domain/repositories/ISalesRepository';
import { UniqueEntityID } from '../../../../../shared/domain/UniqueEntityID';

@Injectable()
export class PrismaSalesRepository implements ISalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapPaymentLink(
    record: Record<string, unknown>,
  ): SalesPaymentLinkRecord {
    return {
      id: String(record.id),
      tenantId: String(record.tenant_id),
      branchId: (record.branch_id as string | null | undefined) ?? null,
      providerLinkId: String(record.provider_link_id ?? ''),
      externalId: String(record.external_id),
      name: String(record.name),
      description: (record.description as string | null | undefined) ?? null,
      label: (record.label as string | null | undefined) ?? null,
      value: Number(record.value),
      url: String(record.url),
      billingType: String(
        record.billing_type,
      ) as SalesPaymentLinkRecord['billingType'],
      status: String(record.status) as SalesPaymentLinkStatus,
      source: String(record.source) as SalesPaymentLinkRecord['source'],
      resourceType: String(
        record.resource_type ?? 'PAYMENT_LINK',
      ) as SalesPaymentLinkRecord['resourceType'],
      contactId: (record.contact_id as string | null | undefined) ?? null,
      contactName: (record.contact_name as string | null | undefined) ?? null,
      conversationId:
        (record.conversation_id as string | null | undefined) ?? null,
      catalogItemId:
        (record.catalog_item_id as string | null | undefined) ?? null,
      catalogItemSku:
        (record.catalog_item_sku as string | null | undefined) ?? null,
      catalogItemName:
        (record.catalog_item_name as string | null | undefined) ?? null,
      expiresAt: record.expires_at ? new Date(String(record.expires_at)) : null,
      recurrenceEnabled: Boolean(record.recurrence_enabled ?? false),
      recurrenceFrequency:
        (record.recurrence_frequency as SalesPaymentLinkRecord['recurrenceFrequency']) ??
        null,
      recurrenceStartDate: record.recurrence_start_date
        ? new Date(String(record.recurrence_start_date))
        : null,
      recurrenceEndDate: record.recurrence_end_date
        ? new Date(String(record.recurrence_end_date))
        : null,
      recurrenceTotalValue:
        record.recurrence_total_value != null
          ? Number(record.recurrence_total_value)
          : null,
      recurrenceNextRunAt: record.recurrence_next_run_at
        ? new Date(String(record.recurrence_next_run_at))
        : null,
      createdAt: new Date(String(record.created_at)),
      updatedAt: new Date(String(record.updated_at)),
      deletedAt: record.deleted_at ? new Date(String(record.deleted_at)) : null,
    };
  }

  async findByTenantAndDate(
    tenantId: string,
    date: Date,
  ): Promise<SalesMetric | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const record = await this.prisma.salesMetric.findUnique({
      where: {
        tenantId_date: {
          tenantId,
          date: startOfDay,
        },
      },
    });

    if (!record) return null;

    return SalesMetric.create(
      {
        tenantId: record.tenantId,
        date: record.date,
        totalMessages: record.totalMessages,
        purchaseIntents: record.purchaseIntents,
        paymentLinksGenerated: record.paymentLinksGenerated,
        estimatedRevenue: Number(record.estimatedRevenue),
      },
      new UniqueEntityID(record.id),
    );
  }

  async save(metric: SalesMetric): Promise<void> {
    const data = {
      tenantId: metric.tenantId,
      date: metric.date,
      totalMessages: metric.totalMessages,
      purchaseIntents: metric.purchaseIntents,
      paymentLinksGenerated: metric.paymentLinksGenerated,
      estimatedRevenue: metric.estimatedRevenue,
    };

    await this.prisma.salesMetric.upsert({
      where: {
        tenantId_date: {
          tenantId: metric.tenantId,
          date: metric.date,
        },
      },
      create: {
        id: metric.id.toString(),
        ...data,
      },
      update: data,
    });
  }

  async incrementMetric(
    tenantId: string,
    date: Date,
    type: 'MESSAGE' | 'INTENT' | 'LINK',
    value?: number,
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const update: any = {};
    if (type === 'MESSAGE') update.totalMessages = { increment: 1 };
    if (type === 'INTENT') update.purchaseIntents = { increment: 1 };
    if (type === 'LINK') {
      update.paymentLinksGenerated = { increment: 1 };
      update.estimatedRevenue = { increment: value || 0 };
    }

    await this.prisma.salesMetric.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date: startOfDay,
        },
      },
      create: {
        tenantId,
        date: startOfDay,
        totalMessages: type === 'MESSAGE' ? 1 : 0,
        purchaseIntents: type === 'INTENT' ? 1 : 0,
        paymentLinksGenerated: type === 'LINK' ? 1 : 0,
        estimatedRevenue: type === 'LINK' ? value || 0 : 0,
      },
      update,
    });
  }

  async getMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesMetric[]> {
    const records = await this.prisma.salesMetric.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return records.map((record) =>
      SalesMetric.create(
        {
          tenantId: record.tenantId,
          date: record.date,
          totalMessages: record.totalMessages,
          purchaseIntents: record.purchaseIntents,
          paymentLinksGenerated: record.paymentLinksGenerated,
          estimatedRevenue: Number(record.estimatedRevenue),
        },
        new UniqueEntityID(record.id),
      ),
    );
  }

  async createPaymentLink(
    record: Omit<SalesPaymentLinkRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<SalesPaymentLinkRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO sales_schema.payment_links (
        id,
        tenant_id,
        provider_link_id,
        external_id,
        name,
        description,
        label,
        value,
        url,
        billing_type,
        status,
        source,
        resource_type,
        branch_id,
        contact_id,
        conversation_id,
        catalog_item_id,
        catalog_item_sku,
        catalog_item_name,
        expires_at,
        recurrence_enabled,
        recurrence_frequency,
        recurrence_start_date,
        recurrence_end_date,
        recurrence_total_value,
        recurrence_next_run_at,
        deleted_at,
        created_at,
        updated_at
      )
      VALUES (
        ${record.id}::uuid,
        ${record.tenantId}::uuid,
        ${record.providerLinkId},
        ${record.externalId},
        ${record.name},
        ${record.description ?? null},
        ${record.label ?? null},
        ${Number(record.value)},
        ${record.url},
        ${record.billingType},
        ${record.status},
        ${record.source},
        ${record.resourceType ?? 'PAYMENT_LINK'},
        ${record.branchId ?? null}::uuid,
        ${record.contactId ?? null}::uuid,
        ${record.conversationId ?? null}::uuid,
        ${record.catalogItemId ?? null}::uuid,
        ${record.catalogItemSku ?? null},
        ${record.catalogItemName ?? null},
        ${record.expiresAt ?? null},
        ${record.recurrenceEnabled ?? false},
        ${record.recurrenceFrequency ?? null},
        ${record.recurrenceStartDate ?? null},
        ${record.recurrenceEndDate ?? null},
        ${record.recurrenceTotalValue ?? null},
        ${record.recurrenceNextRunAt ?? null},
        ${record.deletedAt ?? null},
        now(),
        now()
      )
      RETURNING *
    `);

    return this.mapPaymentLink(rows[0]);
  }

  async listPaymentLinks(
    tenantId: string,
    filters: ListSalesPaymentLinksFilters,
  ): Promise<{
    items: SalesPaymentLinkRecord[];
    total: number;
    summary: SalesPaymentLinksSummary;
  }> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`payment_links.tenant_id = ${tenantId}::uuid`,
    ];

    if (filters.status && filters.status !== 'ALL') {
      conditions.push(Prisma.sql`payment_links.status = ${filters.status}`);
    }

    if (filters.source && filters.source !== 'ALL') {
      conditions.push(Prisma.sql`payment_links.source = ${filters.source}`);
    }

    if (filters.dateFrom) {
      conditions.push(
        Prisma.sql`payment_links.created_at >= ${filters.dateFrom}`,
      );
    }

    if (filters.dateTo) {
      conditions.push(
        Prisma.sql`payment_links.created_at <= ${filters.dateTo}`,
      );
    }

    if (filters.search?.trim()) {
      const pattern = `%${this.escapeLike(filters.search.trim().toLowerCase())}%`;
      conditions.push(Prisma.sql`(
        LOWER(payment_links.name) LIKE ${pattern} ESCAPE '\\'
        OR LOWER(COALESCE(payment_links.description, '')) LIKE ${pattern} ESCAPE '\\'
        OR LOWER(COALESCE(payment_links.label, '')) LIKE ${pattern} ESCAPE '\\'
        OR LOWER(COALESCE(contacts.name, '')) LIKE ${pattern} ESCAPE '\\'
        OR LOWER(COALESCE(contacts.email, '')) LIKE ${pattern} ESCAPE '\\'
        OR LOWER(COALESCE(contacts.phone, '')) LIKE ${pattern} ESCAPE '\\'
      )`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const offset = Math.max(0, (filters.page - 1) * filters.pageSize);

    const items = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT payment_links.*, contacts.name AS contact_name
      FROM sales_schema.payment_links AS payment_links
      LEFT JOIN contact_schema.contacts AS contacts
        ON contacts.id = payment_links.contact_id
       AND contacts.tenant_id = payment_links.tenant_id
      WHERE ${whereClause}
      ORDER BY payment_links.created_at DESC
      LIMIT ${filters.pageSize}
      OFFSET ${offset}
    `);

    const contactJoin = Prisma.sql`LEFT JOIN contact_schema.contacts AS contacts
        ON contacts.id = payment_links.contact_id
       AND contacts.tenant_id = payment_links.tenant_id`;

    const totalRows = await this.prisma.$queryRaw<
      Array<{ total: number }>
    >(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM sales_schema.payment_links AS payment_links
      ${contactJoin}
      WHERE ${whereClause}
    `);

    const summaryRows = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS total_links,
        COUNT(*) FILTER (WHERE payment_links.status = 'ACTIVE')::int AS active_links,
        COUNT(*) FILTER (WHERE payment_links.status = 'PAUSED')::int AS paused_links,
        COUNT(*) FILTER (WHERE payment_links.status = 'PAID')::int AS paid_links,
        COUNT(*) FILTER (WHERE payment_links.status IN ('EXPIRED', 'OVERDUE'))::int AS expired_links,
        COALESCE(SUM(COALESCE(payment_links.recurrence_total_value, payment_links.value)), 0)::numeric AS estimated_revenue,
        COALESCE(SUM(payment_links.value) FILTER (WHERE payment_links.status = 'PAID'), 0)::numeric AS paid_revenue
      FROM sales_schema.payment_links AS payment_links
      ${contactJoin}
      WHERE ${whereClause} AND payment_links.status <> 'DELETED'
    `);

    const summaryRow = summaryRows[0] ?? {};

    return {
      items: items.map((item) => this.mapPaymentLink(item)),
      total: Number(totalRows[0]?.total ?? 0),
      summary: {
        totalLinks: Number(summaryRow.total_links ?? 0),
        activeLinks: Number(summaryRow.active_links ?? 0),
        pausedLinks: Number(summaryRow.paused_links ?? 0),
        paidLinks: Number(summaryRow.paid_links ?? 0),
        expiredLinks: Number(summaryRow.expired_links ?? 0),
        estimatedRevenue: Number(summaryRow.estimated_revenue ?? 0),
        paidRevenue: Number(summaryRow.paid_revenue ?? 0),
      },
    };
  }

  async findPaymentLinkById(
    tenantId: string,
    paymentLinkId: string,
  ): Promise<SalesPaymentLinkRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT payment_links.*, contacts.name AS contact_name
      FROM sales_schema.payment_links AS payment_links
      LEFT JOIN contact_schema.contacts AS contacts
        ON contacts.id = payment_links.contact_id
       AND contacts.tenant_id = payment_links.tenant_id
      WHERE payment_links.tenant_id = ${tenantId}::uuid
        AND payment_links.id = ${paymentLinkId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapPaymentLink(rows[0]) : null;
  }

  async updatePaymentLinkStatus(
    tenantId: string,
    paymentLinkId: string,
    status: SalesPaymentLinkStatus,
    deletedAt?: Date | null,
  ): Promise<SalesPaymentLinkRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE sales_schema.payment_links
      SET
        status = ${status},
        deleted_at = ${deletedAt ?? null},
        updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid AND id = ${paymentLinkId}::uuid
      RETURNING *
    `);

    return rows[0] ? this.mapPaymentLink(rows[0]) : null;
  }

  async updatePaymentLinkStatusByExternalReference(
    tenantId: string,
    externalReference: string,
    status: 'PAID' | 'OVERDUE' | 'REFUNDED',
  ): Promise<SalesPaymentLinkRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE sales_schema.payment_links
      SET
        status = ${status},
        updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid AND external_id = ${externalReference}
      RETURNING *
    `);

    return rows[0] ? this.mapPaymentLink(rows[0]) : null;
  }

  async findContactNameById(
    tenantId: string,
    contactId: string,
  ): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ name: string }[]>(
      Prisma.sql`
        SELECT name FROM contact_schema.contacts
        WHERE tenant_id = ${tenantId}::uuid AND id = ${contactId}::uuid
        LIMIT 1
      `,
    );

    return rows[0]?.name ?? null;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private mapPromotion(
    record: any,
  ): import('../../../domain/repositories/ISalesRepository').SalesPromotionRecord {
    const targets = this.mapTargets(record.targets, record.catalogItemId);
    return {
      id: record.id,
      tenantId: record.tenantId,
      title: record.title,
      description: record.description,
      discountType:
        record.discountType as import('../../../domain/repositories/ISalesRepository').SalesDiscountType,
      discountValue: Number(record.discountValue),
      minimumOrder:
        record.minimumOrder != null ? Number(record.minimumOrder) : null,
      imageUrl: record.imageUrl ?? null,
      startsAt: record.startsAt,
      expiresAt: record.expiresAt ?? null,
      active: record.active,
      catalogItemId: record.catalogItemId ?? null,
      targets,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapTargets(
    records?: any[],
    legacyCatalogItemId?: string | null,
  ): SalesPromotionTargetRecord[] {
    const explicitTargets = (records ?? []).map((target) => ({
      targetType: target.targetType as SalesPromotionTargetRecord['targetType'],
      targetId: target.targetId,
    }));
    if (explicitTargets.length > 0 || !legacyCatalogItemId) {
      return explicitTargets;
    }
    return [{ targetType: 'ITEM', targetId: legacyCatalogItemId }];
  }

  private normalizeTargets(
    targets?: SalesPromotionTargetRecord[],
    catalogItemId?: string | null,
  ): SalesPromotionTargetRecord[] {
    const normalized = new Map<string, SalesPromotionTargetRecord>();

    for (const target of targets ?? []) {
      if (
        !target?.targetId ||
        !['ITEM', 'CATEGORY'].includes(target.targetType)
      ) {
        continue;
      }
      normalized.set(`${target.targetType}:${target.targetId}`, {
        targetType: target.targetType,
        targetId: target.targetId,
      });
    }

    if (catalogItemId && normalized.size === 0) {
      normalized.set(`ITEM:${catalogItemId}`, {
        targetType: 'ITEM',
        targetId: catalogItemId,
      });
    }

    return Array.from(normalized.values());
  }

  private firstItemTargetId(
    targets: SalesPromotionTargetRecord[],
  ): string | null {
    return (
      targets.find((target) => target.targetType === 'ITEM')?.targetId ?? null
    );
  }

  async createPromotion(
    record: Omit<
      import('../../../domain/repositories/ISalesRepository').SalesPromotionRecord,
      'createdAt' | 'updatedAt'
    >,
  ) {
    const targets = this.normalizeTargets(record.targets, record.catalogItemId);
    const created = await this.prisma.salesPromotion.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        title: record.title,
        description: record.description,
        discountType: record.discountType,
        discountValue: record.discountValue,
        minimumOrder: record.minimumOrder ?? null,
        imageUrl: record.imageUrl ?? null,
        startsAt: record.startsAt,
        expiresAt: record.expiresAt ?? null,
        active: record.active,
        catalogItemId: record.catalogItemId ?? this.firstItemTargetId(targets),
        targets: {
          create: targets.map((target) => ({
            targetType: target.targetType,
            targetId: target.targetId,
          })),
        },
      },
      include: { targets: true },
    });
    return this.mapPromotion(created);
  }

  async updatePromotion(
    tenantId: string,
    id: string,
    data: Record<string, any>,
  ) {
    const existing = await this.prisma.salesPromotion.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;

    const { targets, ...promotionData } = data;
    const updated = await this.prisma.$transaction(async (tx) => {
      let effectiveData = promotionData;
      if (targets !== undefined) {
        const normalizedTargets = this.normalizeTargets(
          targets,
          promotionData.catalogItemId,
        );
        effectiveData = {
          ...promotionData,
          catalogItemId:
            promotionData.catalogItemId !== undefined
              ? promotionData.catalogItemId
              : this.firstItemTargetId(normalizedTargets),
        };
        await tx.salesPromotionTarget.deleteMany({
          where: { promotionId: id },
        });
        if (normalizedTargets.length > 0) {
          await tx.salesPromotionTarget.createMany({
            data: normalizedTargets.map((target) => ({
              promotionId: id,
              targetType: target.targetType,
              targetId: target.targetId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.salesPromotion.update({
        where: { id },
        data: effectiveData,
        include: { targets: true },
      });
    });
    return this.mapPromotion(updated);
  }

  async deletePromotion(tenantId: string, id: string): Promise<void> {
    await this.prisma.salesPromotion.deleteMany({
      where: { id, tenantId },
    });
  }

  async findPromotionById(tenantId: string, id: string) {
    const record = await this.prisma.salesPromotion.findFirst({
      where: { id, tenantId },
      include: { targets: true },
    });
    return record ? this.mapPromotion(record) : null;
  }

  async listPromotions(tenantId: string, onlyActive?: boolean) {
    const where: any = { tenantId };
    if (onlyActive) where.active = true;
    const records = await this.prisma.salesPromotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { targets: true },
    });
    return records.map((r: any) => this.mapPromotion(r));
  }

  private mapCoupon(
    record: any,
  ): import('../../../domain/repositories/ISalesRepository').SalesCouponRecord {
    const targets = this.mapTargets(record.targets, record.catalogItemId);
    return {
      id: record.id,
      tenantId: record.tenantId,
      promotionId: record.promotionId ?? null,
      code: record.code,
      description: record.description ?? null,
      discountType:
        record.discountType as import('../../../domain/repositories/ISalesRepository').SalesDiscountType,
      discountValue: Number(record.discountValue),
      maxUses: record.maxUses,
      usedCount: record.usedCount,
      startsAt: record.startsAt,
      expiresAt: record.expiresAt ?? null,
      active: record.active,
      catalogItemId: record.catalogItemId ?? null,
      targets,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async createCoupon(
    record: Omit<
      import('../../../domain/repositories/ISalesRepository').SalesCouponRecord,
      'createdAt' | 'updatedAt' | 'usedCount'
    >,
  ) {
    const targets = this.normalizeTargets(record.targets, record.catalogItemId);
    const created = await this.prisma.salesCoupon.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        promotionId: record.promotionId ?? null,
        code: record.code.toUpperCase(),
        description: record.description ?? null,
        discountType: record.discountType,
        discountValue: record.discountValue,
        maxUses: record.maxUses,
        startsAt: record.startsAt,
        expiresAt: record.expiresAt ?? null,
        active: record.active,
        catalogItemId: record.catalogItemId ?? this.firstItemTargetId(targets),
        targets: {
          create: targets.map((target) => ({
            targetType: target.targetType,
            targetId: target.targetId,
          })),
        },
      },
      include: { targets: true },
    });
    return this.mapCoupon(created);
  }

  async updateCoupon(tenantId: string, id: string, data: Record<string, any>) {
    const existing = await this.prisma.salesCoupon.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;

    if (data.code) data.code = data.code.toUpperCase();
    const { targets, ...couponData } = data;
    const updated = await this.prisma.$transaction(async (tx) => {
      let effectiveData = couponData;
      if (targets !== undefined) {
        const normalizedTargets = this.normalizeTargets(
          targets,
          couponData.catalogItemId,
        );
        effectiveData = {
          ...couponData,
          catalogItemId:
            couponData.catalogItemId !== undefined
              ? couponData.catalogItemId
              : this.firstItemTargetId(normalizedTargets),
        };
        await tx.salesCouponTarget.deleteMany({ where: { couponId: id } });
        if (normalizedTargets.length > 0) {
          await tx.salesCouponTarget.createMany({
            data: normalizedTargets.map((target) => ({
              couponId: id,
              targetType: target.targetType,
              targetId: target.targetId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.salesCoupon.update({
        where: { id },
        data: effectiveData,
        include: { targets: true },
      });
    });
    return this.mapCoupon(updated);
  }

  async deleteCoupon(tenantId: string, id: string): Promise<void> {
    await this.prisma.salesCoupon.deleteMany({
      where: { id, tenantId },
    });
  }

  async findCouponById(tenantId: string, id: string) {
    const record = await this.prisma.salesCoupon.findFirst({
      where: { id, tenantId },
      include: { targets: true },
    });
    return record ? this.mapCoupon(record) : null;
  }

  async findCouponByCode(tenantId: string, code: string) {
    const record = await this.prisma.salesCoupon.findFirst({
      where: { tenantId, code: code.toUpperCase() },
      include: { targets: true },
    });
    return record ? this.mapCoupon(record) : null;
  }

  async listCoupons(tenantId: string, onlyActive?: boolean) {
    const where: any = { tenantId };
    if (onlyActive) where.active = true;
    const records = await this.prisma.salesCoupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { targets: true },
    });
    return records.map((r: any) => this.mapCoupon(r));
  }

  async incrementCouponUsage(tenantId: string, id: string) {
    const existing = await this.prisma.salesCoupon.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;

    const updated = await this.prisma.salesCoupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
      include: { targets: true },
    });
    return this.mapCoupon(updated);
  }
}
