import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  AddCommerceSessionItemInput,
  COMMERCE_REPOSITORY,
  CommerceAuditLogInput,
  CommerceAbandonmentTouchRecord,
  CommerceCatalogLookupreçord,
  CommerceInventoryLookupreçord,
  CommerceOrderListItemRecord,
  CommerceOrderRecord,
  CommercePendingOptionRecord,
  CommerceSessionItemRecord,
  CommerceSessionRecord,
  CommerceShippingPolicyRecord,
  CreateCommerceOrderInput,
  CreateCommerceSessionInput,
  ICommerceRepository,
  CommerceOrderStatus,
  ListAbandonedCommerceSessionsInput,
  MarkCommerceOrderPaidInput,
  UpdateCommerceSessionStateInput,
  UpsertCommerceShippingPolicyInput,
  CommerceAbandonmentConfigRecord,
  UpsertCommerceAbandonmentConfigInput,
} from '../../domain/ports/ICommerceRepository';

@Injectable()
export class PrismaCommerceRepository implements ICommerceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveAuditLog(input: CommerceAuditLogInput): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO commerce_schema.commerce_audit_log (
        tenant_id,
        user_id,
        user_name,
        event,
        entity_id,
        entity_type,
        metadata,
        created_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.userId || null}::uuid,
        ${input.userName || null},
        ${input.event},
        ${input.entityId}::uuid,
        ${input.entityType},
        ${JSON.stringify(input.metadata || {})}::jsonb,
        now()
      )
    `);
  }

  private toSqlString(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private toSqlNullableString(value?: string | null): string {
    return value ? this.toSqlString(value) : 'NULL';
  }

  private toSqlNullableUuid(value?: string | null): string {
    return value ? `${this.toSqlString(value)}::uuid` : 'NULL';
  }

  private toSqlNullableNumber(value?: number | null): string {
    return value == null ? 'NULL' : String(Number(value));
  }

  private toSqlNullableDate(value?: Date | null): string {
    return value ? this.toSqlString(value.toISOString()) : 'NULL';
  }

  private toSqlNullableJson(value?: unknown): string {
    return value == null
      ? 'NULL'
      : `${this.toSqlString(JSON.stringify(value))}::jsonb`;
  }

  private mapShippingPolicy(
    row: Record<string, unknown>,
  ): CommerceShippingPolicyRecord {
    return {
      tenantId: String(row.tenant_id),
      mode: String(row.mode) as CommerceShippingPolicyRecord['mode'],
      fixedAmount: row.fixed_amount == null ? null : Number(row.fixed_amount),
      pricePerKm: row.price_per_km == null ? null : Number(row.price_per_km),
      minimumAmount:
        row.minimum_amount == null ? null : Number(row.minimum_amount),
      maxRadiusKm: row.max_radius_km == null ? null : Number(row.max_radius_km),
      servicedNeighborhoods:
        row.serviced_neighborhoods == null
          ? []
          : Array.isArray(row.serviced_neighborhoods)
            ? (row.serviced_neighborhoods as string[])
            : (JSON.parse(String(row.serviced_neighborhoods)) as string[]),
      deliverySchedule:
        row.delivery_schedule == null
          ? []
          : Array.isArray(row.delivery_schedule)
            ? (row.delivery_schedule as CommerceShippingPolicyRecord['deliverySchedule'])
            : (JSON.parse(
                String(row.delivery_schedule),
              ) as CommerceShippingPolicyRecord['deliverySchedule']),
      notes: (row.notes as string | null | undefined) ?? null,
      active: Boolean(row.active),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapAbandonmentConfig(
    row: Record<string, unknown>,
  ): CommerceAbandonmentConfigRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      active: Boolean(row.active),
      message: (row.message as string | null | undefined) ?? null,
      useAiMessage: Boolean(row.use_ai_message),
      mode: String(row.mode) as 'SINGLE' | 'QUEUE',
      maxTouches: Number(row.max_touches),
      intervalMinutes: Number(row.interval_minutes),
      minimumIntervalMinutes: Number(row.minimum_interval_minutes),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapSessionItem(
    row: Record<string, unknown>,
  ): CommerceSessionItemRecord {
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      tenantId: String(row.tenant_id),
      source: String(row.source) as CommerceSessionItemRecord['source'],
      inventoryItemId:
        (row.inventory_item_id as string | null | undefined) ?? null,
      catalogItemId: (row.catalog_item_id as string | null | undefined) ?? null,
      name: String(row.name),
      quantity: Number(row.quantity),
      unitPrice: row.unit_price == null ? null : Number(row.unit_price),
      lineTotal: Number(row.line_total ?? 0),
      currency: String(row.currency ?? 'BRL'),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private async loadSessionItems(
    sessionId: string,
  ): Promise<CommerceSessionItemRecord[]> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.shopping_session_items
      WHERE session_id = ${sessionId}::uuid
      ORDER BY created_at ASC
    `);

    return rows.map((row) => this.mapSessionItem(row));
  }

  private async mapSession(
    row: Record<string, unknown>,
  ): Promise<CommerceSessionRecord> {
    const pendingOptions =
      Array.isArray(row.pending_options) || row.pending_options == null
        ? ((row.pending_options as
            | CommercePendingOptionRecord[]
            | null
            | undefined) ?? [])
        : (JSON.parse(
            String(row.pending_options),
          ) as CommercePendingOptionRecord[]);

    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      branchId: (row.branch_id as string | null | undefined) ?? null,
      conversationId: String(row.conversation_id),
      contactId: (row.contact_id as string | null | undefined) ?? null,
      status: String(row.status) as CommerceSessionRecord['status'],
      currentStep: String(
        row.current_step ?? 'IDENTIFYING_NEED',
      ) as CommerceSessionRecord['currentStep'],
      fulfillmentType:
        (row.fulfillment_type as CommerceSessionRecord['fulfillmentType']) ??
        null,
      shippingMode:
        (row.shipping_mode as CommerceSessionRecord['shippingMode']) ?? null,
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
      freightAmount:
        row.freight_amount == null ? null : Number(row.freight_amount),
      subtotalAmount: Number(row.subtotal_amount ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
      deliveryAddress:
        (row.delivery_address as string | null | undefined) ?? null,
      notes: (row.notes as string | null | undefined) ?? null,
      paymentReference:
        (row.payment_reference as string | null | undefined) ?? null,
      paymentLinkId: (row.payment_link_id as string | null | undefined) ?? null,
      paymentLinkUrl:
        (row.payment_link_url as string | null | undefined) ?? null,
      paymentStatus:
        (row.payment_status as 'PENDING' | 'PAID' | null | undefined) ?? null,
      couponCode: (row.coupon_code as string | null | undefined) ?? null,
      discountAmount:
        row.discount_amount == null ? null : Number(row.discount_amount),
      abandonmentPaused: Boolean(row.abandonment_paused ?? false),
      abandonmentPausedAt: row.abandonment_paused_at
        ? new Date(String(row.abandonment_paused_at))
        : null,
      pendingQuery: (row.pending_query as string | null | undefined) ?? null,
      pendingOptions,
      selectedSource:
        (row.selected_source as 'INVENTORY' | 'CATALOG' | null | undefined) ??
        null,
      selectedInventoryItemId:
        (row.selected_inventory_item_id as string | null | undefined) ?? null,
      selectedCatalogItemId:
        (row.selected_catalog_item_id as string | null | undefined) ?? null,
      selectedItemName:
        (row.selected_item_name as string | null | undefined) ?? null,
      checkedOutAt: row.checked_out_at
        ? new Date(String(row.checked_out_at))
        : null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
      items: await this.loadSessionItems(String(row.id)),
    };
  }

  private mapOrder(row: Record<string, unknown>): CommerceOrderRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      branchId: (row.branch_id as string | null | undefined) ?? null,
      sessionId: String(row.session_id),
      conversationId: String(row.conversation_id),
      contactId: (row.contact_id as string | null | undefined) ?? null,
      status: String(row.status) as CommerceOrderRecord['status'],
      fulfillmentType:
        (row.fulfillment_type as CommerceOrderRecord['fulfillmentType']) ??
        null,
      shippingMode:
        (row.shipping_mode as CommerceOrderRecord['shippingMode']) ?? null,
      subtotalAmount: Number(row.subtotal_amount ?? 0),
      freightAmount: Number(row.freight_amount ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
      deliveryAddress:
        (row.delivery_address as string | null | undefined) ?? null,
      paymentReference:
        (row.payment_reference as string | null | undefined) ?? null,
      paymentLinkId: (row.payment_link_id as string | null | undefined) ?? null,
      paymentLinkUrl:
        (row.payment_link_url as string | null | undefined) ?? null,
      paymentStatus:
        (row.payment_status as 'PENDING' | 'PAID' | null | undefined) ?? null,
      couponCode: (row.coupon_code as string | null | undefined) ?? null,
      discountAmount:
        row.discount_amount == null ? null : Number(row.discount_amount),
      paidAt: row.paid_at ? new Date(String(row.paid_at)) : null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapOrderListItem(
    row: Record<string, unknown>,
  ): CommerceOrderListItemRecord {
    return {
      ...this.mapOrder(row),
      contactName: (row.contact_name as string | null | undefined) ?? null,
      contactPhone: (row.contact_phone as string | null | undefined) ?? null,
      abandonmentTouchesCount: Number(row.abandonment_touches_count ?? 0),
      lastAbandonmentInterval:
        (row.last_abandonment_interval as string | null | undefined) ?? null,
      lastAbandonmentAt: row.last_abandonment_at
        ? new Date(String(row.last_abandonment_at))
        : null,
    };
  }

  private mapAbandonmentTouch(
    row: Record<string, unknown>,
  ): CommerceAbandonmentTouchRecord {
    return {
      interval: String(row.interval ?? ''),
      triggeredAt: new Date(String(row.triggered_at)),
      subtotalAmount:
        row.subtotal_amount == null ? null : Number(row.subtotal_amount),
      totalAmount: row.total_amount == null ? null : Number(row.total_amount),
      currentStep: (row.current_step as string | null | undefined) ?? null,
    };
  }

  async upsertShippingPolicy(
    input: UpsertCommerceShippingPolicyInput,
  ): Promise<CommerceShippingPolicyRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO commerce_schema.shipping_policies (
        tenant_id,
        mode,
        fixed_amount,
        price_per_km,
        minimum_amount,
        max_radius_km,
        serviced_neighborhoods,
        delivery_schedule,
        notes,
        active,
        created_at,
        updated_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.mode},
        ${input.fixedAmount ?? null},
        ${input.pricePerKm ?? null},
        ${input.minimumAmount ?? null},
        ${input.maxRadiusKm ?? null},
        ${JSON.stringify(input.servicedNeighborhoods ?? [])}::jsonb,
        ${JSON.stringify(input.deliverySchedule ?? [])}::jsonb,
        ${input.notes ?? null},
        ${input.active},
        now(),
        now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        fixed_amount = EXCLUDED.fixed_amount,
        price_per_km = EXCLUDED.price_per_km,
        minimum_amount = EXCLUDED.minimum_amount,
        max_radius_km = EXCLUDED.max_radius_km,
        serviced_neighborhoods = EXCLUDED.serviced_neighborhoods,
        delivery_schedule = EXCLUDED.delivery_schedule,
        notes = EXCLUDED.notes,
        active = EXCLUDED.active,
        updated_at = now()
      RETURNING *
    `);

    return this.mapShippingPolicy(rows[0]);
  }

  async upsertAbandonmentConfig(
    input: UpsertCommerceAbandonmentConfigInput,
  ): Promise<CommerceAbandonmentConfigRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO commerce_schema.commerce_abandonment_configs (
        tenant_id,
        active,
        message,
        use_ai_message,
        mode,
        max_touches,
        interval_minutes,
        minimum_interval_minutes,
        created_at,
        updated_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.active},
        ${input.message ?? null},
        ${input.useAiMessage},
        ${input.mode},
        ${input.maxTouches},
        ${input.intervalMinutes},
        30,
        now(),
        now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        active = EXCLUDED.active,
        message = EXCLUDED.message,
        use_ai_message = EXCLUDED.use_ai_message,
        mode = EXCLUDED.mode,
        max_touches = EXCLUDED.max_touches,
        interval_minutes = EXCLUDED.interval_minutes,
        updated_at = now()
      RETURNING *
    `);

    return this.mapAbandonmentConfig(rows[0]);
  }

  async findAbandonmentConfigByTenantId(
    tenantId: string,
  ): Promise<CommerceAbandonmentConfigRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.commerce_abandonment_configs
      WHERE tenant_id = ${tenantId}::uuid
    `);

    if (rows.length === 0) {
      return null;
    }

    return this.mapAbandonmentConfig(rows[0]);
  }

  async findShippingPolicyByTenantId(
    tenantId: string,
  ): Promise<CommerceShippingPolicyRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.shipping_policies
      WHERE tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapShippingPolicy(rows[0]) : null;
  }

  async createSession(
    input: CreateCommerceSessionInput,
  ): Promise<CommerceSessionRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO commerce_schema.shopping_sessions (
        tenant_id,
        branch_id,
        conversation_id,
        contact_id,
        status,
        current_step,
        subtotal_amount,
        total_amount,
        created_at,
        updated_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.branchId || null}::uuid,
        ${input.conversationId}::uuid,
        ${input.contactId || null}::uuid,
        'BUILDING_CART',
        'IDENTIFYING_NEED',
        0,
        0,
        now(),
        now()
      )
      RETURNING *
    `);

    return this.mapSession(rows[0]);
  }

  async findActiveSessionByConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<CommerceSessionRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.shopping_sessions
      WHERE tenant_id = ${tenantId}::uuid
        AND conversation_id = ${conversationId}::uuid
        AND status <> 'CANCELLED'
        AND status <> 'PAID'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async findSessionById(
    tenantId: string,
    sessionId: string,
  ): Promise<CommerceSessionRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.shopping_sessions
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${sessionId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async addSessionItem(
    input: AddCommerceSessionItemInput,
  ): Promise<CommerceSessionItemRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO commerce_schema.shopping_session_items (
        session_id,
        tenant_id,
        source,
        inventory_item_id,
        catalog_item_id,
        name,
        quantity,
        unit_price,
        currency,
        line_total,
        created_at,
        updated_at
      ) VALUES (
        ${input.sessionId}::uuid,
        ${input.tenantId}::uuid,
        ${input.source},
        ${input.inventoryItemId || null}::uuid,
        ${input.catalogItemId || null}::uuid,
        ${input.name},
        ${input.quantity},
        ${input.unitPrice},
        ${input.currency ?? 'BRL'},
        ${Number(input.unitPrice) * Number(input.quantity)},
        now(),
        now()
      )
      RETURNING *
    `);

    return this.mapSessionItem(rows[0]);
  }

  async updateSessionState(
    input: UpdateCommerceSessionStateInput,
  ): Promise<CommerceSessionRecord> {
    const assignments: Prisma.Sql[] = [];

    if ('status' in input) {
      assignments.push(Prisma.sql`status = ${input.status ?? null}`);
    }
    if ('currentStep' in input) {
      assignments.push(Prisma.sql`current_step = ${input.currentStep ?? null}`);
    }
    if ('fulfillmentType' in input) {
      assignments.push(
        Prisma.sql`fulfillment_type = ${input.fulfillmentType ?? null}`,
      );
    }
    if ('shippingMode' in input) {
      assignments.push(
        Prisma.sql`shipping_mode = ${input.shippingMode ?? null}`,
      );
    }
    if ('distanceKm' in input) {
      assignments.push(Prisma.sql`distance_km = ${input.distanceKm ?? null}`);
    }
    if ('freightAmount' in input) {
      assignments.push(
        Prisma.sql`freight_amount = ${input.freightAmount ?? null}`,
      );
    }
    if ('subtotalAmount' in input) {
      assignments.push(
        Prisma.sql`subtotal_amount = ${input.subtotalAmount ?? null}`,
      );
    }
    if ('totalAmount' in input) {
      assignments.push(Prisma.sql`total_amount = ${input.totalAmount ?? null}`);
    }
    if ('deliveryAddress' in input) {
      assignments.push(
        Prisma.sql`delivery_address = ${input.deliveryAddress ?? null}`,
      );
    }
    if ('notes' in input) {
      assignments.push(Prisma.sql`notes = ${input.notes ?? null}`);
    }
    if ('paymentReference' in input) {
      assignments.push(
        Prisma.sql`payment_reference = ${input.paymentReference ?? null}`,
      );
    }
    if ('paymentLinkId' in input) {
      assignments.push(
        Prisma.sql`payment_link_id = ${input.paymentLinkId ?? null}`,
      );
    }
    if ('paymentLinkUrl' in input) {
      assignments.push(
        Prisma.sql`payment_link_url = ${input.paymentLinkUrl ?? null}`,
      );
    }
    if ('paymentStatus' in input) {
      assignments.push(
        Prisma.sql`payment_status = ${input.paymentStatus ?? null}`,
      );
    }
    if ('abandonmentPaused' in input) {
      assignments.push(
        Prisma.sql`abandonment_paused = ${Boolean(input.abandonmentPaused)}`,
      );
    }
    if ('abandonmentPausedAt' in input) {
      assignments.push(
        Prisma.sql`abandonment_paused_at = ${input.abandonmentPausedAt ?? null}`,
      );
    }
    if ('pendingQuery' in input) {
      assignments.push(
        Prisma.sql`pending_query = ${input.pendingQuery ?? null}`,
      );
    }
    if ('pendingOptions' in input) {
      assignments.push(
        Prisma.sql`pending_options = ${JSON.stringify(input.pendingOptions ?? null)}::jsonb`,
      );
    }
    if ('selectedSource' in input) {
      assignments.push(
        Prisma.sql`selected_source = ${input.selectedSource ?? null}`,
      );
    }
    if ('selectedInventoryItemId' in input) {
      assignments.push(
        Prisma.sql`selected_inventory_item_id = ${input.selectedInventoryItemId || null}::uuid`,
      );
    }
    if ('selectedCatalogItemId' in input) {
      assignments.push(
        Prisma.sql`selected_catalog_item_id = ${input.selectedCatalogItemId || null}::uuid`,
      );
    }
    if ('selectedItemName' in input) {
      assignments.push(
        Prisma.sql`selected_item_name = ${input.selectedItemName ?? null}`,
      );
    }
    if ('checkedOutAt' in input) {
      assignments.push(
        Prisma.sql`checked_out_at = ${input.checkedOutAt ?? null}`,
      );
    }
    if ('couponCode' in input) {
      assignments.push(Prisma.sql`coupon_code = ${input.couponCode ?? null}`);
    }
    if ('discountAmount' in input) {
      assignments.push(
        Prisma.sql`discount_amount = ${input.discountAmount ?? null}`,
      );
    }

    assignments.push(Prisma.sql`updated_at = now()`);

    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE commerce_schema.shopping_sessions
      SET ${Prisma.join(assignments, ', ')}
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.sessionId}::uuid
      RETURNING *
    `);

    return this.mapSession(rows[0]);
  }

  async createOrder(
    input: CreateCommerceOrderInput,
  ): Promise<CommerceOrderRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      INSERT INTO commerce_schema.orders (
        id,
        tenant_id,
        branch_id,
        session_id,
        conversation_id,
        contact_id,
        status,
        fulfillment_type,
        shipping_mode,
        subtotal_amount,
        freight_amount,
        total_amount,
        delivery_address,
        payment_reference,
        payment_link_id,
        payment_link_url,
        payment_status,
        created_at,
        updated_at
      ) VALUES (
        ${input.id}::uuid,
        ${input.tenantId}::uuid,
        ${input.branchId || null}::uuid,
        ${input.sessionId}::uuid,
        ${input.conversationId}::uuid,
        ${input.contactId || null}::uuid,
        ${input.status},
        ${input.fulfillmentType || null},
        ${input.shippingMode || null},
        ${Number(input.subtotalAmount)},
        ${Number(input.freightAmount)},
        ${Number(input.totalAmount)},
        ${input.deliveryAddress || null},
        ${input.paymentReference || null},
        ${input.paymentLinkId || null},
        ${input.paymentLinkUrl || null},
        ${input.paymentStatus || null},
        now(),
        now()
      )
      RETURNING *
    `);

    return this.mapOrder(rows[0]);
  }

  async findOrderById(
    tenantId: string,
    orderId: string,
  ): Promise<CommerceOrderRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.orders
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${orderId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapOrder(rows[0]) : null;
  }

  async findOrderByPaymentReference(
    tenantId: string,
    paymentReference: string,
  ): Promise<CommerceOrderRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT *
      FROM commerce_schema.orders
      WHERE tenant_id = ${tenantId}::uuid
        AND payment_reference = ${paymentReference}
      LIMIT 1
    `);

    return rows[0] ? this.mapOrder(rows[0]) : null;
  }

  async listOrders(input: {
    tenantId: string;
    branchId?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }): Promise<CommerceOrderListItemRecord[]> {
    const whereClauses: Prisma.Sql[] = [
      Prisma.sql`orders.tenant_id = ${input.tenantId}::uuid`,
    ];

    if (input.branchId) {
      whereClauses.push(Prisma.sql`orders.branch_id = ${input.branchId}::uuid`);
    }
    if (input.status) {
      whereClauses.push(Prisma.sql`orders.status = ${input.status}`);
    }
    if (input.paymentStatus) {
      whereClauses.push(
        Prisma.sql`orders.payment_status = ${input.paymentStatus}`,
      );
    }
    if (input.dateFrom) {
      whereClauses.push(Prisma.sql`orders.updated_at >= ${input.dateFrom}`);
    }
    if (input.dateTo) {
      whereClauses.push(Prisma.sql`orders.updated_at <= ${input.dateTo}`);
    }

    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT
        orders.*,
        contacts.name AS contact_name,
        contacts.phone AS contact_phone,
        COALESCE(abandonment.touch_count, 0) AS abandonment_touches_count,
        abandonment.last_interval AS last_abandonment_interval,
        abandonment.last_triggered_at AS last_abandonment_at
      FROM commerce_schema.orders AS orders
      LEFT JOIN contact_schema.contacts AS contacts
        ON contacts.id = orders.contact_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS touch_count,
          MAX(audit.created_at) AS last_triggered_at,
          (
            ARRAY_AGG(
              COALESCE(audit.metadata->>'interval', '')
              ORDER BY audit.created_at DESC
            )
          )[1] AS last_interval
        FROM commerce_schema.commerce_audit_log AS audit
        WHERE audit.entity_id = orders.session_id
          AND audit.entity_type = 'SESSION'
          AND audit.event = 'SESSION_ABANDONMENT_TRIGGERED'
      ) AS abandonment ON true
      WHERE ${Prisma.join(whereClauses, ' AND ')}
      ORDER BY orders.updated_at DESC
    `);

    return rows.map((row) => this.mapOrderListItem(row));
  }

  async updateOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status: CommerceOrderStatus;
  }): Promise<CommerceOrderRecord> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE commerce_schema.orders
      SET
        status = ${input.status},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.orderId}::uuid
      RETURNING *
    `);

    const order = this.mapOrder(rows[0]);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE commerce_schema.shopping_sessions
      SET
        status = ${input.status},
        current_step = ${input.status},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${order.sessionId}::uuid
    `);

    return order;
  }

  async markOrderPaidByPaymentReference(
    input: MarkCommerceOrderPaidInput,
  ): Promise<CommerceOrderRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE commerce_schema.orders
      SET
        status = 'PAID',
        payment_status = 'PAID',
        paid_at = ${input.paidAt},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND payment_reference = ${input.paymentReference}
      RETURNING *
    `);

    if (!rows[0]) {
      return null;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE commerce_schema.shopping_sessions
      SET
        status = 'PAID',
        current_step = 'PAID',
        payment_status = 'PAID',
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND payment_reference = ${input.paymentReference}
    `);

    return this.mapOrder(rows[0]);
  }

  async listAbandonedSessions(
    input: ListAbandonedCommerceSessionsInput,
  ): Promise<CommerceSessionRecord[]> {
    const limitExpr = input.limit
      ? Prisma.sql`LIMIT ${Number(input.limit)}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT sessions.*
      FROM commerce_schema.shopping_sessions AS sessions
      WHERE sessions.status IN ('BUILDING_CART', 'READY_FOR_CHECKOUT')
        AND sessions.abandonment_paused = FALSE
        AND sessions.updated_at <= ${input.staleBefore.toISOString()}::timestamptz
        AND EXISTS (
          SELECT 1
          FROM commerce_schema.shopping_session_items AS items
          WHERE items.session_id = sessions.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM commerce_schema.orders AS orders
          WHERE orders.session_id = sessions.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM commerce_schema.commerce_audit_log AS audit
          WHERE audit.entity_id = sessions.id
            AND audit.entity_type = 'SESSION'
            AND audit.event = 'SESSION_ABANDONMENT_TRIGGERED'
            AND COALESCE(audit.metadata->>'interval', '') = ${input.interval}
        )
      ORDER BY sessions.updated_at ASC
      ${limitExpr}
    `);

    return Promise.all(rows.map((row) => this.mapSession(row)));
  }

  async listSessionAbandonmentTouches(
    tenantId: string,
    sessionId: string,
  ): Promise<CommerceAbandonmentTouchRecord[]> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT
        COALESCE(audit.metadata->>'interval', '') AS interval,
        audit.created_at AS triggered_at,
        audit.metadata->>'currentStep' AS current_step,
        audit.metadata->>'subtotalAmount' AS subtotal_amount,
        audit.metadata->>'totalAmount' AS total_amount
      FROM commerce_schema.commerce_audit_log AS audit
      WHERE audit.tenant_id = ${tenantId}::uuid
        AND audit.entity_id = ${sessionId}::uuid
        AND audit.entity_type = 'SESSION'
        AND audit.event = 'SESSION_ABANDONMENT_TRIGGERED'
      ORDER BY audit.created_at DESC
    `);

    return rows.map((row) => this.mapAbandonmentTouch(row));
  }

  async findCatalogItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CommerceCatalogLookupreçord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT
        items.id,
        items.tenant_id,
        items.name,
        items.base_price,
        items.currency,
        categories.name AS category_name
      FROM catalog_schema.catalog_items AS items
      LEFT JOIN catalog_schema.catalog_categories AS categories
        ON categories.id = items.category_id
      WHERE items.tenant_id = ${tenantId}::uuid
        AND items.id = ${itemId}::uuid
        AND items.active = TRUE
      LIMIT 1
    `);

    if (!rows[0]) {
      return null;
    }

    return {
      id: String(rows[0].id),
      tenantId: String(rows[0].tenant_id),
      name: String(rows[0].name),
      basePrice: rows[0].base_price == null ? null : Number(rows[0].base_price),
      currency: String(rows[0].currency ?? 'BRL'),
      categoryName:
        (rows[0].category_name as string | null | undefined) ?? null,
    };
  }

  async findInventoryItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CommerceInventoryLookupreçord | null> {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT
        id,
        tenant_id,
        catalog_item_id,
        name,
        current_price,
        currency,
        available_quantity,
        availability_status
      FROM inventory_schema.inventory_items
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${itemId}::uuid
      LIMIT 1
    `);

    if (!rows[0]) {
      return null;
    }

    return {
      id: String(rows[0].id),
      tenantId: String(rows[0].tenant_id),
      catalogItemId:
        (rows[0].catalog_item_id as string | null | undefined) ?? null,
      name: String(rows[0].name),
      currentPrice:
        rows[0].current_price == null ? null : Number(rows[0].current_price),
      currency: String(rows[0].currency ?? 'BRL'),
      availableQuantity: Number(rows[0].available_quantity ?? 0),
      availabilityStatus: String(rows[0].availability_status ?? 'AVAILABLE'),
    };
  }
}

export const __COMMERCE_REPOSITORY_CLASS__ = COMMERCE_REPOSITORY;
