import { Inject, Injectable } from '@nestjs/common';
import {
  IListProspectCampaignsUseCase,
  ListProspectCampaignsInput,
  ProspectCampaignListItem,
} from './interfaces/IListProspectCampaignsUseCase';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';

@Injectable()
export class ListProspectCampaignsUseCase
  implements IListProspectCampaignsUseCase
{
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
  ) {}

  async execute(
    input: ListProspectCampaignsInput,
  ): Promise<ProspectCampaignListItem[]> {
    const campaigns = await this.campaignRepository.findAllByTenant(
      input.tenantId,
    );

    return campaigns.map((campaign) => ({
      id: campaign.id.toString(),
      tenantId: campaign.tenantId.toString(),
      name: campaign.name,
      objective: campaign.objective,
      audienceType: campaign.audienceType.value,
      channel: campaign.channel.value,
      targetContactIds: campaign.targetContactIds,
      messageTemplate: campaign.messageTemplate,
      dailyLimit: campaign.dailyLimit,
      status: campaign.status.value,
      createdAt: campaign.createdAt,
    }));
  }
}
