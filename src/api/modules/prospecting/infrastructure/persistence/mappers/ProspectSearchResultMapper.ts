import { ProspectSearchResult } from '../../../domain/entities/ProspectSearchResult';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectSearchSourceVO } from '../../../domain/value-objects/ProspectSearchSource';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

interface RawProspectSearchResult {
  id: string;
  tenant_id: string;
  search_id: string;
  source: string;
  external_id: string | null;
  business_name: string;
  city: string;
  state: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  email: string | null;
  website: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectSearchResultMapper {
  public static toDomain(raw: RawProspectSearchResult): ProspectSearchResult {
    return ProspectSearchResult.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        searchId: new UniqueEntityID(raw.search_id),
        source: ProspectSearchSourceVO.create(raw.source),
        externalId: raw.external_id ?? undefined,
        businessName: raw.business_name,
        city: raw.city,
        state: raw.state ?? undefined,
        phone: raw.phone ?? undefined,
        whatsappPhone: raw.whatsapp_phone ?? undefined,
        instagramUrl: raw.instagram_url ?? undefined,
        email: raw.email ?? undefined,
        website: raw.website ?? undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  public static toPersistence(result: ProspectSearchResult) {
    return {
      id: result.id.toString(),
      tenantId: result.tenantId.toString(),
      searchId: result.searchId.toString(),
      source: result.source.value,
      externalId: result.externalId ?? null,
      businessName: result.businessName,
      city: result.city,
      state: result.state ?? null,
      phone: result.phone ?? null,
      whatsappPhone: result.whatsappPhone ?? null,
      instagramUrl: result.instagramUrl ?? null,
      email: result.email ?? null,
      website: result.website ?? null,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
