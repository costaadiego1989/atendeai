import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ProspectAdsInsightQuery } from '../../../domain/entities/ProspectAdsInsightQuery';
import { ProspectSearchSourceVO } from '../../../domain/value-objects/ProspectSearchSource';
import { ProspectSearchStatusVO } from '../../../domain/value-objects/ProspectSearchStatus';

interface RawProspectAdsInsightQuery {
  id: string;
  tenant_id: string;
  source: string;
  segment: string;
  city: string | null;
  state: string | null;
  country: string;
  age_range: string | null;
  gender: string | null;
  interest: string | null;
  status: string;
  discovered_count: number;
  failure_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectAdsInsightQueryMapper {
  static toDomain(raw: RawProspectAdsInsightQuery): ProspectAdsInsightQuery {
    return ProspectAdsInsightQuery.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        source: ProspectSearchSourceVO.create(raw.source),
        segment: raw.segment,
        city: raw.city ?? undefined,
        state: raw.state ?? undefined,
        country: raw.country,
        ageRange: raw.age_range ?? undefined,
        gender: raw.gender ?? undefined,
        interest: raw.interest ?? undefined,
        status: ProspectSearchStatusVO.create(raw.status),
        discoveredCount: raw.discovered_count,
        failureReason: raw.failure_reason ?? undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  static toPersistence(query: ProspectAdsInsightQuery) {
    return {
      id: query.id.toString(),
      tenantId: query.tenantId.toString(),
      source: query.source.value,
      segment: query.segment,
      city: query.city ?? null,
      state: query.state ?? null,
      country: query.country,
      ageRange: query.ageRange ?? null,
      gender: query.gender ?? null,
      interest: query.interest ?? null,
      status: query.status.value,
      discoveredCount: query.discoveredCount,
      failureReason: query.failureReason ?? null,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
    };
  }
}
