import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectAdsInsightQuery } from '../../../domain/entities/ProspectAdsInsightQuery';
import { IProspectAdsInsightQueryRepository } from '../../../domain/repositories/IProspectAdsInsightQueryRepository';
import { ProspectAdsInsightQueryMapper } from '../mappers/ProspectAdsInsightQueryMapper';

@Injectable()
export class PrismaProspectAdsInsightQueryRepository implements IProspectAdsInsightQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(query: ProspectAdsInsightQuery): Promise<void> {
    const data = ProspectAdsInsightQueryMapper.toPersistence(query);
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO prospecting_schema.prospect_ads_insight_queries (
          id, tenant_id, source, segment, city, state, country, age_range, gender, interest,
          status, discovered_count, failure_reason, created_at, updated_at
        ) VALUES (
          ${data.id}::uuid, ${data.tenantId}::uuid, ${data.source}, ${data.segment}, ${data.city}, ${data.state}, ${data.country}, ${data.ageRange}, ${data.gender}, ${data.interest},
          ${data.status}, ${data.discoveredCount}, ${data.failureReason}, ${data.createdAt}::timestamptz, ${data.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          source = EXCLUDED.source,
          segment = EXCLUDED.segment,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          age_range = EXCLUDED.age_range,
          gender = EXCLUDED.gender,
          interest = EXCLUDED.interest,
          status = EXCLUDED.status,
          discovered_count = EXCLUDED.discovered_count,
          failure_reason = EXCLUDED.failure_reason,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findById(
    tenantId: string,
    queryId: string,
  ): Promise<ProspectAdsInsightQuery | null> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_ads_insight_queries
        WHERE tenant_id = ${tenantId}::uuid AND id = ${queryId}::uuid
        LIMIT 1
      `);
    return rows[0] ? ProspectAdsInsightQueryMapper.toDomain(rows[0]) : null;
  }

  async findAllByTenant(tenantId: string): Promise<ProspectAdsInsightQuery[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_ads_insight_queries
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
      `);
    return rows.map((row) => ProspectAdsInsightQueryMapper.toDomain(row));
  }
}
