import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantFacade,
  TENANT_FACADE,
} from '@modules/tenant/application/facades/ITenantFacade';
import { TenantId } from '@shared/domain/TenantId';
import {
  GOOGLE_ADS_LEAD_SOURCE,
  IGoogleAdsLeadSource,
} from '../../domain/ports/IGoogleAdsLeadSource';
import { ProspectLeadCapture } from '../../domain/entities/ProspectLeadCapture';
import {
  IProspectLeadCaptureRepository,
  PROSPECT_LEAD_CAPTURE_REPOSITORY,
} from '../../domain/repositories/IProspectLeadCaptureRepository';
import {
  ISyncProspectAdsLeadsUseCase,
  SyncProspectAdsLeadsInput,
  SyncProspectAdsLeadsOutput,
} from './interfaces/ISyncProspectAdsLeadsUseCase';

@Injectable()
export class SyncProspectAdsLeadsUseCase implements ISyncProspectAdsLeadsUseCase {
  constructor(
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(GOOGLE_ADS_LEAD_SOURCE)
    private readonly googleAdsLeadSource: IGoogleAdsLeadSource,
    @Inject(PROSPECT_LEAD_CAPTURE_REPOSITORY)
    private readonly leadCaptureRepository: IProspectLeadCaptureRepository,
  ) {}

  async execute(
    input: SyncProspectAdsLeadsInput,
  ): Promise<SyncProspectAdsLeadsOutput> {
    const exists = await this.tenantFacade.tenantExists(input.tenantId);
    if (!exists) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const pulledLeads = await this.googleAdsLeadSource.pullLeads({
      tenantId: input.tenantId,
      limit: input.limit,
    });

    const leads = pulledLeads.map((lead) =>
      ProspectLeadCapture.create({
        tenantId: TenantId.create(input.tenantId),
        externalLeadId: lead.externalLeadId,
        googleAdsCustomerId: lead.googleAdsCustomerId,
        campaignName: lead.campaignName,
        formName: lead.formName,
        fullName: lead.fullName,
        phone: this.normalizePhone(lead.phone),
        email: lead.email,
        city: lead.city,
        state: lead.state,
        instagramHandle: lead.instagramHandle,
        document: lead.document,
        interests: {
          fields: lead.fields,
        },
        rawPayload: lead.rawPayload ?? { fields: lead.fields },
        submissionAt: lead.submissionAt,
      }),
    );

    await this.leadCaptureRepository.saveMany(leads);

    return {
      syncedCount: leads.length,
      leads: leads.map((lead) => ({
        id: lead.id.toString(),
        externalLeadId: lead.externalLeadId,
        campaignName: lead.campaignName,
        formName: lead.formName,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        submissionAt: lead.submissionAt,
      })),
    };
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone?.trim()) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return undefined;
    return digits.startsWith('55') ? digits : `55${digits}`;
  }
}
