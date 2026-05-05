import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ProspectAdsInsightResult } from '../../../domain/entities/ProspectAdsInsightResult';

interface RawProspectAdsInsightResult {
  id: string;
  tenant_id: string;
  query_id: string;
  result_type: 'DEMAND_ESTIMATE' | 'INTEREST' | 'REGION' | 'KEYWORD_THEME';
  title: string;
  subtitle: string | null;
  metric_value: number | null;
  score: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectAdsInsightResultMapper {
  static toDomain(raw: RawProspectAdsInsightResult): ProspectAdsInsightResult {
    return ProspectAdsInsightResult.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        queryId: new UniqueEntityID(raw.query_id),
        resultType: raw.result_type,
        title: raw.title,
        subtitle: raw.subtitle ?? undefined,
        metricValue: raw.metric_value ?? undefined,
        score: raw.score ?? undefined,
        metadata: raw.metadata ?? undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  static toPersistence(result: ProspectAdsInsightResult) {
    return {
      id: result.id.toString(),
      tenantId: result.tenantId.toString(),
      queryId: result.queryId.toString(),
      resultType: result.resultType,
      title: result.title,
      subtitle: result.subtitle ?? null,
      metricValue: result.metricValue ?? null,
      score: result.score ?? null,
      metadata: result.metadata ?? null,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
