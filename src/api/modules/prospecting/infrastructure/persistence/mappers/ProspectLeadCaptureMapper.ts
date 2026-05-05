import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ProspectLeadCapture } from '../../../domain/entities/ProspectLeadCapture';

interface RawProspectLeadCapture {
  id: string;
  tenant_id: string;
  source: 'GOOGLE_ADS_LEAD_FORM';
  external_lead_id: string;
  google_ads_customer_id: string | null;
  campaign_name: string | null;
  form_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  instagram_handle: string | null;
  document: string | null;
  interests: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
  submission_at: Date | string;
  import_status: 'NEW' | 'IMPORTED' | 'REUSED' | 'SKIPPED_NO_PHONE';
  contact_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectLeadCaptureMapper {
  static toDomain(raw: RawProspectLeadCapture): ProspectLeadCapture {
    return ProspectLeadCapture.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        source: raw.source,
        externalLeadId: raw.external_lead_id,
        googleAdsCustomerId: raw.google_ads_customer_id ?? undefined,
        campaignName: raw.campaign_name ?? undefined,
        formName: raw.form_name ?? undefined,
        fullName: raw.full_name ?? undefined,
        phone: raw.phone ?? undefined,
        email: raw.email ?? undefined,
        city: raw.city ?? undefined,
        state: raw.state ?? undefined,
        instagramHandle: raw.instagram_handle ?? undefined,
        document: raw.document ?? undefined,
        interests: raw.interests ?? undefined,
        rawPayload: raw.raw_payload ?? undefined,
        submissionAt: new Date(raw.submission_at),
        importStatus: raw.import_status,
        contactId: raw.contact_id ?? undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  static toPersistence(lead: ProspectLeadCapture) {
    return {
      id: lead.id.toString(),
      tenantId: lead.tenantId.toString(),
      source: lead.source,
      externalLeadId: lead.externalLeadId,
      googleAdsCustomerId: lead.googleAdsCustomerId ?? null,
      campaignName: lead.campaignName ?? null,
      formName: lead.formName ?? null,
      fullName: lead.fullName ?? null,
      phone: lead.phone ?? null,
      email: lead.email ?? null,
      city: lead.city ?? null,
      state: lead.state ?? null,
      instagramHandle: lead.instagramHandle ?? null,
      document: lead.document ?? null,
      interests: lead.interests ?? null,
      rawPayload: lead.rawPayload ?? null,
      submissionAt: lead.submissionAt,
      importStatus: lead.importStatus,
      contactId: lead.contactId ?? null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}
