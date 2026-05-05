import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectAdsInsightQuery } from '../../../domain/entities/ProspectAdsInsightQuery';
import {
  IProspectAdsInsightQueryRepository,
} from '../../../domain/repositories/IProspectAdsInsightQueryRepository';
import { ProspectAdsInsightQueryMapper } from '../mappers/ProspectAdsInsightQueryMapper';

@Injectable()
export class PrismaProspectAdsInsightQueryRepository
  implements IProspectAdsInsightQueryRepository {
  constructor(private readonly prisma: PrismaService) { }

  private async ensureTable(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS prospecting_schema.prospect_ads_insight_queries (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        source VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_ADS_AUDIENCE',
        segment VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        state VARCHAR(50),
        country VARCHAR(10) NOT NULL DEFAULT 'BR',
        age_range VARCHAR(50),
        gender VARCHAR(30),
        interest VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        discovered_count INTEGER NOT NULL DEFAULT 0,
        failure_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async save(query: ProspectAdsInsightQuery): Promise<void> {
    await this.ensureTable();
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

  async findById(tenantId: string, queryId: string): Promise<ProspectAdsInsightQuery | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_ads_insight_queries
        WHERE tenant_id = ${tenantId}::uuid AND id = ${queryId}::uuid
        LIMIT 1
      `);
    return rows[0] ? ProspectAdsInsightQueryMapper.toDomain(rows[0]) : null;
  }

  async findAllByTenant(tenantId: string): Promise<ProspectAdsInsightQuery[]> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_ads_insight_queries
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
      `);
    return rows.map((row) => ProspectAdsInsightQueryMapper.toDomain(row));
  }
}
