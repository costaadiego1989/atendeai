import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectExecution } from '../../../domain/entities/ProspectExecution';
import { IProspectExecutionRepository } from '../../../domain/repositories/IProspectExecutionRepository';
import { ProspectExecutionMapper } from '../mappers/ProspectExecutionMapper';

@Injectable()
export class PrismaProspectExecutionRepository implements IProspectExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(execution: ProspectExecution): Promise<void> {
    const data = ProspectExecutionMapper.toPersistence(execution);

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO prospecting_schema.prospect_executions (
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          stop_reason,
          created_at,
          updated_at
        )
        VALUES (
          ${data.id}::uuid,
          ${data.tenantId}::uuid,
          ${data.campaignId}::uuid,
          ${data.contactId},
          ${data.channel},
          ${data.status},
          ${data.attemptCount},
          ${data.stopReason},
          ${data.createdAt}::timestamptz,
          ${data.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          campaign_id = EXCLUDED.campaign_id,
          contact_id = EXCLUDED.contact_id,
          channel = EXCLUDED.channel,
          status = EXCLUDED.status,
          attempt_count = EXCLUDED.attempt_count,
          stop_reason = EXCLUDED.stop_reason,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async saveMany(executions: ProspectExecution[]): Promise<void> {
    for (const execution of executions) {
      const data = ProspectExecutionMapper.toPersistence(execution);

      await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO prospecting_schema.prospect_executions (
            id,
            tenant_id,
            campaign_id,
            contact_id,
            channel,
            status,
            attempt_count,
            stop_reason,
            created_at,
            updated_at
          )
          VALUES (
            ${data.id}::uuid,
            ${data.tenantId}::uuid,
            ${data.campaignId}::uuid,
            ${data.contactId},
            ${data.channel},
            ${data.status},
            ${data.attemptCount},
            ${data.stopReason},
            ${data.createdAt}::timestamptz,
            ${data.updatedAt}::timestamptz
          )
          ON CONFLICT (tenant_id, campaign_id, contact_id) DO NOTHING
        `);
    }
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ProspectExecution | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        campaign_id: string;
        contact_id: string;
        channel: string;
        status: string;
        attempt_count: number;
        stop_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          stop_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid
        LIMIT 1
      `);

    const raw = results[0];
    return raw ? ProspectExecutionMapper.toDomain(raw) : null;
  }

  async findLatestContactedByContact(
    tenantId: string,
    contactId: string,
  ): Promise<ProspectExecution | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        campaign_id: string;
        contact_id: string;
        channel: string;
        status: string;
        attempt_count: number;
        stop_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          stop_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid
          AND contact_id = ${contactId}
          AND status = 'CONTACTED'
        ORDER BY updated_at DESC
        LIMIT 1
      `);

    const raw = results[0];
    return raw ? ProspectExecutionMapper.toDomain(raw) : null;
  }

  async findLastContactedAt(
    tenantId: string,
    contactId: string,
  ): Promise<Date | null> {
    const results = await this.prisma.$queryRaw<Array<{ updated_at: Date }>>(
      Prisma.sql`
        SELECT updated_at
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid
          AND contact_id = ${contactId}
          AND status = 'CONTACTED'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
    );
    return results[0]?.updated_at ?? null;
  }

  async findLatestByContactIds(
    tenantId: string,
    contactIds: string[],
  ): Promise<Array<{ contactId: string; status: string; updatedAt: Date; stopReason?: string | null; campaignName?: string }>> {
    if (contactIds.length === 0) return [];

    const results = await this.prisma.$queryRaw<
      Array<{ contact_id: string; status: string; stop_reason: string | null; updated_at: Date; campaign_name: string | null }>
    >(
      Prisma.sql`
        SELECT DISTINCT ON (e.contact_id)
          e.contact_id,
          e.status,
          e.stop_reason,
          e.updated_at,
          c.name AS campaign_name
        FROM prospecting_schema.prospect_executions e
        LEFT JOIN prospecting_schema.prospect_campaigns c
          ON c.id = e.campaign_id AND c.tenant_id = e.tenant_id
        WHERE e.tenant_id = ${tenantId}::uuid
          AND e.contact_id = ANY(${contactIds}::text[])
        ORDER BY e.contact_id, e.updated_at DESC
      `,
    );

    return results.map((r) => ({
      contactId: r.contact_id,
      status: r.status,
      stopReason: r.stop_reason,
      updatedAt: r.updated_at,
      campaignName: r.campaign_name ?? undefined,
    }));
  }

  async findActiveByContact(
    tenantId: string,
    contactId: string,
  ): Promise<ProspectExecution[]> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        campaign_id: string;
        contact_id: string;
        channel: string;
        status: string;
        attempt_count: number;
        stop_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
      SELECT
        id,
        tenant_id,
        campaign_id,
        contact_id,
        channel,
        status,
        attempt_count,
        stop_reason,
        created_at,
        updated_at
      FROM prospecting_schema.prospect_executions
      WHERE tenant_id = ${tenantId}::uuid
        AND contact_id = ${contactId}
        AND status IN ('PENDING', 'CONTACTED')
    `);

    return results.map((raw) => ProspectExecutionMapper.toDomain(raw));
  }

  async findAllByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution[]> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        campaign_id: string;
        contact_id: string;
        channel: string;
        status: string;
        attempt_count: number;
        stop_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          stop_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid AND campaign_id = ${campaignId}::uuid
        ORDER BY created_at ASC
      `);

    return results.map((raw) => ProspectExecutionMapper.toDomain(raw));
  }

  async countContactedTodayByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid
          AND campaign_id = ${campaignId}::uuid
          AND status = 'CONTACTED'
          AND updated_at >= CURRENT_DATE
      `,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async findNextPendingByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        campaign_id: string;
        contact_id: string;
        channel: string;
        status: string;
        attempt_count: number;
        stop_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          campaign_id,
          contact_id,
          channel,
          status,
          attempt_count,
          stop_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_executions
        WHERE tenant_id = ${tenantId}::uuid
          AND campaign_id = ${campaignId}::uuid
          AND status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 1
      `);

    const raw = results[0];
    return raw ? ProspectExecutionMapper.toDomain(raw) : null;
  }
}
