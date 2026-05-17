import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectLeadCapture } from '../../../domain/entities/ProspectLeadCapture';
import {
  IProspectLeadCaptureRepository,
  ProspectLeadCaptureFilters,
  ProspectLeadCapturePage,
} from '../../../domain/repositories/IProspectLeadCaptureRepository';
import { ProspectLeadCaptureMapper } from '../mappers/ProspectLeadCaptureMapper';

@Injectable()
export class PrismaProspectLeadCaptureRepository implements IProspectLeadCaptureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMany(leads: ProspectLeadCapture[]): Promise<void> {
    for (const lead of leads) {
      const data = ProspectLeadCaptureMapper.toPersistence(lead);
      await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO prospecting_schema.prospect_lead_captures (
            id, tenant_id, source, external_lead_id, google_ads_customer_id, campaign_name, form_name,
            full_name, phone, email, city, state, instagram_handle, document, interests, raw_payload,
            submission_at, import_status, contact_id, created_at, updated_at
          ) VALUES (
            ${data.id}::uuid, ${data.tenantId}::uuid, ${data.source}, ${data.externalLeadId}, ${data.googleAdsCustomerId}, ${data.campaignName}, ${data.formName},
            ${data.fullName}, ${data.phone}, ${data.email}, ${data.city}, ${data.state}, ${data.instagramHandle}, ${data.document}, ${JSON.stringify(data.interests)}::jsonb, ${JSON.stringify(data.rawPayload)}::jsonb,
            ${data.submissionAt}::timestamptz, ${data.importStatus}, ${data.contactId}, ${data.createdAt}::timestamptz, ${data.updatedAt}::timestamptz
          )
          ON CONFLICT (tenant_id, external_lead_id) DO UPDATE SET
            source = EXCLUDED.source,
            google_ads_customer_id = EXCLUDED.google_ads_customer_id,
            campaign_name = EXCLUDED.campaign_name,
            form_name = EXCLUDED.form_name,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            instagram_handle = EXCLUDED.instagram_handle,
            document = EXCLUDED.document,
            interests = EXCLUDED.interests,
            raw_payload = EXCLUDED.raw_payload,
            submission_at = EXCLUDED.submission_at,
            import_status = EXCLUDED.import_status,
            contact_id = COALESCE(EXCLUDED.contact_id, prospecting_schema.prospect_lead_captures.contact_id),
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `);
    }
  }

  async findAllByTenant(
    tenantId: string,
    filters: ProspectLeadCaptureFilters,
  ): Promise<ProspectLeadCapturePage> {
    const conditions = [Prisma.sql`tenant_id = ${tenantId}::uuid`];

    if (filters.campaignName?.trim()) {
      conditions.push(
        Prisma.sql`COALESCE(campaign_name, '') ILIKE ${`%${filters.campaignName.trim()}%`}`,
      );
    }

    if (filters.importStatus?.trim() && filters.importStatus !== 'ALL') {
      conditions.push(
        Prisma.sql`import_status = ${filters.importStatus.trim()}`,
      );
    }

    if (filters.channel === 'WHATSAPP') {
      conditions.push(Prisma.sql`phone IS NOT NULL AND phone <> ''`);
    } else if (filters.channel === 'INSTAGRAM') {
      conditions.push(
        Prisma.sql`instagram_handle IS NOT NULL AND instagram_handle <> ''`,
      );
    }

    if (filters.dateFrom) {
      conditions.push(
        Prisma.sql`submission_at >= ${filters.dateFrom}::timestamptz`,
      );
    }

    if (filters.dateTo) {
      conditions.push(
        Prisma.sql`submission_at <= ${filters.dateTo}::timestamptz`,
      );
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const offset = (filters.page - 1) * filters.limit;

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_lead_captures
        WHERE ${whereClause}
        ORDER BY submission_at DESC
        LIMIT ${filters.limit}
        OFFSET ${offset}
      `);

    const totalRows = await this.prisma.$queryRaw<
      Array<{ total: bigint }>
    >(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM prospecting_schema.prospect_lead_captures
        WHERE ${whereClause}
      `);

    const total = Number(totalRows[0]?.total ?? 0);
    return {
      items: rows.map((row) => ProspectLeadCaptureMapper.toDomain(row)),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  }

  async findManyByIds(
    tenantId: string,
    leadIds: string[],
  ): Promise<ProspectLeadCapture[]> {
    if (!leadIds.length) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_lead_captures
        WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${leadIds}::uuid[])
        ORDER BY submission_at DESC
      `);

    return rows.map((row) => ProspectLeadCaptureMapper.toDomain(row));
  }
}
