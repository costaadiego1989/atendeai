import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectAdsInsightResult } from '../../../domain/entities/ProspectAdsInsightResult';
import {
  IProspectAdsInsightResultRepository,
} from '../../../domain/repositories/IProspectAdsInsightResultRepository';
import { ProspectAdsInsightResultMapper } from '../mappers/ProspectAdsInsightResultMapper';

@Injectable()
export class PrismaProspectAdsInsightResultRepository
  implements IProspectAdsInsightResultRepository {
  constructor(private readonly prisma: PrismaService) { }

  private async ensureTable(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS prospecting_schema.prospect_ads_insight_results (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        query_id UUID NOT NULL,
        result_type VARCHAR(40) NOT NULL,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT,
        metric_value DOUBLE PRECISION,
        score DOUBLE PRECISION,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async saveMany(results: ProspectAdsInsightResult[]): Promise<void> {
    await this.ensureTable();
    for (const result of results) {
      const data = ProspectAdsInsightResultMapper.toPersistence(result);
      await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO prospecting_schema.prospect_ads_insight_results (
            id, tenant_id, query_id, result_type, title, subtitle, metric_value, score, metadata, created_at, updated_at
          ) VALUES (
            ${data.id}::uuid, ${data.tenantId}::uuid, ${data.queryId}::uuid, ${data.resultType}, ${data.title}, ${data.subtitle}, ${data.metricValue}, ${data.score}, ${JSON.stringify(data.metadata)}::jsonb, ${data.createdAt}::timestamptz, ${data.updatedAt}::timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            query_id = EXCLUDED.query_id,
            result_type = EXCLUDED.result_type,
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            metric_value = EXCLUDED.metric_value,
            score = EXCLUDED.score,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `);
    }
  }

  async deleteByQuery(tenantId: string, queryId: string): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM prospecting_schema.prospect_ads_insight_results
        WHERE tenant_id = ${tenantId}::uuid AND query_id = ${queryId}::uuid
      `);
  }

  async findAllByQuery(tenantId: string, queryId: string): Promise<ProspectAdsInsightResult[]> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM prospecting_schema.prospect_ads_insight_results
        WHERE tenant_id = ${tenantId}::uuid AND query_id = ${queryId}::uuid
        ORDER BY created_at ASC
      `);
    return rows.map((row) => ProspectAdsInsightResultMapper.toDomain(row));
  }
}
