import { Inject, Injectable } from '@nestjs/common';
import {
  IListProspectLeadCapturesUseCase,
  ListProspectLeadCapturesInput,
  ListProspectLeadCapturesOutput,
} from './interfaces/IListProspectLeadCapturesUseCase';
import {
  IProspectLeadCaptureRepository,
  PROSPECT_LEAD_CAPTURE_REPOSITORY,
} from '../../domain/repositories/IProspectLeadCaptureRepository';

@Injectable()
export class ListProspectLeadCapturesUseCase
  implements IListProspectLeadCapturesUseCase
{
  constructor(
    @Inject(PROSPECT_LEAD_CAPTURE_REPOSITORY)
    private readonly leadCaptureRepository: IProspectLeadCaptureRepository,
  ) {}

  async execute(
    input: ListProspectLeadCapturesInput,
  ): Promise<ListProspectLeadCapturesOutput> {
    const page = await this.leadCaptureRepository.findAllByTenant(input.tenantId, {
      page: input.page ?? 1,
      limit: input.limit ?? 10,
      campaignName: input.campaignName,
      importStatus: input.importStatus,
      channel: input.channel,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });

    return {
      items: page.items.map((lead) => ({
        id: lead.id.toString(),
        source: lead.source,
        externalLeadId: lead.externalLeadId,
        googleAdsCustomerId: lead.googleAdsCustomerId,
        campaignName: lead.campaignName,
        formName: lead.formName,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        state: lead.state,
        instagramHandle: lead.instagramHandle,
        document: lead.document,
        interests: lead.interests,
        rawPayload: lead.rawPayload,
        submissionAt: lead.submissionAt,
        importStatus: lead.importStatus,
        contactId: lead.contactId,
      })),
      pagination: {
        page: page.page,
        limit: page.limit,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }
}
