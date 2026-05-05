import { ProspectSearch } from '../../../domain/entities/ProspectSearch';
import { ProspectSearchSourceVO } from '../../../domain/value-objects/ProspectSearchSource';
import { ProspectSearchStatusVO } from '../../../domain/value-objects/ProspectSearchStatus';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

interface RawProspectSearch {
  id: string;
  tenant_id: string;
  business_type_query: string;
  city: string;
  state: string | null;
  neighborhood: string | null;
  source: string;
  max_results: number;
  status: string;
  discovered_count: number;
  failure_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectSearchMapper {
  public static toDomain(raw: RawProspectSearch): ProspectSearch {
    return ProspectSearch.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        businessTypeQuery: raw.business_type_query,
        city: raw.city,
        state: raw.state ?? undefined,
        neighborhood: raw.neighborhood ?? undefined,
        source: ProspectSearchSourceVO.create(raw.source),
        maxResults: raw.max_results,
        status: ProspectSearchStatusVO.create(raw.status),
        discoveredCount: raw.discovered_count,
        failureReason: raw.failure_reason ?? undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  public static toPersistence(search: ProspectSearch) {
    return {
      id: search.id.toString(),
      tenantId: search.tenantId.toString(),
      businessTypeQuery: search.businessTypeQuery,
      city: search.city,
      state: search.state ?? null,
      neighborhood: search.neighborhood ?? null,
      source: search.source.value,
      maxResults: search.maxResults,
      status: search.status.value,
      discoveredCount: search.discoveredCount,
      failureReason: search.failureReason ?? null,
      createdAt: search.createdAt,
      updatedAt: search.updatedAt,
    };
  }
}
